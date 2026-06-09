from flask import Flask, request, jsonify, render_template, send_file
from flask_cors import CORS
from dotenv import load_dotenv

import os
import re
import json
import time
import uuid
import requests
import pdfplumber
import io
from docx import Document

# Optional extractors used as fallbacks when pdfplumber returns very little text
# (complex layouts, scanned PDFs). The app keeps running if these aren't installed.
try:
    import fitz  # PyMuPDF — handles columns / tables / unusual layouts well
    _HAS_FITZ = True
except Exception:
    _HAS_FITZ = False

try:
    import pytesseract           # OCR for scanned/image-only PDFs
    from PIL import Image        # noqa: F401 — pytesseract needs PIL available
    _HAS_OCR = True
except Exception:
    _HAS_OCR = False

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash-lite"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {"pdf", "docx"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_file(file):
    ext = os.path.splitext(file.filename)[1]
    filename = str(uuid.uuid4()) + ext
    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(path)
    return path


def delete_file(path):
    try:
        if path and os.path.exists(path):
            os.remove(path)
    except:
        pass


def _word_count(s):
    return len((s or "").split())


def _extract_pdf_pdfplumber(path):
    text = ""
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
    except Exception:
        pass
    return text


def _extract_pdf_pymupdf(path):
    if not _HAS_FITZ:
        return ""
    text = ""
    try:
        with fitz.open(path) as doc:
            for page in doc:
                # "text" mode preserves reading order better than pdfplumber on multi-column resumes
                text += page.get_text("text") + "\n"
    except Exception:
        return ""
    return text


def _extract_pdf_ocr(path):
    # Last resort: rasterize each page with PyMuPDF, run Tesseract on the image.
    # Requires Tesseract installed on the system (see README note printed at startup).
    if not (_HAS_FITZ and _HAS_OCR):
        return ""
    text = ""
    try:
        with fitz.open(path) as doc:
            for page in doc:
                pix = page.get_pixmap(dpi=220)
                img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                text += pytesseract.image_to_string(img) + "\n"
    except Exception:
        return ""
    return text


def extract_pdf(path):
    """Extraction chain: pdfplumber → PyMuPDF → OCR. Returns whichever yields the most words."""
    best = _extract_pdf_pdfplumber(path)
    if _word_count(best) < 80:
        alt = _extract_pdf_pymupdf(path)
        if _word_count(alt) > _word_count(best):
            best = alt
    if _word_count(best) < 80:
        ocr = _extract_pdf_ocr(path)
        if _word_count(ocr) > _word_count(best):
            best = ocr
    return best


def extract_docx(path):
    doc = Document(path)
    return "\n".join([p.text for p in doc.paragraphs])


def extract_text(path):
    if path.endswith(".pdf"):
        return extract_pdf(path)
    elif path.endswith(".docx"):
        return extract_docx(path)
    return ""


def clean_json(text):
    text = text.strip()
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        text = match.group(0)
    text = text.replace("```json", "").replace("```", "")
    text = text.strip()
    return text


def call_ai(prompt, temperature=0.4, max_retries=4):
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    headers = {"Content-Type": "application/json", "x-goog-api-key": API_KEY}

    last_err = None
    quota_hit = False
    for attempt in range(max_retries):
        try:
            response = requests.post(API_URL, headers=headers, json=payload, timeout=60)

            # Hard quota exhaustion (free tier daily limit). No amount of retrying helps.
            if response.status_code == 429 and "quota" in response.text.lower():
                quota_hit = True
                last_err = "daily quota exceeded"
                break

            # Transient server-side errors — back off (respecting Retry-After if given).
            if response.status_code in (429, 500, 502, 503, 504):
                last_err = f"HTTP {response.status_code}: {response.text[:200]}"
                wait = float(response.headers.get("Retry-After", 2 ** attempt))
                time.sleep(min(wait, 30))
                continue

            data = response.json()
            if "error" in data:
                msg = data["error"].get("message", str(data["error"])) if isinstance(data["error"], dict) else str(data["error"])
                low = msg.lower()
                if "quota" in low or "exhaust" in low:
                    quota_hit = True
                    last_err = msg
                    break
                if any(s in low for s in ("overloaded", "unavailable", "rate")):
                    last_err = msg
                    time.sleep(2 ** attempt)
                    continue
                raise Exception(msg)

            parts = data["candidates"][0]["content"]["parts"]
            texts = [p.get("text", "") for p in parts if not p.get("thought") and p.get("text")]
            out = "".join(texts).strip()
            if not out:
                raise Exception(f"Empty Gemini response: {data}")
            return out
        except requests.exceptions.RequestException as e:
            last_err = str(e)
            time.sleep(2 ** attempt)
            continue

    if quota_hit:
        raise Exception(
            "You've hit Gemini's free-tier daily quota. Options: wait until it resets at midnight Pacific, "
            "switch to a smaller model (gemini-2.5-flash-lite), or enable billing at https://aistudio.google.com/app/apikey."
        )
    raise Exception(f"Gemini is overloaded — please retry in a moment. (last error: {last_err})")


def build_analyze_prompt(job_desc, resume_text):
    # Single mega-prompt that returns the ATS rubric output PLUS the JD keyword list PLUS
    # the hard-requirements assessment. Replaces 3 separate Gemini calls with 1.
    return f"""
You are a strict and honest ATS resume screening system used by Fortune 500 recruiters.

Analyze the resume against the job description with BRUTAL HONESTY, then ALSO return
(a) the JD's concrete keyword list and (b) the role's hard requirements with a met/unmet judgement.

SCORING RULES:
- 0-30%: Almost no relevance. Wrong field, missing most skills.
- 31-50%: Some transferable skills but major gaps.
- 51-65%: Moderate match. Some relevant skills but missing critical requirements.
- 66-75%: Decent match. Meets some requirements with noticeable gaps.
- 76-85%: Good match. Meets most requirements with minor gaps.
- 86-95%: Strong match. Closely aligned with nearly all requirements.
- 96-100%: Perfect match. Reserve for resumes that tick every requirement.

IMPORTANT:
- Most resumes score 40-75. Do NOT default to high scores.
- If the resume is for a different industry/role, score below 40.
- strengths: actual skills from the resume matching the job.
- missing_skills: specific skills/tools/keywords from the job description that are absent.
- ats_issues: real formatting or keyword problems in this specific resume.
- suggestions: actionable, specific to this resume and job.
- jd_skills: concrete skills/tools/technologies/competencies expected by the JD.
  Short keyword strings (max 18), deduplicated, no sentences.
  Example: ["Python", "GCP", "problem-solving", "REST APIs"].
- target_title: the role's title as named in the JD.
- hard_requirements: 4-6 must-haves (years of experience, required degree,
  mandatory certifications, or core required skills). For each, decide if the
  resume clearly satisfies it.

Return ONLY valid JSON in this exact shape:

{{
  "match_score": <integer 0-100>,
  "summary": "<2-3 sentence honest assessment>",
  "strengths": ["<specific matching skill>"],
  "missing_skills": ["<specific missing skill from job description>"],
  "ats_issues": ["<specific ATS issue>"],
  "suggestions": ["<specific actionable suggestion>"],
  "jd_skills": ["<short keyword>"],
  "target_title": "<role title>",
  "hard_requirements": [
    {{"requirement": "<short>", "met": true, "note": "<short reason>"}}
  ]
}}

JOB DESCRIPTION:
{job_desc}

RESUME:
{resume_text}
"""


def get_ats_score(job_desc, resume_text):
    # Re-run the SAME ATS rubric on a resume and return just the integer score (or None).
    try:
        text = call_ai(build_analyze_prompt(job_desc, (resume_text or "")[:6000]), temperature=0)
        parsed = json.loads(clean_json(text))
        return max(0, min(100, int(parsed.get("match_score"))))
    except Exception:
        return None


def batch_ats_scores(job_desc, named_resumes):
    """Score several resumes against the SAME JD in ONE Gemini call. Saves API quota.
    `named_resumes` is a list of (label, resume_text) tuples. Returns {label: int|None}."""
    if not named_resumes:
        return {}
    blocks = "\n\n".join(
        f"===== RESUME: {label} =====\n{(text or '')[:5000]}\n===== END RESUME: {label} ====="
        for label, text in named_resumes
    )
    labels = [lbl for lbl, _ in named_resumes]
    schema = ", ".join(f'"{lbl}": <integer 0-100>' for lbl in labels)

    prompt = f"""You are a strict ATS resume screening system.

Score EACH of the resumes below against the same JOB DESCRIPTION, using these rules:
- 0-30%: Almost no relevance.
- 31-50%: Some transferable skills, major gaps.
- 51-65%: Moderate match, missing critical requirements.
- 66-75%: Decent match with noticeable gaps.
- 76-85%: Good match with minor gaps.
- 86-95%: Strong match.
- 96-100%: Reserve for resumes that tick every requirement.

Most resumes score 40-75. Do NOT default to high scores. Be brutally honest and consistent across the resumes.

Return ONLY this JSON shape — one integer per resume label, no other keys:
{{ {schema} }}

JOB DESCRIPTION:
{(job_desc or '')[:4000]}

{blocks}
"""
    try:
        raw = call_ai(prompt, temperature=0)
        parsed = json.loads(clean_json(raw))
        out = {}
        for lbl in labels:
            try:
                out[lbl] = max(0, min(100, int(parsed.get(lbl))))
            except (TypeError, ValueError):
                out[lbl] = None
        return out
    except Exception:
        return {lbl: None for lbl in labels}


def extract_jd_skills(job_desc):
    # Ask the model for a clean keyword list from the JD; returns a list of short strings.
    try:
        prompt = (
            "From the JOB DESCRIPTION below, extract the concrete skills, tools, "
            "technologies, and key competencies the candidate is expected to have. "
            "Return ONLY a JSON array of short keyword strings (max 18), deduplicated, "
            "no sentences. Example: [\"Python\", \"GCP\", \"problem-solving\", \"REST APIs\"].\n\n"
            "JOB DESCRIPTION:\n" + (job_desc or "")[:4000]
        )
        raw = call_ai(prompt, temperature=0.1)
        raw = raw.replace("```json", "").replace("```", "").strip()
        i, j = raw.find("["), raw.rfind("]")
        arr = json.loads(raw[i:j + 1]) if i != -1 and j != -1 else []
        out, seen = [], set()
        for x in arr:
            x = str(x).strip()
            if x and x.lower() not in seen:
                seen.add(x.lower())
                out.append(x)
        return out[:18]
    except Exception:
        return []


SYNONYM_GROUPS = [
    # Languages / runtimes
    {"js", "javascript", "ecmascript"},
    {"ts", "typescript"},
    {"py", "python", "python3"},
    {"node", "nodejs"},
    {"golang", "go"},
    {"csharp", "c#", "dotnet", ".net"},
    {"cpp", "c++"},
    {"objective c", "objc"},
    # Front-end frameworks
    {"react", "reactjs"},
    {"vue", "vuejs"},
    {"angular", "angularjs"},
    {"nextjs", "next"},
    {"nuxt", "nuxtjs"},
    {"svelte", "sveltejs"},
    # Back-end / data
    {"express", "expressjs"},
    {"fastapi"},
    {"django"},
    {"flask"},
    {"spring", "spring boot", "springboot"},
    {"rails", "ruby on rails", "ror"},
    # Cloud
    {"gcp", "google cloud", "google cloud platform"},
    {"aws", "amazon web services"},
    {"azure", "microsoft azure"},
    {"oci", "oracle cloud"},
    # Infra / DevOps
    {"k8s", "kubernetes"},
    {"docker", "containerization", "containers"},
    {"terraform", "iac", "infrastructure as code"},
    {"ci/cd", "cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"},
    {"github actions", "gh actions"},
    {"gitlab ci"},
    {"jenkins"},
    # Databases
    {"postgres", "postgresql", "psql"},
    {"mongo", "mongodb"},
    {"mysql"},
    {"mssql", "sql server", "microsoft sql server"},
    {"sqlite"},
    {"redis"},
    {"elasticsearch", "elastic search", "elk"},
    {"snowflake"},
    {"bigquery", "big query"},
    {"redshift"},
    {"nosql", "no sql"},
    # Web / API
    {"rest", "restful", "rest api", "rest apis", "restful api", "restful apis"},
    {"graphql", "graph ql"},
    {"grpc"},
    {"websocket", "websockets", "web socket"},
    {"oauth", "oauth2", "oauth 2"},
    {"jwt", "json web token"},
    # AI / data
    {"ml", "machine learning"},
    {"ai", "artificial intelligence"},
    {"nlp", "natural language processing"},
    {"dl", "deep learning"},
    {"cv", "computer vision"},
    {"llm", "large language model", "large language models", "llms"},
    {"genai", "generative ai", "gen ai"},
    {"rag", "retrieval augmented generation", "retrieval-augmented generation"},
    {"tensorflow", "tf"},
    {"pytorch", "torch"},
    {"sklearn", "scikit-learn", "scikit learn"},
    {"pandas"},
    {"numpy"},
    {"jupyter", "jupyter notebook", "jupyter notebooks"},
    {"power bi", "powerbi"},
    {"tableau"},
    {"etl", "elt", "data pipelines"},
    {"airflow", "apache airflow"},
    {"spark", "apache spark", "pyspark"},
    {"kafka", "apache kafka"},
    {"hadoop"},
    # Methodologies
    {"oop", "object oriented programming", "object-oriented programming"},
    {"tdd", "test driven development", "test-driven development"},
    {"bdd", "behavior driven development", "behaviour driven development"},
    {"ddd", "domain driven design"},
    {"agile", "scrum", "kanban"},
    {"saas", "software as a service"},
    {"paas", "platform as a service"},
    {"iaas", "infrastructure as a service"},
    # Design / UX
    {"ux", "user experience"},
    {"ui", "user interface"},
    {"figma"},
    {"sketch"},
    {"adobe xd", "xd"},
    # Mobile
    {"ios"},
    {"android"},
    {"react native", "reactnative"},
    {"flutter"},
    # Tooling
    {"git", "version control"},
    {"github"},
    {"gitlab"},
    {"bitbucket"},
    {"jira"},
    {"confluence"},
    # Soft skills (loose canonicalization)
    {"communication", "communication skills", "verbal communication", "written communication"},
    {"leadership", "leading teams", "team leadership"},
    {"problem solving", "problem-solving", "problemsolving"},
    {"teamwork", "team work", "collaboration", "team player"},
    {"critical thinking", "analytical thinking"},
    {"time management"},
    {"stakeholder management", "stakeholder engagement"},
    {"mentoring", "mentorship", "coaching"},
]


def _norm_kw(t):
    """Lowercase + collapse separators so 'React.js', 'reactjs', 'react js' all map to the same form."""
    t = (t or "").lower().strip()
    t = re.sub(r"[._\-/]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _build_synonym_map():
    m = {}
    for grp in SYNONYM_GROUPS:
        canon = sorted(grp, key=len)[0]
        for term in grp:
            m[_norm_kw(term)] = canon
    return m


SYNONYM_MAP = _build_synonym_map()
# canonical → all surface forms in that group, sorted longest-first (so we match
# "google cloud platform" before "gcp" when both could plausibly hit).
_GROUP_VARIANTS = {}
for _g in SYNONYM_GROUPS:
    _canon = sorted(_g, key=len)[0]
    _GROUP_VARIANTS[_canon] = sorted(_g, key=len, reverse=True)


def _variants_of(keyword):
    """Return all known surface forms of `keyword` (including itself)."""
    nk = _norm_kw(keyword)
    canon = SYNONYM_MAP.get(nk)
    if canon is None:
        return [keyword.strip().lower()]
    return list(set(_GROUP_VARIANTS[canon] + [keyword.strip().lower()]))


def _has_token(haystack_lower, needle):
    """Word-boundary substring check. Avoids 'ai' matching inside 'training'."""
    needle = needle.strip().lower()
    if not needle:
        return False
    # allow +, #, . inside tokens (so 'c++', 'c#', '.net', 'node.js' survive)
    pattern = r"(?<![A-Za-z0-9])" + re.escape(needle) + r"(?![A-Za-z0-9])"
    return bool(re.search(pattern, haystack_lower))


def _kw_present(resume_text, keyword):
    if not keyword:
        return True
    k = str(keyword).strip().lower()
    if not k:
        return True

    rl = (resume_text or "").lower()
    rl_norm = re.sub(r"[._\-/]", "", rl)  # for matching 'reactjs' against 'react.js'

    # Try the keyword + every known synonym, with word-boundary matching.
    for v in _variants_of(keyword):
        if _has_token(rl, v):
            return True
        # also check the normalized text so "reactjs" matches "react.js" and vice-versa
        nv = _norm_kw(v)
        if nv and nv != v and _has_token(rl_norm, nv):
            return True

    # Multi-word JD phrase: require every meaningful word to appear somewhere.
    words = [w for w in re.split(r"[^a-z0-9+#.]+", k) if len(w) > 2]
    if len(words) >= 2 and all(_has_token(rl, w) for w in words):
        return True

    return False


def compute_missing(jd_skills, resume_text):
    return [s for s in (jd_skills or []) if not _kw_present(resume_text, s)]


def _classify_for_version(jd_skills, original_text, version_text):
    """For each JD skill, label it as added (only in version), matched (in both), or missing."""
    added, matched, missing = [], [], []
    for k in jd_skills or []:
        k = str(k).strip()
        if len(k) < 2:
            continue
        in_v = _kw_present(version_text, k)
        in_o = _kw_present(original_text, k)
        if in_v and not in_o:
            added.append(k)
        elif in_v and in_o:
            matched.append(k)
        else:
            missing.append(k)
    return {"added": added, "matched": matched, "missing": missing}


def keyword_coverage(jd_skills, missing):
    total = len(jd_skills) if jd_skills else 0
    if not total:
        return {"score": None, "present": 0, "total": 0, "note": "No job keywords detected."}
    present = total - len(missing)
    return {"score": round(100 * present / total), "present": present, "total": total,
            "note": f"{present} of {total} job keywords present in your resume."}


def ats_format_checks(resume_text):
    t = resume_text or ""
    tl = t.lower()
    words = len(t.split())
    checks = []
    has_email = bool(re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", t))
    has_phone = bool(re.search(r"(\+?\d[\d\s().-]{7,}\d)", t))
    if has_email and has_phone:
        checks.append({"check": "Contact details", "status": "pass", "note": "Email and phone detected."})
    elif has_email or has_phone:
        checks.append({"check": "Contact details", "status": "warn", "note": "Add both an email and a phone number."})
    else:
        checks.append({"check": "Contact details", "status": "fail", "note": "No email/phone found - ATS needs these to contact you."})
    found = [h for h in ("experience", "education", "skill") if h in tl]
    checks.append({"check": "Standard section headings",
                   "status": "pass" if len(found) >= 3 else ("warn" if len(found) == 2 else "fail"),
                   "note": "Clear Experience / Education / Skills headings help ATS parse your resume."})
    nums = len(re.findall(r"\d+%|\$\d+|\b\d{2,}\b", t))
    checks.append({"check": "Quantified achievements",
                   "status": "pass" if nums >= 3 else ("warn" if nums >= 1 else "fail"),
                   "note": (str(nums) + " measurable figures found.") if nums else "Add numbers (%, $, counts) to show impact."})
    checks.append({"check": "Resume length",
                   "status": "pass" if 250 <= words <= 1200 else "warn",
                   "note": str(words) + " words (aim for ~400-900)."})
    checks.append({"check": "Machine-readable text",
                   "status": "pass" if words > 80 else "fail",
                   "note": "Text extracted cleanly." if words > 80 else "Very little text - resume may be a scanned image ATS cannot read."})
    return checks


def title_alignment(target_title, resume_text):
    tt = (target_title or "").strip()
    rl = (resume_text or "").lower()
    if not tt:
        return {"target_title": "", "status": "warn", "note": "Could not detect the job title."}
    present = _kw_present(rl, tt)
    return {"target_title": tt,
            "status": "pass" if present else "warn",
            "note": ("Resume references this title or a close variant." if present
                     else "Mirror this exact title in your summary if it is accurate for you.")}


def compute_readiness(kw, fmt_checks, hard_reqs, title):
    num = den = 0.0
    if kw.get("score") is not None:
        num += kw["score"] * 0.4; den += 0.4
    if fmt_checks:
        passed = sum(1 for c in fmt_checks if c.get("status") == "pass")
        num += (100.0 * passed / len(fmt_checks)) * 0.2; den += 0.2
    if hard_reqs:
        met = sum(1 for r in hard_reqs if r.get("met"))
        num += (100.0 * met / len(hard_reqs)) * 0.3; den += 0.3
    num += (100 if title.get("status") == "pass" else 50) * 0.1; den += 0.1
    return round(num / den) if den else None


def assess_requirements(job_desc, resume_text):
    # AI extracts the job title + 4-6 hard/knockout requirements and judges if the resume meets each.
    try:
        prompt = (
            "Compare the RESUME to the JOB DESCRIPTION. Identify the role's TITLE and its 4-6 "
            "HARD requirements (must-haves: years of experience, required degree, mandatory "
            "certifications, or core required skills). For each, decide if the resume clearly "
            "satisfies it. Return ONLY JSON:\n"
            '{"target_title": "<job title>", "hard_requirements": [{"requirement": "<short>", "met": true, "note": "<short reason>"}]}\n\n'
            "JOB DESCRIPTION:\n" + (job_desc or "")[:3500] +
            "\n\nRESUME:\n" + (resume_text or "")[:5000]
        )
        parsed = json.loads(clean_json(call_ai(prompt, temperature=0.1)))
        title = str(parsed.get("target_title", "")).strip()
        reqs = []
        for r in (parsed.get("hard_requirements") or [])[:6]:
            req = str(r.get("requirement", "")).strip()
            if req:
                reqs.append({"requirement": req, "met": bool(r.get("met")), "note": str(r.get("note", "")).strip()})
        return title, reqs
    except Exception:
        return "", []


@app.route("/")
def home():
    return jsonify({"status": "ForgeResume API is running"})


# =========================
# 1. ANALYZE RESUME
# =========================

@app.route("/analyze", methods=["POST"])
def analyze():
    file_path = None
    try:
        # Two input modes: a file upload (multipart) OR raw resume text (JSON,
        # used by the "Build from scratch" flow).
        if request.is_json:
            data = request.get_json(silent=True) or {}
            resume_text = (data.get("resume_text") or "").strip()
            job_desc = (data.get("job_description") or "").strip()
            if not resume_text:
                return jsonify({"success": False, "error": "No resume text"}), 400
            if not job_desc:
                return jsonify({"success": False, "error": "No job description"}), 400
            resume_text = resume_text[:6000]
        else:
            if "resume" not in request.files:
                return jsonify({"success": False, "error": "No resume uploaded"}), 400

            resume = request.files["resume"]
            job_desc = request.form.get("job_description")

            if not job_desc:
                return jsonify({"success": False, "error": "No job description"}), 400

            if not allowed_file(resume.filename):
                return jsonify({"success": False, "error": "Only PDF/DOCX allowed"}), 400

            file_path = save_file(resume)
            resume_text = extract_text(file_path)
            resume_text = resume_text[:6000]

        # ONE Gemini call returns everything: ATS rubric output + jd_skills + target_title + hard_requirements
        prompt = build_analyze_prompt(job_desc, resume_text)
        ai_text = call_ai(prompt, temperature=0.1)
        ai_text = clean_json(ai_text)
        try:
            parsed = json.loads(ai_text)
        except:
            raise Exception("Invalid JSON from AI:\n" + ai_text)

        # Clean up jd_skills + dedupe (mirror what extract_jd_skills used to do).
        raw_jd = parsed.get("jd_skills") or []
        jd_skills, seen = [], set()
        for x in raw_jd:
            x = str(x).strip()
            if x and x.lower() not in seen:
                seen.add(x.lower())
                jd_skills.append(x)
        jd_skills = jd_skills[:18]
        parsed["jd_skills"] = jd_skills

        missing_kw = compute_missing(jd_skills, resume_text)
        parsed["missing_keywords"] = missing_kw

        # Hard requirements + title come from the same JSON now.
        target_title = str(parsed.get("target_title", "")).strip()
        hard_reqs = []
        for r in (parsed.get("hard_requirements") or [])[:6]:
            req = str(r.get("requirement", "")).strip()
            if req:
                hard_reqs.append({
                    "requirement": req,
                    "met": bool(r.get("met")),
                    "note": str(r.get("note", "")).strip(),
                })

        kw = keyword_coverage(jd_skills, missing_kw)
        fmt_checks = ats_format_checks(resume_text)
        title_align = title_alignment(target_title, resume_text)
        parsed["ats_report"] = {
            "readiness": compute_readiness(kw, fmt_checks, hard_reqs, title_align),
            "keyword": kw,
            "format_checks": fmt_checks,
            "hard_requirements": hard_reqs,
            "title": title_align,
        }

        return jsonify({
            "success": True,
            "analysis": parsed,
            "resume_text": resume_text
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        delete_file(file_path)


# =========================
# 2. REWRITE RESUME
# =========================

@app.route("/rewrite", methods=["POST"])
def rewrite_resume():
    try:
        data = request.json
        resume_text = data.get("resume_text")
        job_desc = data.get("job_description")
        suggestions = data.get("suggestions")
        missing_skills = data.get("missing_skills")
        template = data.get("template")

        prompt = f"""
You are an expert resume writer. Rewrite this resume using the given template.

RULES:
- Do NOT fabricate experience
- Improve ATS optimization
- Follow template strictly

JOB: {job_desc}
MISSING SKILLS: {missing_skills}
SUGGESTIONS: {suggestions}
TEMPLATE: {template}
ORIGINAL RESUME: {resume_text}

Return ONLY rewritten resume text.
"""

        rewritten = call_ai(prompt, temperature=0.6)
        return jsonify({"success": True, "rewritten_resume": rewritten})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================
# 3. GENERATE TEMPLATES
# =========================

@app.route("/templates", methods=["POST"])
def generate_templates():
    try:
        data = request.json
        job_desc = data.get("job_description")

        prompt = f"""
Create 3 ATS-friendly resume templates. Each must include name, structure, style description.

JOB: {job_desc}

Return ONLY JSON:
{{
  "templates": [
    {{ "name": "", "structure": [], "style": "" }}
  ]
}}
"""

        content = call_ai(prompt, temperature=0.7)
        content = clean_json(content)
        return jsonify({"success": True, "templates": json.loads(content)})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================
# 4. REGENERATE TEMPLATE
# =========================

@app.route("/regenerate-template", methods=["POST"])
def regenerate_template():
    try:
        data = request.json
        job_desc = data.get("job_description")

        prompt = f"""
Generate ONE new ATS resume template. Make it unique and structured.

JOB: {job_desc}

Return JSON:
{{ "name": "", "structure": [], "style": "" }}
"""

        content = call_ai(prompt, temperature=0.9)
        content = clean_json(content)
        return jsonify({"success": True, "template": json.loads(content)})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================
# 5. FORGE RESUME (AI CRAFT)
# =========================

@app.route("/forge", methods=["POST"])
def forge_resume():
    try:
        data = request.json
        resume_text = data.get("resume_text", "").strip()
        job_desc = data.get("job_description", "").strip()
        analysis = data.get("analysis", {})

        if not resume_text or len(resume_text) < 50:
            return jsonify({
                "success": False,
                "error": "Resume text is missing or too short. Please upload your resume and run analysis first."
            }), 400

        if not job_desc:
            return jsonify({
                "success": False,
                "error": "Job description is missing."
            }), 400

        strengths   = ", ".join(analysis.get("strengths", []))
        missing     = ", ".join(analysis.get("missing_skills", []))
        suggestions = ", ".join(analysis.get("suggestions", []))
        ats_issues  = ", ".join(analysis.get("ats_issues", []))
        score       = analysis.get("match_score", "unknown")

        confirmed = data.get("confirmed_skills", []) or []
        confirmed_reqs = data.get("confirmed_requirements", []) or []
        jd_skills = data.get("jd_skills", []) or []

        # Merge confirmed skills + requirements into ONE list (deduped). The real
        # distinction is hard-skill vs soft-skill, which the model decides per item.
        all_confirmed = []
        seen = set()
        for c in list(confirmed) + list(confirmed_reqs):
            c = str(c).strip()
            if c and c.lower() not in seen:
                seen.add(c.lower())
                all_confirmed.append(c)

        if all_confirmed:
            items = "\n".join("- " + c for c in all_confirmed)
            confirmed_block = (
                "The candidate has CONFIRMED they genuinely have ALL of the following, even though "
                "they are missing from the original resume. These confirmed items are the ONLY "
                "exception to the 'no new technology' rule. You MUST reflect EVERY item below in BOTH "
                "rewritten versions - do NOT skip any, and do NOT just paste the sentence verbatim.\n\n"
                "CONFIRMED ITEMS:\n" + items + "\n\n"
                "Decide where each item goes:\n"
                "1) If it names a concrete tool / technology / language / platform "
                "(e.g. 'Experience with GCP/BigQuery'), pull out the TOOL NAMES themselves "
                "(e.g. 'GCP', 'BigQuery') and add them to the skills section - whatever it is named "
                "(Skills / Technical Skills / Core Skills / Key Skills / Skill Set / Technical "
                "Competencies / Areas of Expertise). If there is NO skills section, CREATE a "
                "'Technical Skills' section. Strip filler words like 'Experience with', 'Proficiency "
                "in', 'Knowledge of', 'Familiarity with'.\n"
                "2) If it is a soft skill / competency / behaviour "
                "(e.g. 'Demonstrated ability to break down ambiguous problems', 'Clear communication "
                "of ideas to non-technical teammates'), do NOT put the sentence in the skills list. "
                "Instead weave it naturally into the Professional Summary, and optionally into a "
                "relevant Experience bullet ONLY if it stays truthful.\n"
                "Do NOT attach any confirmed item to a specific past project or job as if it was used "
                "there, and do NOT invent metrics, dates, employers, institutions, or project names - "
                "only reflect the fact the candidate confirmed."
            )
        else:
            confirmed_block = (
                "No additional user-confirmed skills or requirements were provided. Do NOT add any skill "
                "or technology that is not already present in the original resume."
            )

        prompt = f"""You are an expert resume editor. Your job is to produce TWO tailored versions of the resume below for the target job. You must follow the STRICT EDITING RULES — they override any other instinct.

===== ORIGINAL RESUME =====
{resume_text}
===== END ORIGINAL RESUME =====

===== TARGET JOB DESCRIPTION =====
{job_desc}
===== END JOB DESCRIPTION =====

Prior ATS scan results:
- Current match score: {score}%
- Existing strengths: {strengths}
- Missing skills: {missing}
- ATS issues: {ats_issues}
- Improvement suggestions: {suggestions}

============================
EDITING RULES (MANDATORY — these override any other instinct)
============================

You MAY rewrite and optimize the WORDING of any section for ATS keyword matching and
clear, scannable, ATS-friendly writing: Professional Summary, Technical Skills,
Experience / Work History, Projects, Education, and Certifications.

THE ONE ABSOLUTE RULE — NEVER CHANGE THE FACTS OR THE TECHNOLOGIES:
- Do NOT change, add, remove, or swap ANY technology, tool, programming language,
  framework, library, platform, cloud service, or product named in a project or job.
  Every project and job MUST keep EXACTLY the same tech stack the candidate listed.
  Example: if a project used "Python and GCP", the rewrite must still name only
  "Python and GCP" — you may NOT add AWS, Kubernetes, or anything the JD wants but the
  candidate did not actually use there.
- Do NOT move a technology from one project/job into another.
- Do NOT introduce any tool or technology that does not already appear in the resume.
- Do NOT fabricate or alter metrics or numbers (e.g. "improved by 50%", "10,000+ users").
- Do NOT change company names, job titles, dates, degrees, GPAs, institutions, or
  certification names/years.
- Do NOT invent new projects, jobs, certifications, or sections. Do NOT delete existing
  ones. Keep the SAME section order and the SAME section headers as the original.

WHAT YOU MAY DO (this is the whole point):
- Reword bullets using stronger, ATS-friendly action verbs and the JD's phrasing.
- Surface responsibilities and outcomes the candidate ALREADY performed, described in
  language that mirrors the job description's keywords — only where it is truthful.
- ALWAYS revise the skills section: reorder so the most JD-relevant skills appear first, group
  them sensibly, and make sure every user-confirmed skill is present and visible. You may add a
  skill ONLY if the candidate clearly already used it elsewhere in this resume or confirmed it.
- Tighten phrasing so the SAME facts read as keyword-rich and concise.
- Mirror the target job title in the Professional Summary if it is accurate for the candidate.
- Open Experience and Project bullets with strong, varied action verbs.
- Keep clear, standard section headings (Experience, Projects, Education, Skills).
- The first time an acronym ALREADY in the resume appears, you MAY expand it once for ATS
  matching, e.g. "Google Cloud Platform (GCP)" - only for acronyms the candidate already used.
- Keep every JD keyword in natural context; never produce a stuffed list of unrelated terms.

RULE OF THUMB: a recruiter comparing the original and the rewrite must see the SAME
facts, the SAME technologies, and the SAME accomplishments — only described in clearer,
more keyword-aligned language. Same truth, better wording.

{confirmed_block}

VERSION 1 — "Precision Version" (ATS-First):
- Maximize truthful JD-keyword coverage within the rules above.
- Dense, direct, scannable phrasing across Summary, Skills, Experience, and Projects.

VERSION 2 — "Impact Version" (Human-First):
- Same factual constraints; the same technologies preserved everywhere.
- Warmer, achievement-led phrasing that still covers the JD keywords.

Return ONLY valid JSON — no markdown, no preamble, no explanation outside the JSON:

{{
  "insights": {{
    "first_impression": "Honest 2-sentence assessment of the original resume vs this job",
    "top_weakness": "The single biggest gap between the original resume and this job",
    "keyword_gaps": "5 most critical JD keywords now reflected in the rewrite",
    "achievement_tip": "What wording was strengthened across the resume and why it helps ATS"
  }},
  "version1": {{
    "score": <integer 85-98>,
    "full_resume": "<Complete resume as plain text with \\n for line breaks — every technology, metric, company, title, and date preserved exactly; only the wording optimized for ATS>"
  }},
  "version2": {{
    "score": <integer 85-98>,
    "full_resume": "<Complete resume as plain text with \\n for line breaks — every technology, metric, company, title, and date preserved exactly; only the wording optimized for ATS>"
  }},
  "recommendation": "Which version to submit where, given both contain the same facts and technologies"
}}"""

        ai_text = call_ai(prompt, temperature=0.2)
        ai_text = clean_json(ai_text)

        try:
            parsed = json.loads(ai_text)
        except Exception as parse_err:
            raise Exception(f"Invalid JSON from AI: {str(parse_err)}\nRaw output: {ai_text[:600]}")

        # --- Re-score both rewritten versions (and the original if needed) with the
        #     SAME ATS rubric, in a SINGLE Gemini call to conserve API quota. ---
        try:
            before_score = int(score)
        except (TypeError, ValueError):
            before_score = None

        _v1_text = (parsed.get("version1") or {}).get("full_resume", "")
        _v2_text = (parsed.get("version2") or {}).get("full_resume", "")

        to_score = [("version1", _v1_text), ("version2", _v2_text)]
        if not before_score or before_score <= 0:
            to_score.append(("original", resume_text))

        scores = batch_ats_scores(job_desc, to_score)
        for _key in ("version1", "version2"):
            _ver = parsed.get(_key) or {}
            if scores.get(_key) is not None:
                _ver["score"] = scores[_key]
            parsed[_key] = _ver
        if "original" in scores and scores["original"] is not None:
            before_score = scores["original"]

        parsed["original_score"] = before_score

        # Deterministic keyword report so the UI matches reality (no AI guesswork).
        # Compute per-version classifications using the synonym-aware matcher so the
        # highlighting on the frontend agrees with the backend's coverage numbers.
        _v1 = (parsed.get("version1") or {}).get("full_resume", "")
        _v2 = (parsed.get("version2") or {}).get("full_resume", "")
        v1_class = _classify_for_version(jd_skills, resume_text, _v1)
        v2_class = _classify_for_version(jd_skills, resume_text, _v2)
        parsed["v1_classification"] = v1_class
        parsed["v2_classification"] = v2_class
        # Backwards-compatible fields used by the insights panel.
        parsed["keywords_added"] = v1_class["added"]
        parsed["keywords_remaining"] = v1_class["missing"]

        return jsonify({"success": True, "result": parsed})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# =========================
# 6. EXTRACT RESUME TEXT
# =========================

@app.route("/extract", methods=["POST"])
def extract_resume():
    file_path = None
    try:
        if "resume" not in request.files:
            return jsonify({"success": False, "error": "No resume uploaded"}), 400

        resume = request.files["resume"]

        if not allowed_file(resume.filename):
            return jsonify({"success": False, "error": "Only PDF/DOCX allowed"}), 400

        file_path = save_file(resume)
        resume_text = extract_text(file_path)

        return jsonify({
            "success": True,
            "resume_text": resume_text
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        delete_file(file_path)



# ===============================================
# 6b. PARSE RESUME → STRUCTURED FORM (autofill)
# ===============================================

# The schema below MUST stay in lock-step with the field IDs in the
# "Start from Scratch" form in templates/index.html.
RESUME_FORM_SCHEMA = """{
  "name": "",
  "role": "",
  "mobile": "",
  "email": "",
  "linkedin": "",
  "github": "",
  "summary": "",
  "education": {
    "pg":     {"course": "", "institution": "", "year": "", "score": ""},
    "ug":     {"course": "", "institution": "", "year": "", "score": ""},
    "school": {"course": "", "institution": "", "year": "", "score": ""}
  },
  "skills": [],
  "internships": [
    {"role": "", "company": "", "duration": "", "location": "", "description": ""}
  ],
  "projects": [
    {"name": "", "tech": "", "description": ""}
  ],
  "certifications": [],
  "hobbies": ""
}"""


@app.route("/parse-resume", methods=["POST"])
def parse_resume_to_form():
    file_path = None
    try:
        if "resume" not in request.files:
            return jsonify({"success": False, "error": "No resume uploaded"}), 400

        resume = request.files["resume"]
        if not allowed_file(resume.filename):
            return jsonify({"success": False, "error": "Only PDF/DOCX allowed"}), 400

        file_path = save_file(resume)
        resume_text = extract_text(file_path)
        if not resume_text or len(resume_text.split()) < 30:
            return jsonify({"success": False,
                            "error": "Could not read enough text from this file. If it's a scanned PDF, install Tesseract for OCR."}), 400

        prompt = (
            "Extract this candidate's details from the RESUME below into JSON.\n"
            "Return ONLY valid JSON in EXACTLY the shape shown — no markdown, no commentary.\n"
            "Rules:\n"
            "- Use an empty string \"\" or empty array [] for anything the resume does not clearly state. NEVER invent details.\n"
            "- For 'pg' use the highest postgraduate degree (Masters / PhD). For 'ug' use the bachelors. For 'school' use diploma / intermediate / SSC / high school.\n"
            "- For internships and projects, put bullet points in the 'description' field separated by newlines (one bullet per line, no leading dash).\n"
            "- 'skills' is a flat list of short skill strings (no sentences).\n"
            "- 'certifications' is a flat list of certificate names (include year if shown).\n"
            "- 'role' = the candidate's current/target job title if clearly stated in a headline or summary; otherwise \"\".\n\n"
            f"SHAPE:\n{RESUME_FORM_SCHEMA}\n\n"
            "RESUME:\n" + resume_text[:6000]
        )

        raw = call_ai(prompt, temperature=0)
        data = json.loads(clean_json(raw))
        return jsonify({"success": True, "data": data, "resume_text": resume_text})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

    finally:
        delete_file(file_path)


# =========================
# 7. RENDER RESUME PDF  (server-side, exact rendering via Chromium)
# =========================

@app.route("/render-pdf", methods=["POST"])
def render_pdf():
    try:
        data = request.json or {}
        html = data.get("html", "")
        filename = data.get("filename", "resume")

        if not html or len(html) < 20:
            return jsonify({"success": False, "error": "No HTML provided"}), 400

        return jsonify({
            "success": True,
            "html": html,
            "filename": filename
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

        from weasyprint import HTML
        pdf_bytes = HTML(string=html).write_pdf()

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"{filename}.pdf",
        )

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

        


# =========================
# RUN APP
# =========================

if __name__ == "__main__":
    app.run(debug=True)
