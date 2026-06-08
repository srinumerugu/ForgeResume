history.scrollRestoration = 'manual';

let uploadedFile = null;
let currentAnalysis = null;
let currentResumeText = '';
let currentJobDesc = '';
let confirmedSkills = [];
let confirmedRequirements = [];
let versionTexts = { 1: '', 2: '' };

window.onload = function() {
  window.scrollTo(0, 0);
  uploadedFile = null;
  fileInput.value = '';
  renderUploadBox();
};

// ================================
// UPLOAD BOX
// ================================
const uploadBox = document.getElementById('uploadSection');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.pdf,.doc,.docx';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

function renderUploadBox() {
  uploadBox.innerHTML = `
    <div class="w-20 h-20 rounded-3xl bg-blue-100 flex items-center justify-center mx-auto mb-6 text-4xl" aria-hidden="true">📄</div>
    <h3 class="text-2xl font-bold mb-3">Upload Resume</h3>
    <p class="text-slate-500 mb-6">PDF or DOCX files up to 10MB</p>
    <button id="chooseFileBtn" type="button" class="px-6 py-3 rounded-2xl bg-slate-900 text-white font-semibold hover:scale-105 transition">Choose File</button>
  `;
  document.getElementById('chooseFileBtn').addEventListener('click', () => fileInput.click());
}
renderUploadBox();

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  uploadedFile = file;
  // FIX: Reset stored resume text when a new file is chosen
  currentResumeText = '';
  currentAnalysis = null;
  uploadBox.innerHTML = `
    <div class="w-20 h-20 rounded-3xl bg-emerald-100 flex items-center justify-center mx-auto mb-6 text-4xl" aria-hidden="true">✅</div>
    <h3 class="text-2xl font-bold mb-3 text-emerald-600">Resume Uploaded</h3>
    <p class="text-slate-600 mb-8 break-all">${file.name}</p>
    <div class="flex gap-4 justify-center">
      <button id="changeFileBtn" type="button" class="px-6 py-3 rounded-2xl bg-blue-600 text-white font-semibold">Change File</button>
      <button id="removeFileBtn" type="button" class="px-6 py-3 rounded-2xl bg-red-100 text-red-600 font-semibold">Remove</button>
    </div>
  `;
  document.getElementById('changeFileBtn').addEventListener('click', () => fileInput.click());
  document.getElementById('removeFileBtn').addEventListener('click', () => {
    uploadedFile = null;
    currentResumeText = '';
    currentAnalysis = null;
    fileInput.value = '';
    renderUploadBox();
  });
});

// ================================
// POPUP MODAL
// ================================
const popup = document.getElementById("popupModal");
const popupTitle = document.getElementById("popupTitle");
const popupContent = document.getElementById("popupContent");

function openPopup(title, contentArray) {
  popupTitle.innerText = title;
  popupContent.innerHTML = contentArray.map(item => `<div class="p-3 bg-slate-100 rounded-xl">${item}</div>`).join("");
  popup.classList.remove("hidden");
}

document.getElementById("closePopup").addEventListener("click", () => popup.classList.add("hidden"));
popup.addEventListener("click", (e) => { if (e.target === popup) popup.classList.add("hidden"); });

// ================================
// GET STARTED SCROLL
// ================================
document.getElementById('getStartedBtn').addEventListener('click', () => {
  uploadBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  uploadBox.classList.add('ring-4', 'ring-blue-400');
  setTimeout(() => uploadBox.classList.remove('ring-4', 'ring-blue-400'), 2000);
});

// ================================
// ANALYZE RESUME
// ================================
document.getElementById('analyzeResumeBtn').addEventListener('click', async () => {
  const jobDescription = document.getElementById('jobDescription').value;

  if (!uploadedFile) {
    openPopup("Resume Missing 🤖", ["Please upload your resume file so I can start scanning."]);
    return;
  }
  if (!jobDescription.trim()) {
    openPopup("Job Description Missing 🧠", ["Paste a job description so I know what standard we're aiming for."]);
    return;
  }

  const loading = document.createElement('div');
  loading.id = 'loadingScreen';
  loading.innerHTML = `
    <div class="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center px-6">
      <div class="bg-white rounded-[40px] p-12 max-w-xl w-full text-center">
        <div class="relative w-40 h-40 mx-auto mb-10">
          <div class="absolute inset-0 rounded-full border-[10px] border-blue-100"></div>
          <div class="absolute inset-0 rounded-full border-[10px] border-transparent border-t-blue-600 animate-spin"></div>
          <div class="absolute inset-6 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center text-white text-5xl" aria-hidden="true">🤖</div>
        </div>
        <h2 id="loadingTitle" class="text-4xl font-extrabold mb-5">Reading Resume...</h2>
        <p class="text-slate-600 text-lg">AI is extracting resume information.</p>
        <div class="mt-8 w-full h-4 bg-slate-200 rounded-full overflow-hidden">
          <div id="progressBar" class="h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-500" style="width:10%"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(loading);
  const title = document.getElementById('loadingTitle');
  const progress = document.getElementById('progressBar');

  setTimeout(() => { title.innerText = 'Scanning Skills...'; progress.style.width = '40%'; }, 1500);
  setTimeout(() => { title.innerText = 'Checking ATS Compatibility...'; progress.style.width = '70%'; }, 3000);

  try {
    const formData = new FormData();
    formData.append('resume', uploadedFile);
    formData.append('job_description', jobDescription);

    const response = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!data.success) {
      loading.remove();
      openPopup("Error", [data.error || 'Analysis failed']);
      return;
    }

    title.innerText = 'Generating Final Report...';
    progress.style.width = '100%';

    // FIX: Store all three values reliably from the analyze response
    currentAnalysis = data.analysis;
    currentResumeText = data.resume_text || '';
    currentJobDesc = jobDescription;

    setTimeout(() => {
      loading.remove();
      const analysis = data.analysis;
      const oldResult = document.getElementById('analysisResult');
      if (oldResult) oldResult.remove();

      const resultDiv = document.createElement('div');
      resultDiv.id = 'analysisResult';
      resultDiv.className = 'max-w-7xl mx-auto px-8 pb-24';
      resultDiv.innerHTML = `
        <div class="glass-card rounded-[40px] p-10 mt-20">
          <div class="text-center mb-14">
            <div class="w-28 h-28 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-8 text-6xl" aria-hidden="true">📊</div>
            <h2 class="text-5xl font-extrabold mb-5">ATS Analysis Result</h2>
          </div>
          <div class="mb-12">
            <div class="flex justify-between mb-4">
              <h3 class="text-3xl font-bold">Match Score</h3>
              <span class="text-4xl font-extrabold text-blue-600">${analysis.match_score}%</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-7 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-1000" style="width:${analysis.match_score}%"></div>
            </div>
          </div>
          ${atsReportHtml(analysis.ats_report)}
          <div class="mb-12">
            <h3 class="text-3xl font-bold mb-5">Professional Summary</h3>
            <div class="bg-slate-100 rounded-3xl p-8 text-lg text-slate-700">${analysis.summary}</div>
          </div>
          <div class="grid lg:grid-cols-2 gap-10 mb-12">
            <div class="bg-emerald-50 rounded-3xl p-8">
              <h3 class="text-3xl font-bold text-emerald-700 mb-6">✔ Strengths</h3>
              ${analysis.strengths.map(item => `<div class="bg-white p-5 rounded-2xl mb-4">${item}</div>`).join('')}
            </div>
            <div class="bg-red-50 rounded-3xl p-8">
              <h3 class="text-3xl font-bold text-red-700 mb-6">✖ Missing Skills</h3>
              ${analysis.missing_skills.map(item => `<div class="bg-white p-5 rounded-2xl mb-4">${item}</div>`).join('')}
            </div>
            <div class="bg-yellow-50 rounded-3xl p-8">
              <h3 class="text-3xl font-bold text-yellow-700 mb-6">⚠ ATS Issues</h3>
              ${analysis.ats_issues.map(item => `<div class="bg-white p-5 rounded-2xl mb-4">${item}</div>`).join('')}
            </div>
            <div class="bg-blue-50 rounded-3xl p-8">
              <h3 class="text-3xl font-bold text-blue-700 mb-6">💡 Suggestions</h3>
              ${analysis.suggestions.map(item => `<div class="bg-white p-5 rounded-2xl mb-4">${item}</div>`).join('')}
            </div>
          </div>

          <div class="mt-8 pt-10 border-t border-slate-200">
            <div class="text-center mb-6">
              <p class="text-slate-500 text-sm mb-2">Ready to go beyond analysis?</p>
              <h3 class="text-2xl font-bold text-slate-800">Let AI rewrite your resume from scratch</h3>
            </div>
            <button id="craftWithAIBtn" onclick="openCraftModal()" class="craft-btn w-full py-6 rounded-3xl text-white font-bold text-xl relative overflow-hidden group">
              <div class="stars"></div>
              <span class="relative z-10 flex items-center justify-center gap-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-yellow-300">
                  <path d="M12 2L13.09 8.26L19 7L15.45 11.91L21 14L15.45 16.09L19 21L13.09 15.74L12 22L10.91 15.74L5 21L8.55 16.09L3 14L8.55 11.91L5 7L10.91 8.26L12 2Z" fill="currentColor"/>
                </svg>
                Forge My Resume with AI
                <span class="text-sm font-normal opacity-80 bg-white/10 px-3 py-1 rounded-full">2 versions</span>
              </span>
              <span class="relative z-10 block text-xs font-normal opacity-60 mt-1">Recruiter-level analysis → Achievement rewrite → ATS optimization</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(resultDiv);
      resultDiv.scrollIntoView({ behavior: 'smooth' });
    }, 1200);

  } catch (error) {
    loading.remove();
    console.error(error);
    openPopup("Server Error", ['Could not connect to backend API. Make sure Flask server is running on port 5000.']);
  }
});

// ================================
// CRAFT MODAL
// ================================
const craftModal = document.getElementById('craftModal');
document.getElementById('closeCraftModal').addEventListener('click', () => craftModal.classList.add('hidden'));

document.getElementById('confirmSkillsBtn').addEventListener('click', () => {
  const skills = Array.from(document.querySelectorAll('#honestyBody .skill-check:checked')).map(c => c.value);
  const reqs = Array.from(document.querySelectorAll('#honestyBody .req-check:checked')).map(c => c.value);
  launchCraft(skills, reqs);
});
document.getElementById('skipSkillsBtn').addEventListener('click', () => launchCraft([], []));
document.getElementById('closeSkillModalBtn').addEventListener('click', closeSkillModal);
(() => { const m = document.getElementById('skillModal'); m.addEventListener('click', (e) => { if (e.target === m) closeSkillModal(); }); })();

async function openCraftModal() {
  const jobDescValue = document.getElementById('jobDescription').value.trim();

  // Guard: must have resume text (set by analyze) OR the file itself
  if (!currentResumeText && !uploadedFile) {
    openPopup("Resume Missing 📄", [
      "Please upload your resume file and run Analyze Resume first.",
      "The Forge feature needs your resume text to rewrite it."
    ]);
    return;
  }

  if (!jobDescValue && !currentJobDesc) {
    openPopup("Job Description Missing 📋", [
      "Please paste a job description so the AI can optimize your resume."
    ]);
    return;
  }

  if (jobDescValue) currentJobDesc = jobDescValue;

  // FIX: If we don't have resume text yet (user clicked Forge without running Analyze),
  // extract it from the file first
  if (!currentResumeText && uploadedFile) {
    const formData = new FormData();
    formData.append('resume', uploadedFile);

    try {
      const res = await fetch('http://127.0.0.1:5000/extract', {
        method: 'POST',
        body: formData
      });

      // FIX: was incorrectly using `response.json()` — now correctly uses `res.json()`
      const data = await res.json();

      if (data.success) {
        currentResumeText = data.resume_text;
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err) {
      openPopup("Server Error ❌", [
        "Could not extract resume text.",
        "Make sure the Flask backend is running on port 5000.",
        err.message
      ]);
      return;
    }
  }

  // Final guard: make sure we actually have resume text now
  if (!currentResumeText || currentResumeText.trim().length < 50) {
    openPopup("Resume Text Empty ⚠️", [
      "Could not read text from your resume file.",
      "Make sure your PDF or DOCX contains selectable text (not a scanned image)."
    ]);
    return;
  }

  if (!currentAnalysis) {
    currentAnalysis = {
      match_score: 0,
      strengths: [],
      missing_skills: [],
      ats_issues: [],
      suggestions: []
    };
  }

  // NEW: confirm which JD skills the user actually has, before rewriting
  startCraftFlow();
}

function startCraftFlow() {
  const a = currentAnalysis || {};
  const missing = Array.isArray(a.missing_keywords) ? a.missing_keywords
                : (Array.isArray(a.missing_skills) ? a.missing_skills : []);
  const reqs = (a.ats_report && Array.isArray(a.ats_report.hard_requirements))
    ? a.ats_report.hard_requirements.filter(r => r && !r.met && r.requirement).map(r => r.requirement)
    : [];
  if (missing.length || reqs.length) {
    openSkillModal(missing, reqs);
  } else {
    launchCraft([], []);
  }
}

function honestyRow(cls, val) {
  const safe = String(val).replace(/"/g, '&quot;');
  return `
    <label class="flex items-start gap-3 p-3 rounded-2xl border border-slate-200 hover:border-blue-400 cursor-pointer transition">
      <input type="checkbox" class="${cls} mt-0.5 w-5 h-5 accent-blue-600" value="${safe}">
      <span class="text-sm text-slate-700">${val}</span>
    </label>`;
}

function openSkillModal(missing, reqs) {
  let html = '';
  if (missing && missing.length) {
    html += `<div><p class="font-bold text-slate-800 text-sm mb-2">Skills the job wants that aren't on your resume</p>
      <div class="space-y-2">${missing.map(s => honestyRow('skill-check', s)).join('')}</div></div>`;
  }
  if (reqs && reqs.length) {
    html += `<div><p class="font-bold text-slate-800 text-sm mb-2">Job requirements we couldn't find — do you actually meet them?</p>
      <div class="space-y-2">${reqs.map(r => honestyRow('req-check', r)).join('')}</div></div>`;
  }
  document.getElementById('honestyBody').innerHTML = html;
  document.getElementById('skillModal').classList.remove('hidden');
}

function closeSkillModal() { document.getElementById('skillModal').classList.add('hidden'); }

function launchCraft(skills, reqs) {
  confirmedSkills = Array.isArray(skills) ? skills : [];
  confirmedRequirements = Array.isArray(reqs) ? reqs : [];
  closeSkillModal();
  document.getElementById('craftLoading').classList.remove('hidden');
  document.getElementById('craftResults').classList.add('hidden');
  document.getElementById('craftStatusBadge').classList.remove('hidden');
  craftModal.classList.remove('hidden');
  runCraftAI();
}

let _craftPct = 0;
let _craftCrawlTimer = null;

function setCraftProgress(pct, label) {
  _craftPct = Math.max(0, Math.min(100, pct));
  const bar = document.getElementById('craftProgress');
  const txt = document.getElementById('craftProgressPct');
  const lbl = document.getElementById('craftProgressLabel');
  if (bar) bar.style.width = _craftPct + '%';
  if (txt) txt.textContent = Math.round(_craftPct) + '%';
  if (lbl && typeof label === 'string') lbl.textContent = label;
}

function startCraftCrawl(target = 96) {
  // Slowly close the gap to `target` while the real API call is in flight.
  stopCraftCrawl();
  _craftCrawlTimer = setInterval(() => {
    const gap = target - _craftPct;
    if (gap <= 0.3) return;
    setCraftProgress(_craftPct + Math.max(0.2, gap * 0.04));
  }, 350);
}

function stopCraftCrawl() {
  if (_craftCrawlTimer) { clearInterval(_craftCrawlTimer); _craftCrawlTimer = null; }
}

function updateStep(stepNum) {
  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById(`step${i}`).querySelector('.step-dot');
    if (i < stepNum) dot.className = 'step-dot done';
    else if (i === stepNum) dot.className = 'step-dot active';
    else dot.className = 'step-dot pending';
  }
  // Steps 1..5 progress smoothly from 5% to 50%; the remaining 50-100 is the API wait + final snap.
  const pct = 5 + ((stepNum - 1) / 4) * 45;
  setCraftProgress(pct, `Step ${stepNum} of 5`);
}

const stepTitles = [
  'Running recruiter eye test...',
  'Identifying every weakness...',
  'Mapping ATS keywords to job...',
  'Rewriting achievements with impact...',
  'Forging two optimized versions...'
];

async function runCraftAI() {
  try {
    setCraftProgress(0, 'Warming up…');
    // Animate steps while the API call runs
    for (let i = 1; i <= 5; i++) {
      updateStep(i);
      document.getElementById('craftLoadingTitle').textContent = stepTitles[i - 1];
      if (i < 5) await delay(900);
    }
    document.getElementById('craftLoadingTitle').textContent = 'Measuring real ATS improvement...';
    setCraftProgress(55, 'Talking to AI — almost there');
    startCraftCrawl(96);

    // FIX: Send the actual resume text in the request body
    const response = await fetch("http://127.0.0.1:5000/forge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: currentResumeText,      // ← the real resume text
        job_description: currentJobDesc,
        analysis: currentAnalysis,
        confirmed_skills: confirmedSkills,
        confirmed_requirements: confirmedRequirements,
        jd_skills: (currentAnalysis && currentAnalysis.jd_skills) || []
      })
    });

    const data = await response.json();

    if (!data.success) throw new Error(data.error || 'Forge failed');

    const result = data.result;
    if (!result) throw new Error('Empty result from AI');

    stopCraftCrawl();
    setCraftProgress(100, 'Done ✓');
    await delay(350);
    showCraftResults(result);

  } catch (err) {
    stopCraftCrawl();
    console.error('Craft AI error:', err);
    document.getElementById('craftLoading').classList.add('hidden');
    craftModal.classList.add('hidden');
    openPopup("AI Forge Error ❌", [
      "The AI couldn't complete the resume generation.",
      err.message || "Unknown error — check the console for details."
    ]);
  }
}

function showCraftResults(result) {
  document.getElementById('craftStatusBadge').classList.add('hidden');
  document.getElementById('craftLoading').classList.add('hidden');
  document.getElementById('craftResults').classList.remove('hidden');

  const insights = result.insights || {};
  const added = Array.isArray(result.keywords_added) ? result.keywords_added : [];
  const remaining = Array.isArray(result.keywords_remaining) ? result.keywords_remaining : [];
  const addedHtml = added.length
    ? `<div class="metric-win"><strong>Keywords added (you confirmed):</strong> ${added.join(', ')}</div>`
    : `<div class="metric-neutral"><strong>Keywords added:</strong> none — you didn't confirm any from the checklist</div>`;
  const remainingHtml = remaining.length
    ? `<div class="metric-neutral"><strong>Still missing from the job:</strong> ${remaining.join(', ')} <span class="text-slate-400">— not on your resume. Re-run Forge and tick the ones you actually have.</span></div>`
    : `<div class="metric-win"><strong>Keyword coverage:</strong> every key job keyword is now present 🎉</div>`;
  const insightsHtml = [
    insights.first_impression ? `<div class="metric-win"><strong>First impression:</strong> ${insights.first_impression}</div>` : '',
    insights.top_weakness ? `<div class="metric-neutral"><strong>Top weakness:</strong> ${insights.top_weakness}</div>` : '',
    addedHtml,
    remainingHtml,
    insights.achievement_tip ? `<div class="metric-win"><strong>Achievement tip:</strong> ${insights.achievement_tip}</div>` : ''
  ].filter(Boolean).join('');
  document.getElementById('insightsContent').innerHTML = insightsHtml;

  const before = (typeof result.original_score === 'number')
    ? result.original_score
    : ((currentAnalysis && currentAnalysis.match_score) || null);
  const s1 = result.version1?.score;
  const s2 = result.version2?.score;
  document.getElementById('score1Text').textContent = (s1 != null ? s1 : '—') + (s1 != null ? '%' : '');
  document.getElementById('score2Text').textContent = (s2 != null ? s2 : '—') + (s2 != null ? '%' : '');
  setScoreDelta('score1Delta', before, s1);
  setScoreDelta('score2Delta', before, s2);

  const jdSkills = (currentAnalysis && currentAnalysis.jd_skills) || [];
  const v1text = result.version1?.full_resume || 'Content unavailable';
  const v2text = result.version2?.full_resume || 'Content unavailable';
  versionTexts[1] = v1text;
  versionTexts[2] = v2text;
  // Prefer the backend's synonym-aware classification; fall back to the local
  // matcher only if the backend didn't ship one (older response shape).
  const c1 = result.v1_classification || classifyKeywords(jdSkills, currentResumeText, v1text);
  const c2 = result.v2_classification || classifyKeywords(jdSkills, currentResumeText, v2text);
  document.getElementById('resumeContent1').innerHTML = highlightResume(v1text, c1.added, c1.matched);
  document.getElementById('resumeContent2').innerHTML = highlightResume(v2text, c2.added, c2.matched);

  document.getElementById('comparisonContent').innerHTML = result.recommendation
    ? `<p>${result.recommendation}</p>`
    : '<p>Both versions are optimized for your target role. Use Version 1 for large company ATS systems, Version 2 when applying directly to hiring managers.</p>';
}

function atsReportHtml(report) {
  if (!report) return '';
  const badge = (st) => {
    const map = { pass: ['#dcfce7', '#16a34a', '✓'], warn: ['#fef9c3', '#ca8a04', '!'], fail: ['#fee2e2', '#dc2626', '✕'] };
    const [bg, fg, ic] = map[st] || map.warn;
    return `<span style="background:${bg};color:${fg}" class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0">${ic}</span>`;
  };
  const row = (label, st, note) => `
    <div class="flex items-start gap-3 py-2">
      ${badge(st)}
      <div><p class="font-semibold text-slate-800 text-sm">${label}</p><p class="text-xs text-slate-500">${note || ''}</p></div>
    </div>`;

  const kw = report.keyword || {};
  const fmt = report.format_checks || [];
  const reqs = report.hard_requirements || [];
  const title = report.title || {};
  const readiness = (typeof report.readiness === 'number') ? report.readiness : null;
  const rColor = readiness == null ? '' : (readiness >= 75 ? 'text-emerald-600' : readiness >= 50 ? 'text-yellow-600' : 'text-red-600');

  const reqRows = reqs.length
    ? reqs.map(r => row(r.requirement, r.met ? 'pass' : 'fail', r.note)).join('')
    : '<p class="text-sm text-slate-400">No specific hard requirements detected.</p>';
  const fmtRows = fmt.map(c => row(c.check, c.status, c.note)).join('');
  const titleRow = row(title.target_title ? ('Job title: ' + title.target_title) : 'Job title match', title.status || 'warn', title.note);

  return `
    <div class="mb-12">
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-3xl font-bold">ATS Readiness Report</h3>
        ${readiness != null ? `<span class="text-3xl font-extrabold ${rColor}">${readiness}<span class="text-lg text-slate-400">/100</span></span>` : ''}
      </div>
      <div class="grid lg:grid-cols-3 gap-6">
        <div class="bg-slate-50 rounded-3xl p-6">
          <h4 class="font-bold text-slate-800 mb-3">Keyword match</h4>
          ${kw.score != null ? `<p class="text-4xl font-extrabold text-blue-600 mb-1">${kw.score}%</p>` : '<p class="text-slate-400 text-sm">—</p>'}
          <p class="text-xs text-slate-500">${kw.note || ''}</p>
        </div>
        <div class="bg-slate-50 rounded-3xl p-6">
          <h4 class="font-bold text-slate-800 mb-3">Must-have requirements</h4>
          ${reqRows}
        </div>
        <div class="bg-slate-50 rounded-3xl p-6">
          <h4 class="font-bold text-slate-800 mb-3">Format &amp; parseability</h4>
          ${fmtRows}
          ${titleRow}
        </div>
      </div>
    </div>`;
}

function classifyKeywords(jdSkills, originalText, versionText) {
  const ol = (originalText || '').toLowerCase();
  const vl = (versionText || '').toLowerCase();
  const present = (txt, k) => {
    k = String(k).trim().toLowerCase();
    if (!k) return false;
    if (txt.includes(k)) return true;
    const words = k.split(/[^a-z0-9+#.]+/).filter(w => w.length > 2);
    return words.length > 0 && words.every(w => txt.includes(w));
  };
  const added = [], matched = [];
  (jdSkills || []).forEach(k => {
    if (!k || String(k).trim().length < 2) return;
    const inV = present(vl, k), inO = present(ol, k);
    if (inV && !inO) added.push(String(k).trim());
    else if (inV && inO) matched.push(String(k).trim());
  });
  return { added, matched };
}

function highlightResume(text, added, matched) {
  const items = [];
  (added || []).forEach(k => { if (k && k.trim().length >= 2) items.push([k.trim(), 'add']); });
  (matched || []).forEach(k => { if (k && k.trim().length >= 2) items.push([k.trim(), 'match']); });
  if (!items.length) return escHtml(text);
  items.sort((a, b) => b[0].length - a[0].length);
  const cls = {};
  items.forEach(([k, c]) => { if (!(k.toLowerCase() in cls)) cls[k.toLowerCase()] = c; });
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = items.map(([k]) => escRe(k)).join('|');
  let re;
  try { re = new RegExp('(?<![A-Za-z0-9])(' + pattern + ')(?![A-Za-z0-9])', 'gi'); }
  catch (e) { re = new RegExp('(' + pattern + ')', 'gi'); }
  const S = '\u0001', M = '\u0002', E = '\u0003';
  let marked = String(text).replace(re, (m) => (S + (cls[m.toLowerCase()] || 'match') + M + m + E));
  marked = escHtml(marked);
  marked = marked.replace(new RegExp(S + '(add|match)' + M + '([\\s\\S]*?)' + E, 'g'),
    (_, c, t) => `<mark class="hl-${c}" title="${c === 'add' ? 'Newly added keyword' : 'Matched job keyword (already in your resume)'}">${t}</mark>`);
  return marked;
}

function setScoreDelta(id, before, after) {
  const el = document.getElementById(id);
  if (!el) return;
  if (before == null || after == null) { el.textContent = ''; return; }
  const diff = after - before;
  const up = diff > 0, down = diff < 0;
  el.style.color = up ? '#16a34a' : (down ? '#dc2626' : '#64748b');
  const arrow = up ? '▲' : (down ? '▼' : '◆');
  const sign = up ? '+' : '';
  el.textContent = `ATS match ${before}% → ${after}%  (${arrow} ${sign}${diff})`;
}

function switchTab(tab) {
  document.getElementById('tabBothBtn').classList.toggle('active', tab === 'both');
  document.getElementById('tabV1Btn').classList.toggle('active', tab === 'v1');
  document.getElementById('tabV2Btn').classList.toggle('active', tab === 'v2');

  const grid = document.getElementById('resumeGrid');
  const c1 = document.getElementById('card1');
  const c2 = document.getElementById('card2');

  if (tab === 'both') {
    grid.classList.remove('lg:grid-cols-1');
    grid.classList.add('lg:grid-cols-2');
    c1.style.display = '';
    c2.style.display = '';
  } else if (tab === 'v1') {
    grid.classList.remove('lg:grid-cols-2');
    grid.classList.add('lg:grid-cols-1');
    c1.style.display = '';
    c2.style.display = 'none';
  } else {
    grid.classList.remove('lg:grid-cols-2');
    grid.classList.add('lg:grid-cols-1');
    c1.style.display = 'none';
    c2.style.display = '';
  }
}

// ================================
// DOWNLOAD → SELECT TEMPLATE
// (clicking ⬇ Download opens the template gallery; clicking a
//  template renders that design and downloads it as a PDF)
// ================================
const templateModal = document.getElementById('templateModal');
const templateGrid  = document.getElementById('templateGrid');
const templateToast = document.getElementById('templateToast');

let templateBusy   = false;
let parsedResume   = null;
let pendingLabel   = 'resume';

// Called by the ⬇ Download buttons on each resume card (onclick="downloadResume(1|2)")
function downloadResume(num) {
  // Use the stored clean text (never the highlighted innerHTML) so no markup reaches the PDF.
  const text = (versionTexts[num] || document.getElementById(`resumeContent${num}`).textContent || '').trim();
  pendingLabel = num === 1 ? 'Precision_Version' : 'Impact_Version';

  if (!text || text.length < 30) {
    openPopup("Nothing to Download 📄", ["Generate your resume first, then pick a template to download."]);
    return;
  }

  parsedResume = parseResume(text);

  // If the user already picked a template earlier from the Templates gallery,
  // skip the picker entirely and download directly with that template.
  if (userPickedTemplate) {
    currentPreviewTemplate = chosenTemplate;
    return downloadBasic();
  }

  // Otherwise show the gallery so the user can pick one for this download.
  galleryMode = 'finalize';
  buildTemplateGallery();
  templateModal.classList.remove('hidden');
}

function closeTemplateModal() { if (!templateBusy) templateModal.classList.add('hidden'); }
document.getElementById('closeTemplateModalBtn').addEventListener('click', closeTemplateModal);
templateModal.addEventListener('click', (e) => { if (e.target === templateModal) closeTemplateModal(); });

// ---- the templates shown in the popup (add more here) ----
const TEMPLATES = [
  { id: 'modern',     name: 'Modern Professional' },
  { id: 'twocol',     name: 'Two Column' },
  { id: 'entry',      name: 'Entry Level' },
  { id: 'simple',     name: 'Simply Modern' },
  { id: 'classic',    name: 'Classic Serif' },
  { id: 'compact',    name: 'Compact Tech' },
  { id: 'elegant',    name: 'Elegant Serif' },
  { id: 'rail',       name: 'Accent Rail' },
  { id: 'executive',  name: 'Executive Navy' },
  { id: 'minimalist', name: 'Minimalist' },
  { id: 'bold',       name: 'Bold Statement' },
  { id: 'corporate',  name: 'Corporate Blue' },
  { id: 'leftbar',    name: 'Left Sidebar' },
  { id: 'headerband', name: 'Header Band' },
  { id: 'academic',   name: 'Academic CV' },
  { id: 'gradient',   name: 'Gradient Modern' },
  { id: 'sleek',      name: 'Sleek Spaced' },
  { id: 'brutalist',  name: 'Brutalist Yellow' },
  { id: 'warm',       name: 'Warm Earth' },
  { id: 'techpro',    name: 'Tech Terminal' },
  { id: 'harvard',    name: 'Harvard Standard' },
  { id: 'mckinsey',   name: 'McKinsey Consulting' },
  { id: 'faang',      name: 'FAANG Tech' },
  { id: 'linkedin',   name: 'LinkedIn Modern' },
  { id: 'investment', name: 'Investment Banking' },
  { id: 'atsclean',   name: 'ATS Standard' },
  { id: 'healthcare', name: 'Healthcare Pro' },
  { id: 'legal',      name: 'Law Firm' }
];

let galleryMode = 'finalize';      // set by whoever opens the gallery
let userPickedTemplate = false;    // true once the user has explicitly picked a template via the gallery

// Reusable observer: only renders an iframe's srcdoc once the card scrolls near the viewport.
// With 20+ templates, mounting all iframes up front is heavy. Lazy hydration keeps the gallery snappy.
const _thumbObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const card = e.target;
        const tplId = card.dataset.tplId;
        if (!tplId) return;
        const frame = card.querySelector('iframe');
        if (frame && !frame.srcdoc) {
          frame.srcdoc = buildResumeDoc(parsedResume, tplId);
          frame.addEventListener('load', () => {
            const loader = card.querySelector('.thumb-loading');
            if (loader) loader.remove();
            frame.style.transform = `scale(${frame.parentElement.clientWidth / 816})`;
          }, { once: true });
        }
        obs.unobserve(card);
      });
    }, { rootMargin: '200px' })
  : null;

function buildTemplateGallery() {
  templateGrid.innerHTML = '';
  const isBrowse = galleryMode === 'browse';
  TEMPLATES.forEach(t => {
    const card = document.createElement('div');
    card.className = 'tcard';
    card.dataset.tplId = t.id;
    const buttons = isBrowse
      ? `<div class="tcard-actions">
           <button class="preview-btn"><span class="lbl">👁 Preview</span></button>
           <button class="use"><span class="spin"></span><span class="lbl">Use →</span></button>
         </div>`
      : `<button class="use"><span class="spin"></span><span class="lbl">Preview &amp; Download</span></button>`;
    card.innerHTML = `
      <div class="thumb">
        <div class="thumb-loading">rendering</div>
        <iframe loading="lazy" aria-label="${t.name} preview"></iframe>
      </div>
      <div class="tbody">
        <span class="ats">ATS-friendly</span>
        <h3>${t.name}</h3>
        ${buttons}
      </div>`;

    if (isBrowse) {
      card.querySelector('.preview-btn').addEventListener('click', (e) => { e.stopPropagation(); openTemplatePreview(t); });
      card.querySelector('.use').addEventListener('click', (e) => { e.stopPropagation(); pickTemplateAndGoToScratch(t); });
      card.addEventListener('click', () => openTemplatePreview(t));
    } else {
      const go = () => openTemplatePreview(t);
      card.querySelector('.use').addEventListener('click', (e) => { e.stopPropagation(); go(); });
      card.addEventListener('click', go);
    }
    templateGrid.appendChild(card);

    // Render the first 6 cards immediately (above the fold); observe the rest.
    if (templateGrid.childElementCount <= 6 || !_thumbObserver) {
      const frame = card.querySelector('iframe');
      frame.srcdoc = buildResumeDoc(parsedResume, t.id);
      frame.addEventListener('load', () => {
        const loader = card.querySelector('.thumb-loading');
        if (loader) loader.remove();
        frame.style.transform = `scale(${frame.parentElement.clientWidth / 816})`;
      }, { once: true });
    } else {
      _thumbObserver.observe(card);
    }
  });
}

function openTemplatePreview(t) {
  // Reuse the basic preview modal but render the chosen template.
  // The user can browse other templates afterwards because the gallery stays open underneath.
  openBasicPreview(t.id, galleryMode);
}

function pickTemplateAndGoToScratch(t) {
  // "Use" button on a card — skip preview and go straight to Scratch with this template chosen.
  chosenTemplate = t.id;
  userPickedTemplate = true;
  templateModal.classList.add('hidden');
  if (pendingLabel === 'Sample') { parsedResume = null; pendingLabel = ''; }
  openScratchModal();
  showTemplateToast(`Template selected: ${t.name}`);
}

async function generateTemplatePDF(t, card) {
  if (templateBusy) return;
  templateBusy = true;
  card.classList.add('busy');
  card.querySelector('.lbl').textContent = 'Generating…';

  try {
    // Build the template HTML and let the Flask backend render it with a real
    // browser engine -> exact layout, selectable text, ATS-parseable.
    const html = buildResumeDoc(parsedResume, t.id);
    const fileName = `Resume_${pendingLabel}_${t.id}`;

    const res = await fetch('http://127.0.0.1:5000/render-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename: fileName })
    });

    if (!res.ok) {
      let msg = 'PDF generation failed';
      try { const e = await res.json(); msg = e.error || msg; } catch (_) {}
      throw new Error(msg);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showTemplateToast(`Downloaded "${t.name}"`);
    templateModal.classList.add('hidden');
  } catch (err) {
    console.error(err);
    openPopup("Download Error ❌", [
      "Could not generate the PDF.",
      "Make sure the Flask backend is running on port 5000.",
      err.message || ""
    ]);
  } finally {
    card.classList.remove('busy');
    card.querySelector('.lbl').textContent = 'Use This Template';
    templateBusy = false;
  }
}

function showTemplateToast(msg) {
  templateToast.textContent = msg;
  templateToast.classList.add('show');
  setTimeout(() => templateToast.classList.remove('show'), 2600);
}

window.addEventListener('resize', () => {
  document.querySelectorAll('#templateGrid iframe').forEach(f => f.style.transform = `scale(${f.parentElement.clientWidth / 816})`);
});

// ================================
// RESUME PARSER + TEMPLATE RENDERER
// ================================
function isResumeHeader(line) {
  const t = line.trim(); if (!t || t.length > 46) return false;
  const known = /^(PROFESSIONAL SUMMARY|SUMMARY|PROFILE|OBJECTIVE|TECHNICAL SKILLS|CORE SKILLS|SKILLS|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROJECTS|KEY PROJECTS|EDUCATION|CERTIFICATIONS?|LICEN[SC]ES?|ACHIEVEMENTS?|AWARDS?|LANGUAGES?|INTERESTS|HOBBIES|CONTACT|REFERENCES|AFFILIATIONS|PUBLICATIONS)\b/i;
  if (known.test(t)) return true;
  const letters = t.replace(/[^A-Za-z]/g, '');
  return letters.length >= 2 && letters === letters.toUpperCase();
}
const looksLikeContact = l => /@|\d{3}|linkedin|github|http|\|/i.test(l);

function parseResume(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0; while (i < lines.length && !lines[i].trim()) i++;
  const name = (lines[i] || 'Your Name').trim(); i++;
  let role = ''; const contact = [];
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') { i++; continue; }
    if (isResumeHeader(l)) break;
    if (looksLikeContact(l)) contact.push(l.trim()); else if (!role) role = l.trim();
    i++;
  }
  const sections = []; let cur = null;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (isResumeHeader(l)) { cur = { title: l.trim(), lines: [] }; sections.push(cur); }
    else if (cur) cur.lines.push(l);
    else if (l.trim()) { cur = { title: 'PROFILE', lines: [l] }; sections.push(cur); }
  }
  return { name, role, contact, sections };
}

const escHtml = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function contactInline(c) { return c.join('  ').split(/\s*[|•·]\s*|\s{2,}/).map(s => s.trim()).filter(Boolean).map(escHtml).join('<span class="sep">•</span>'); }
function contactStacked(c) { return '<ul class="clist">' + c.join('  ').split(/\s*[|•·]\s*|\s{2,}/).map(s => s.trim()).filter(Boolean).map(p => `<li>${escHtml(p)}</li>`).join('') + '</ul>'; }
function chipList(str) {
  return str.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    .map(s => `<span class="chip">${escHtml(s)}</span>`).join('');
}
function renderSkills(a) {
  let html = '';
  for (const raw of a) {
    const line = raw.replace(/^[-•*]\s*/, '').trim();
    if (!line) continue;
    const m = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (m && m[2].includes(',')) {
      // "Category: a, b, c"  ->  label + chips
      html += `<div class="skrow"><span class="sklabel">${escHtml(m[1].trim())}</span><span class="skchips">${chipList(m[2])}</span></div>`;
    } else if (!/[:.]/.test(line) && line.includes(',')) {
      // plain comma list  ->  chips
      html += `<div class="skrow"><span class="skchips">${chipList(line)}</span></div>`;
    } else {
      // a sentence or single phrase  ->  plain readable line
      html += `<div class="para">${escHtml(line)}</div>`;
    }
  }
  return html;
}
function renderLines(a) {
  let h = '', inL = false;
  for (const raw of a) {
    const line = raw.trim(); if (!line) continue;
    if (/^[-•*]\s+/.test(raw)) {
      if (!inL) { h += '<ul>'; inL = true; }
      h += `<li>${escHtml(line.replace(/^[-•*]\s+/, ''))}</li>`;
    } else {
      if (inL) { h += '</ul>'; inL = false; }
      const head = /(19|20)\d{2}|present|\u2013|\u2014| to /i.test(line) && line.length < 95;
      h += `<div class="${head ? 'entry' : 'para'}">${escHtml(line)}</div>`;
    }
  }
  if (inL) h += '</ul>';
  return h;
}
function renderSection(s) { return `<section class="sec"><h2>${escHtml(s.title)}</h2>${/SKILL/i.test(s.title) ? renderSkills(s.lines) : renderLines(s.lines)}</section>`; }
const SIDEBAR_RE = /SKILL|EDUCATION|CERTIF|LICEN|LANGUAGE|AWARD|CONTACT|INTEREST|HOBB/i;

function bodyForTemplate(d, tpl) {
  if (tpl === 'twocol') {
    const side = d.sections.filter(s => SIDEBAR_RE.test(s.title));
    const main = d.sections.filter(s => !SIDEBAR_RE.test(s.title));
    return `<header class="rhead"><h1>${escHtml(d.name)}</h1>${d.role ? `<div class="role">${escHtml(d.role)}</div>` : ''}</header>
      <div class="cols"><main class="maincol">${main.map(renderSection).join('')}</main>
      <aside class="sidecol"><section class="sec"><h2>CONTACT</h2>${contactStacked(d.contact)}</section>${side.map(renderSection).join('')}</aside></div>`;
  }
  if (tpl === 'leftbar') {
    // Sidebar holds the identity card (name, role, contact) plus skills/education/certs.
    const side = d.sections.filter(s => SIDEBAR_RE.test(s.title));
    const main = d.sections.filter(s => !SIDEBAR_RE.test(s.title));
    return `<div class="cols">
      <aside class="sidecol">
        <header class="rhead"><h1>${escHtml(d.name)}</h1>${d.role ? `<div class="role">${escHtml(d.role)}</div>` : ''}</header>
        <section class="sec"><h2>CONTACT</h2>${contactStacked(d.contact)}</section>
        ${side.map(renderSection).join('')}
      </aside>
      <main class="maincol">${main.map(renderSection).join('')}</main>
    </div>`;
  }
  if (tpl === 'headerband') {
    // Coloured band runs across the top containing name + role + contact; sections below it.
    return `<header class="rhead"><h1>${escHtml(d.name)}</h1>${d.role ? `<div class="role">${escHtml(d.role)}</div>` : ''}<div class="contact">${contactInline(d.contact)}</div></header>
      <div class="body-content">${d.sections.map(renderSection).join('')}</div>`;
  }
  return `<header class="rhead"><h1>${escHtml(d.name)}</h1>${d.role ? `<div class="role">${escHtml(d.role)}</div>` : ''}<div class="contact">${contactInline(d.contact)}</div></header>${d.sections.map(renderSection).join('')}`;
}

const TPL_BASE_CSS = `*{box-sizing:border-box}@page{size:Letter;margin:0}
  body{margin:0;width:816px;min-height:1056px;background:#fff;color:#222;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5}
  h1,h2{margin:0}ul{margin:6px 0 0;padding-left:18px}li{margin:3px 0}
  .sec{margin-top:16px}.para{margin:5px 0}.entry{font-weight:700;margin:9px 0 2px}
  .skrow{margin:8px 0}
  .sklabel{display:block;font-weight:700;font-size:12px;margin-bottom:4px}
  .skchips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{background:#eef2ff;color:#4f46e5;border-radius:6px;padding:3px 9px;font-size:11.5px;font-weight:600}
  .clist{list-style:none;margin:6px 0 0;padding:0}.clist li{margin:4px 0;font-size:12px;word-break:break-word}
  .sep{margin:0 8px;color:#bbb}`;

/* *** ADD A TEMPLATE: add a line to TEMPLATES above + a CSS block here (same id).
   Single-column designs need only CSS; a new layout also needs a branch in bodyForTemplate(). */
const TPL_CSS = {
  modern: `body{padding:50px 56px}
    .rhead{text-align:center;border-bottom:3px solid #4f46e5;padding-bottom:14px}
    h1{font-family:Georgia,'Times New Roman',serif;font-size:30px;letter-spacing:.5px}
    .role{font-size:14px;color:#444;margin-top:3px}.contact{font-size:11.5px;color:#555;margin-top:8px}
    h2{font-family:Georgia,serif;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#4338ca;border-bottom:1px solid #e3e3e3;padding-bottom:4px}`,
  twocol: `body{padding:0}
    .rhead{padding:38px 40px 18px}h1{font-size:30px}.role{color:#4f46e5;font-weight:700;margin-top:4px;font-size:14px}
    .cols{display:flex;align-items:stretch}.maincol{flex:1;padding:6px 36px 40px 40px}
    .sidecol{width:280px;background:#4f46e5;color:#eaf0ff;padding:32px 28px 40px}
    .maincol h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:3px}
    .sidecol h2{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:#fff;border-bottom:1px solid rgba(255,255,255,.35);padding-bottom:3px}
    .sidecol .chip{background:rgba(255,255,255,.16);color:#fff}.sidecol .clist li{color:#dce6ff}
    .sidecol .sklabel{color:#fff}.sidecol .para{color:#dce6ff}`,
  entry: `body{padding:48px 56px}
    .rhead{padding-bottom:12px;border-bottom:2px solid #4f46e5}h1{font-size:28px}.role{color:#4f46e5;font-weight:700;margin-top:3px}
    .contact{font-size:11.5px;color:#555;margin-top:7px}
    h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4f46e5;margin-bottom:2px}
    .sec{border-top:1px solid #eee;padding-top:10px}`,
  simple: `body{padding:56px 60px;color:#1a1a1a}
    h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:-.5px}
    .role{color:#666;margin-top:2px;font-size:14px}.contact{font-size:11.5px;color:#777;margin-top:8px}
    h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#999;font-weight:700}
    .chip{background:#f1f1f1;color:#333}`,
  classic: `body{padding:54px 60px;font-family:Georgia,'Times New Roman',serif;color:#1c1c1c}
    .rhead{text-align:center;border-bottom:1px solid #333;padding-bottom:12px}
    h1{font-size:30px;letter-spacing:1px}.role{color:#444;margin-top:3px}.contact{font-size:11.5px;color:#555;margin-top:8px}
    h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;border-bottom:1px solid #ccc;padding-bottom:3px}
    .chip{background:#f0f0f0;color:#333;font-family:Arial,sans-serif}`,

  compact: `body{padding:38px 46px;font-size:12px;line-height:1.45;color:#0f172a}
    .rhead{padding-bottom:8px;border-bottom:1.5px solid #0f172a}
    h1{font-family:Consolas,'JetBrains Mono','Courier New',monospace;font-size:24px;letter-spacing:-.3px}
    .role{font-size:12px;color:#475569;margin-top:1px;font-weight:600}
    .contact{font-size:11px;color:#475569;margin-top:6px;font-family:Consolas,monospace}
    .sec{margin-top:13px}
    h2{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:#0f172a;border-bottom:1px dashed #94a3b8;padding-bottom:2px;margin-bottom:6px}
    .entry{font-size:12.5px;margin:7px 0 1px}
    ul{margin:4px 0 0;padding-left:16px}li{margin:2px 0}
    .chip{background:#0f172a;color:#fff;border-radius:3px;font-family:Consolas,monospace;font-size:10.5px;padding:2px 7px}
    .sklabel{font-family:Consolas,monospace;font-size:11px}`,

  elegant: `body{padding:60px 72px;font-family:Georgia,'Garamond','Times New Roman',serif;color:#2b2b2b;line-height:1.6}
    .rhead{text-align:left;padding-bottom:14px;border-bottom:1px solid #b08a3e}
    h1{font-size:32px;letter-spacing:.3px;font-weight:400}
    .role{font-style:italic;color:#7d6033;margin-top:4px;font-size:14px}
    .contact{font-size:11.5px;color:#6b6b6b;margin-top:10px;letter-spacing:.02em}
    .sep{color:#b08a3e}
    .sec{margin-top:20px}
    h2{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#b08a3e;font-weight:700;border-bottom:none;padding-bottom:0;margin-bottom:6px}
    .entry{font-weight:700;margin:11px 0 3px;font-size:13.5px}
    .para{margin:6px 0}
    ul{padding-left:20px}li{margin:4px 0}
    .chip{background:transparent;color:#2b2b2b;border:1px solid #d8c08a;border-radius:0;padding:2px 9px;font-style:italic;font-family:Georgia,serif}
    .sklabel{font-style:italic;color:#7d6033;font-weight:700;font-size:12px}`,

  rail: `body{padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a;display:flex}
    body::before{content:'';display:block;width:10px;background:linear-gradient(180deg,#0ea5e9,#6366f1);flex-shrink:0}
    body > *{padding-left:46px;padding-right:54px}
    .rhead{padding-top:48px;padding-bottom:14px;border-bottom:2px solid #0f172a}
    h1{font-size:30px;font-weight:800;letter-spacing:-.5px}
    .role{font-size:14px;font-weight:600;color:#0ea5e9;margin-top:2px;text-transform:uppercase;letter-spacing:.1em}
    .contact{font-size:11.5px;color:#475569;margin-top:8px}
    .sec{margin-top:18px}
    h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#0f172a;font-weight:800;border:none;padding:0;margin-bottom:6px;display:flex;align-items:center;gap:8px}
    h2::before{content:'';width:14px;height:2px;background:#0ea5e9}
    .entry{font-weight:700;margin:9px 0 2px}
    .chip{background:#e0f2fe;color:#0369a1;border-radius:999px;padding:3px 11px;font-size:11.5px;font-weight:600}
    .sklabel{color:#0369a1}`,

  executive: `body{padding:52px 60px;font-family:'Helvetica Neue',Arial,sans-serif;color:#0a1929}
    .rhead{border-bottom:4px double #1e3a8a;padding-bottom:14px}
    h1{font-size:34px;font-weight:800;letter-spacing:-.5px;color:#0a1929}
    .role{font-size:13px;color:#1e3a8a;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.14em}
    .contact{font-size:11.5px;color:#475569;margin-top:8px}
    h2{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#1e3a8a;font-weight:800;border-bottom:1px solid #1e3a8a;padding-bottom:3px}
    .entry{font-weight:700;color:#0a1929;margin:10px 0 3px}
    .chip{background:#1e3a8a;color:#fff;border-radius:3px;padding:3px 10px;font-size:11.5px;font-weight:600}`,

  minimalist: `body{padding:64px 80px;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;line-height:1.7}
    .rhead{padding-bottom:20px;border:none}
    h1{font-size:28px;font-weight:300;letter-spacing:2px;color:#111}
    .role{font-size:13px;color:#6b7280;margin-top:6px;font-weight:400;letter-spacing:.5px}
    .contact{font-size:11px;color:#9ca3af;margin-top:14px;letter-spacing:.05em}
    .sec{margin-top:26px}
    h2{font-size:10px;letter-spacing:.32em;text-transform:uppercase;color:#9ca3af;font-weight:600;border:none;padding:0;margin-bottom:10px}
    .entry{font-weight:500;color:#111;margin:12px 0 4px}
    ul{padding-left:18px}li{margin:5px 0}
    .chip{background:transparent;color:#374151;border:none;padding:0;font-size:12px;font-weight:400;border-radius:0}
    .skchips{gap:0;flex-wrap:wrap}
    .skchips .chip{margin-right:14px}
    .skchips .chip:not(:last-child)::after{content:'·';margin-left:14px;color:#d1d5db}`,

  bold: `body{padding:48px 56px;font-family:Arial,sans-serif;color:#111}
    .rhead{padding-bottom:12px;border-bottom:5px solid #dc2626}
    h1{font-size:36px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;line-height:1.05;font-family:'Arial Black',Arial,sans-serif}
    .role{font-size:13px;color:#dc2626;margin-top:5px;font-weight:900;letter-spacing:.15em;text-transform:uppercase}
    .contact{font-size:11.5px;color:#374151;margin-top:8px;font-weight:500}
    h2{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#111;font-weight:900;border-bottom:3px solid #111;padding-bottom:4px;font-family:'Arial Black',Arial,sans-serif}
    .entry{font-weight:800;color:#111;margin:10px 0 2px}
    .chip{background:#111;color:#fff;border-radius:0;padding:3px 10px;font-size:11.5px;font-weight:700}`,

  corporate: `body{padding:54px 64px;font-family:'Times New Roman',Times,serif;color:#1c2433}
    .rhead{text-align:center;padding-bottom:14px;border-bottom:2px solid #1e3a8a}
    h1{font-size:32px;font-weight:700;letter-spacing:.5px;color:#1e3a8a}
    .role{font-size:14px;color:#374151;margin-top:4px;font-style:italic}
    .contact{font-size:12px;color:#475569;margin-top:10px}
    h2{font-size:14px;letter-spacing:.04em;color:#1e3a8a;font-weight:700;border-bottom:1px solid #cbd5e1;padding-bottom:3px}
    .entry{font-weight:700;color:#1c2433;margin:10px 0 3px}
    .chip{background:#dbeafe;color:#1e3a8a;border-radius:3px;padding:2px 9px;font-size:11.5px;font-weight:600;font-family:Arial,sans-serif}`,

  leftbar: `body{padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a}
    .cols{display:flex;align-items:stretch;min-height:1056px}
    .sidecol{width:260px;background:#0f172a;color:#cbd5e1;padding:38px 26px}
    .sidecol .rhead{padding:0 0 16px;border-bottom:1px solid #334155;margin-bottom:6px}
    .sidecol h1{font-size:24px;color:#fff;font-weight:800;letter-spacing:-.3px;margin:0}
    .sidecol .role{font-size:11px;color:#a78bfa;margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.12em}
    .sidecol h2{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a78bfa;border-bottom:1px solid rgba(167,139,250,.3);padding-bottom:3px;font-weight:700;margin-bottom:6px}
    .sidecol .chip{background:rgba(167,139,250,.18);color:#e9d5ff;font-size:11px;padding:3px 9px;border-radius:3px}
    .sidecol .clist li{color:#cbd5e1;font-size:11.5px;word-break:break-word}
    .sidecol .sklabel{color:#fff}.sidecol .para{color:#cbd5e1;font-size:12px}
    .maincol{flex:1;padding:38px 38px 38px 32px;background:#fff}
    .maincol h2{font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#0f172a;border-bottom:2px solid #0f172a;padding-bottom:3px;font-weight:800;margin-bottom:6px}
    .maincol .entry{font-weight:700;color:#0f172a;margin:10px 0 3px}`,

  headerband: `body{padding:0;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1f2937}
    .rhead{background:linear-gradient(135deg,#7c3aed 0%,#4f46e5 100%);color:#fff;padding:42px 56px}
    .rhead h1{font-size:32px;font-weight:800;letter-spacing:-.4px;color:#fff;margin:0}
    .rhead .role{font-size:13px;color:#e9d5ff;margin-top:5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
    .rhead .contact{font-size:11.5px;color:#ddd6fe;margin-top:10px}
    .rhead .sep{color:rgba(255,255,255,.5)}
    .body-content{padding:30px 56px 50px}
    .body-content .sec{margin-top:18px}
    h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7c3aed;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
    .entry{font-weight:700;color:#1f2937;margin:10px 0 3px}
    .chip{background:#f5f3ff;color:#7c3aed;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:600}`,

  academic: `body{padding:50px 58px;font-family:'Times New Roman',Times,serif;color:#1c1c1c;font-size:12px;line-height:1.5}
    .rhead{text-align:center;border-bottom:1.5px solid #1c1c1c;padding-bottom:12px}
    h1{font-size:24px;font-weight:700;letter-spacing:.3px}
    .role{font-size:13px;color:#444;margin-top:3px;font-style:italic}
    .contact{font-size:11px;color:#444;margin-top:6px}
    .sec{margin-top:14px}
    h2{font-size:12px;letter-spacing:.04em;color:#1c1c1c;font-weight:700;border:none;padding:0;margin-bottom:4px;text-transform:none}
    .entry{font-weight:700;color:#1c1c1c;margin:8px 0 2px;font-size:12px}
    ul{margin:4px 0 0;padding-left:18px}li{margin:2px 0;font-size:11.5px}
    .chip{background:transparent;color:#1c1c1c;border:none;padding:0;font-family:'Times New Roman',serif;font-size:11.5px;font-style:italic;border-radius:0}
    .skchips{gap:0;flex-wrap:wrap}
    .skchips .chip{margin-right:0}
    .skchips .chip:not(:last-child)::after{content:', ';color:#1c1c1c;font-style:normal}`,

  gradient: `body{padding:52px 56px;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1f2937}
    .rhead{text-align:center;padding-bottom:16px}
    .rhead::after{content:'';display:block;width:140px;height:3px;margin:14px auto 0;background:linear-gradient(90deg,#0ea5e9,#a855f7,#f43f5e);border-radius:2px}
    h1{font-size:30px;font-weight:800;letter-spacing:-.3px;background:linear-gradient(90deg,#0ea5e9,#a855f7);-webkit-background-clip:text;background-clip:text;color:transparent}
    .role{font-size:14px;color:#475569;margin-top:4px;font-weight:600}
    .contact{font-size:11.5px;color:#64748b;margin-top:8px}
    h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0ea5e9;font-weight:700;border:none;padding:0;margin-bottom:5px}
    .entry{font-weight:700;color:#1f2937;margin:9px 0 2px}
    .chip{background:linear-gradient(135deg,#e0f2fe,#f3e8ff);color:#7c3aed;border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:600}`,

  sleek: `body{padding:60px 70px;font-family:'Helvetica Neue',Arial,sans-serif;color:#1f2937;line-height:1.7}
    .rhead{padding-bottom:14px;border-bottom:1px solid #d1d5db}
    h1{font-size:30px;font-weight:200;letter-spacing:6px;text-transform:uppercase;color:#111}
    .role{font-size:11px;color:#6b7280;margin-top:8px;letter-spacing:4px;text-transform:uppercase;font-weight:500}
    .contact{font-size:11px;color:#6b7280;margin-top:10px;letter-spacing:.05em}
    h2{font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:#111;font-weight:600;border:none;margin-bottom:8px;padding:0}
    .entry{font-weight:500;color:#111;margin:11px 0 3px;letter-spacing:.3px}
    .chip{background:transparent;color:#374151;border:1px solid #d1d5db;border-radius:0;padding:2px 10px;font-size:10.5px;font-weight:500;letter-spacing:.5px;text-transform:uppercase}`,

  brutalist: `body{padding:42px 50px;font-family:Helvetica,Arial,sans-serif;color:#000}
    .rhead{padding:18px;border:3px solid #000;background:#fde047;text-align:left}
    h1{font-size:34px;font-weight:900;letter-spacing:-1px;text-transform:uppercase;line-height:1}
    .role{font-size:13px;color:#000;margin-top:6px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
    .contact{font-size:11.5px;color:#000;margin-top:8px;font-weight:600}
    h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#000;font-weight:900;border-left:6px solid #000;padding:3px 0 3px 10px;background:#f3f4f6;border-bottom:none;margin-bottom:6px}
    .entry{font-weight:800;color:#000;margin:9px 0 2px}
    .chip{background:#000;color:#fde047;border:2px solid #000;border-radius:0;padding:2px 9px;font-size:11px;font-weight:800;text-transform:uppercase}`,

  warm: `body{padding:54px 64px;font-family:Georgia,'Times New Roman',serif;color:#3a2d1f;background:#fdfbf7}
    .rhead{border-bottom:2px solid #92632a;padding-bottom:14px}
    h1{font-size:30px;color:#5c3d17;font-weight:700;letter-spacing:.3px}
    .role{font-size:14px;color:#92632a;margin-top:4px;font-style:italic}
    .contact{font-size:11.5px;color:#7a6647;margin-top:8px}
    .sep{color:#c8a96a}
    h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#5c3d17;font-weight:700;border-bottom:1px solid #d4c19a;padding-bottom:3px}
    .entry{font-weight:700;color:#3a2d1f;margin:10px 0 3px}
    .chip{background:#f5ead0;color:#5c3d17;border-radius:3px;padding:3px 10px;font-size:11.5px;font-weight:600;font-family:Arial,sans-serif}`,

  techpro: `body{padding:46px 52px;font-family:Consolas,'Courier New',monospace;color:#0f172a;font-size:11.5px;line-height:1.55}
    .rhead{padding-bottom:12px;border-bottom:2px solid #10b981}
    h1{font-size:26px;font-weight:700;letter-spacing:-.5px;color:#10b981;font-family:Consolas,monospace}
    h1::before{content:'> ';color:#10b981}
    .role{font-size:12px;color:#64748b;margin-top:3px;font-weight:500}
    .role::before{content:'// ';color:#94a3b8}
    .contact{font-size:11px;color:#64748b;margin-top:8px}
    h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#10b981;font-weight:700;border:none;padding:0;margin-bottom:5px}
    h2::before{content:'## ';color:#10b981}
    .entry{font-weight:700;color:#0f172a;margin:8px 0 2px}
    .chip{background:#dcfce7;color:#065f46;border-radius:3px;padding:2px 8px;font-size:10.5px;font-weight:700;font-family:Consolas,monospace}`,

  harvard: `body{padding:54px 64px;font-family:'Times New Roman',Times,serif;color:#000;font-size:11.5px;line-height:1.5}
    .rhead{text-align:center;padding-bottom:6px;border-bottom:none}
    h1{font-size:22px;font-weight:700;letter-spacing:.6px;text-transform:uppercase}
    .role{font-size:11.5px;color:#000;margin-top:2px;font-weight:400}
    .contact{font-size:11px;color:#000;margin-top:4px}
    .sec{margin-top:12px}
    h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#000;font-weight:700;border-bottom:1.5px solid #000;padding-bottom:1px;margin-bottom:4px}
    .entry{font-weight:700;color:#000;margin:7px 0 1px;font-size:11.5px}
    ul{margin:3px 0 0;padding-left:18px}li{margin:2px 0;font-size:11.5px}
    .chip{background:transparent;color:#000;border:none;padding:0;font-family:'Times New Roman',serif;font-size:11.5px;border-radius:0}
    .skchips{gap:0;flex-wrap:wrap}.skchips .chip:not(:last-child)::after{content:'; ';color:#000}
    .sklabel{color:#000;font-style:italic;font-weight:400;font-size:11.5px}`,

  mckinsey: `body{padding:50px 60px;font-family:Arial,Helvetica,sans-serif;color:#0a1929;font-size:11.5px;line-height:1.55}
    .rhead{padding-bottom:10px;border-bottom:1.5px solid #0a1929}
    h1{font-size:24px;font-weight:700;letter-spacing:-.3px;color:#0a1929}
    .role{font-size:12px;color:#374151;margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
    .contact{font-size:11px;color:#475569;margin-top:7px}
    h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#0a1929;font-weight:700;border-bottom:none;padding-bottom:0;margin-top:14px;margin-bottom:5px}
    .entry{font-weight:700;color:#0a1929;margin:8px 0 1px;font-size:12px}
    ul{margin:3px 0 0;padding-left:16px}li{margin:2.5px 0;font-size:11.5px}
    .chip{background:#eff6ff;color:#1e3a8a;border-radius:2px;padding:1px 8px;font-size:11px;font-weight:600}`,

  faang: `body{padding:52px 60px;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#202124;font-size:12px;line-height:1.55}
    .rhead{padding-bottom:14px;border-bottom:1px solid #dadce0}
    h1{font-size:28px;font-weight:700;color:#202124;letter-spacing:-.4px}
    .role{font-size:13px;color:#5f6368;margin-top:4px;font-weight:500}
    .contact{font-size:11.5px;color:#5f6368;margin-top:8px}
    h2{font-size:13px;letter-spacing:.03em;text-transform:none;color:#1a73e8;font-weight:600;border-bottom:1px solid #e8eaed;padding-bottom:3px}
    .entry{font-weight:600;color:#202124;margin:10px 0 3px}
    .chip{background:#e8f0fe;color:#1967d2;border-radius:4px;padding:2px 9px;font-size:11.5px;font-weight:500}`,

  linkedin: `body{padding:50px 58px;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:rgba(0,0,0,.9);font-size:12px;line-height:1.55}
    .rhead{padding-bottom:16px;border-bottom:1px solid #e0e0e0}
    h1{font-size:30px;font-weight:600;letter-spacing:-.2px}
    .role{font-size:14px;color:rgba(0,0,0,.6);margin-top:4px;font-weight:400}
    .contact{font-size:12px;color:#0a66c2;margin-top:8px;font-weight:500}
    h2{font-size:14px;letter-spacing:0;text-transform:none;color:rgba(0,0,0,.9);font-weight:600;border-bottom:1px solid #e0e0e0;padding-bottom:4px;margin-top:18px}
    .entry{font-weight:600;color:rgba(0,0,0,.9);margin:10px 0 3px;font-size:13px}
    .chip{background:#f3f2ef;color:rgba(0,0,0,.9);border-radius:3px;padding:3px 10px;font-size:11.5px;font-weight:500}`,

  investment: `body{padding:48px 58px;font-family:'Times New Roman',Times,serif;color:#000;font-size:11px;line-height:1.45}
    .rhead{text-align:center;padding-bottom:8px;border-bottom:.75px solid #000}
    h1{font-size:20px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}
    .role{font-size:11px;color:#000;margin-top:2px;font-weight:400}
    .contact{font-size:10.5px;color:#000;margin-top:4px}
    .sec{margin-top:11px}
    h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#000;font-weight:700;border-bottom:.75px solid #000;padding-bottom:1px;font-variant:small-caps}
    .entry{font-weight:700;color:#000;margin:6px 0 1px;font-size:11.5px}
    ul{margin:2px 0 0;padding-left:14px}li{margin:1.5px 0;font-size:11px}
    .chip{background:transparent;color:#000;border:none;padding:0;font-family:'Times New Roman',serif;font-size:11px;border-radius:0}
    .skchips{gap:0;flex-wrap:wrap}
    .skchips .chip:not(:last-child)::after{content:' • ';color:#000}`,

  atsclean: `body{padding:50px 60px;font-family:Arial,Helvetica,sans-serif;color:#000;font-size:11.5px;line-height:1.5}
    .rhead{padding-bottom:6px;border:none}
    h1{font-size:20px;font-weight:700;color:#000;text-transform:uppercase;letter-spacing:.2px}
    .role{font-size:12px;color:#000;margin-top:2px;font-weight:600}
    .contact{font-size:11px;color:#000;margin-top:4px}
    .sec{margin-top:14px}
    h2{font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#000;font-weight:700;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:5px}
    .entry{font-weight:700;color:#000;margin:7px 0 1px}
    ul{margin:2px 0 0;padding-left:18px}li{margin:2px 0;font-size:11.5px}
    .chip{background:transparent;color:#000;border:none;padding:0;font-family:Arial,sans-serif;font-size:11.5px;border-radius:0;font-weight:400}
    .skchips{gap:0;flex-wrap:wrap}.skchips .chip:not(:last-child)::after{content:', ';color:#000}
    .sklabel{color:#000;font-weight:700;font-size:11.5px}`,

  healthcare: `body{padding:54px 60px;font-family:Calibri,'Trebuchet MS',Arial,sans-serif;color:#1a3a52;font-size:12px;line-height:1.55}
    .rhead{padding-bottom:12px;border-bottom:2px solid #008080}
    h1{font-size:28px;font-weight:700;color:#003c5f;letter-spacing:-.2px}
    .role{font-size:13px;color:#008080;margin-top:4px;font-weight:600}
    .contact{font-size:11.5px;color:#5a7a8a;margin-top:8px}
    h2{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#003c5f;font-weight:700;border-bottom:1px solid #b3d4dc;padding-bottom:3px}
    .entry{font-weight:700;color:#1a3a52;margin:9px 0 2px}
    .chip{background:#e0f2f5;color:#003c5f;border-radius:3px;padding:2px 9px;font-size:11.5px;font-weight:600}`,

  legal: `body{padding:56px 66px;font-family:'Garamond','Times New Roman',Times,serif;color:#0a0a0a;font-size:12.5px;line-height:1.55}
    .rhead{text-align:center;padding-bottom:10px;border-bottom:.75px solid #0a0a0a}
    h1{font-size:26px;font-weight:700;letter-spacing:.5px;font-variant:small-caps}
    .role{font-size:12.5px;color:#3a3a3a;margin-top:3px;font-style:italic}
    .contact{font-size:11.5px;color:#3a3a3a;margin-top:6px}
    .sec{margin-top:14px}
    h2{font-size:12.5px;letter-spacing:.04em;color:#0a0a0a;font-weight:700;border-bottom:none;padding-bottom:0;margin-bottom:4px;font-variant:small-caps;text-transform:none}
    .entry{font-weight:700;color:#0a0a0a;margin:8px 0 2px;font-size:12.5px}
    ul{margin:3px 0 0;padding-left:18px}li{margin:2px 0;font-size:12px}
    .chip{background:transparent;color:#0a0a0a;border:none;padding:0;font-family:Garamond,serif;font-size:12px;border-radius:0;font-style:italic}
    .skchips{gap:0;flex-wrap:wrap}.skchips .chip:not(:last-child)::after{content:'; ';color:#0a0a0a;font-style:normal}`
};

function buildResumeDoc(d, tpl) {
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>${TPL_BASE_CSS}${TPL_CSS[tpl]}</style></head><body>${bodyForTemplate(d, tpl)}</body></html>`;
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ================================
// NAV LINKS
// ================================
document.querySelector('a[href="#features"]').addEventListener("click", (e) => {
  e.preventDefault();
  openPopup("Features", ["✔ ATS Resume Scoring", "✔ Missing Skill Detection", "✔ Job Match Analysis", "✔ AI Resume Suggestions", "✔ Real-time Resume Parsing", "✨ AI Forge — 2-version resume rewrite"]);
});

document.querySelector('a[href="#pricing"]').addEventListener("click", (e) => {
  e.preventDefault();
  openPopup("Pricing", ["🎉 Completely FREE for everyone", "No hidden charges", "No subscription required", "Unlimited resume analysis"]);
});

document.querySelector('a[href="#resources"]').addEventListener("click", (e) => {
  e.preventDefault();
  openPopup("Resources & Guides", [
    `<div class="flex items-center gap-3"><span class="text-2xl">📊</span><div><strong class="text-slate-950 block">ATS Optimization Guide</strong><span class="text-sm text-slate-500">Master the resume screening algorithms.</span></div></div>`,
    `<div class="flex items-center gap-3"><span class="text-2xl">🔍</span><div><strong class="text-slate-950 block">Keyword Optimization Toolkit</strong><span class="text-sm text-slate-500">Find the exact phrases hiring managers scan for.</span></div></div>`,
    `<div class="flex items-center gap-3"><span class="text-2xl">💡</span><div><strong class="text-slate-950 block">Interview Preparation Tips</strong><span class="text-sm text-slate-500">Crush your upcoming technical and behavioral rounds.</span></div></div>`,
    `<div class="flex items-center gap-3 opacity-60"><span class="text-2xl">🤖</span><div><strong class="text-slate-950 block">AI Career Assistant <span class="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full ml-1 font-normal">Soon</span></strong><span class="text-sm text-slate-500">Automated cover letters and timeline application parsing.</span></div></div>`
  ]);
});

document.getElementById('loginBtn').addEventListener("click", (e) => {
  e.preventDefault();
  openPopup("No Account Needed! 🎉", [
    "<strong>ResumeAI is completely open and free.</strong>",
    "✨ No login or registration required.",
    "🔒 Your data is processed instantly without persistent tracking.",
    "🚀 Unlimited resume optimization scans!"
  ]);
});

// Built-in sample resume so visitors can browse templates before creating one.
const SAMPLE_RESUME_TEXT = [
  'Alex Carter',
  'Software Engineer',
  'alex.carter@example.com | +1 (415) 555-0142 | linkedin.com/in/alexcarter | github.com/alexcarter',
  '',
  'PROFESSIONAL SUMMARY',
  'Full-stack engineer with 5+ years building scalable web platforms across fintech and edtech. Strong in Python, TypeScript, and cloud-native deployments. Comfortable owning a feature end-to-end from design doc to production rollout.',
  '',
  'TECHNICAL SKILLS',
  'Languages: Python, TypeScript, JavaScript, SQL, Go',
  'Frameworks: React, Next.js, Node.js, FastAPI, Django',
  'Cloud & DevOps: AWS, GCP, Docker, Kubernetes, Terraform, GitHub Actions',
  'Databases: PostgreSQL, Redis, MongoDB, BigQuery',
  '',
  'EXPERIENCE',
  'Senior Software Engineer — Northwind Finance, San Francisco       Mar 2022 – Present',
  '• Led migration of legacy monolith to 12 microservices, cutting deploy time from 45 min to 6 min.',
  '• Designed event-driven payment pipeline processing 2M+ daily transactions with 99.98% uptime.',
  '• Mentored 4 junior engineers; ran weekly architecture review and on-call rotation.',
  'Software Engineer — BrightPath EdTech, Remote                     Aug 2019 – Feb 2022',
  '• Built React + FastAPI learning platform used by 180k students; improved Lighthouse score 62→94.',
  '• Implemented A/B testing framework that lifted lesson-completion rate by 18%.',
  '• Reduced cloud spend by 31% via right-sizing and migrating cold workloads to spot instances.',
  '',
  'PROJECTS',
  'Open-Source CLI — gh-stats',
  '• Go CLI that surfaces contribution metrics from GitHub GraphQL API. 1.2k stars, 30+ contributors.',
  'Realtime Markdown Collab Editor',
  '• Next.js + WebSocket app supporting concurrent editing with operational transforms.',
  '',
  'EDUCATION',
  'B.S. Computer Science — University of California, Berkeley — 2015–2019 — GPA 3.8',
  '',
  'CERTIFICATIONS',
  '• AWS Certified Solutions Architect — Associate (2023)',
  '• Google Cloud Professional Cloud Architect (2024)'
].join('\n');

// ====== Nav-bar Templates dropdown ======
// Click the nav "Templates" link → opens a panel under the nav showing tiny live
// previews of all templates. Click any preview → picks that template + sends the
// user to Start-from-Scratch (same as the existing pickTemplateAndGoToScratch).
const _navTplWrap     = document.querySelector('.nav-tpl-wrap');
const _navTplLink     = document.getElementById('navTemplatesLink');
const _navTplDropdown = document.getElementById('navTplDropdown');
const _navTplGrid     = document.getElementById('navTplGrid');

const _navTplObserver = ('IntersectionObserver' in window)
  ? new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const card = e.target;
        const tplId = card.dataset.tplId;
        const frame = card.querySelector('iframe');
        if (frame && !frame.srcdoc) {
          frame.srcdoc = buildResumeDoc(parsedResume || parseResume(SAMPLE_RESUME_TEXT), tplId);
          frame.addEventListener('load', () => {
            const ld = card.querySelector('.thumb-loading');
            if (ld) ld.remove();
            frame.style.transform = `scale(${frame.parentElement.clientWidth / 816})`;
          }, { once: true });
        }
        obs.unobserve(card);
      });
    }, { root: _navTplDropdown, rootMargin: '100px' })
  : null;

let _navTplBuilt = false;
function buildNavTemplateDropdown() {
  if (_navTplBuilt) return;
  _navTplBuilt = true;
  const sample = parsedResume || parseResume(SAMPLE_RESUME_TEXT);
  TEMPLATES.forEach((t, idx) => {
    const card = document.createElement('div');
    card.className = 'nav-tpl-card';
    card.dataset.tplId = t.id;
    card.innerHTML = `
      <div class="ntthumb">
        <div class="thumb-loading">rendering</div>
        <iframe loading="lazy" aria-label="${t.name} preview"></iframe>
      </div>
      <div class="ntname">${t.name}</div>`;
    card.addEventListener('click', () => {
      closeNavTplDropdown();
      pickTemplateAndGoToScratch(t);
    });
    _navTplGrid.appendChild(card);

    // Render first 8 immediately, lazy-observe the rest.
    if (idx < 8 || !_navTplObserver) {
      const frame = card.querySelector('iframe');
      frame.srcdoc = buildResumeDoc(sample, t.id);
      frame.addEventListener('load', () => {
        const ld = card.querySelector('.thumb-loading');
        if (ld) ld.remove();
        frame.style.transform = `scale(${frame.parentElement.clientWidth / 816})`;
      }, { once: true });
    } else {
      _navTplObserver.observe(card);
    }
  });
}

function openNavTplDropdown() {
  buildNavTemplateDropdown();
  _navTplDropdown.classList.remove('hidden');
  _navTplWrap.classList.add('open');
}
function closeNavTplDropdown() {
  _navTplDropdown.classList.add('hidden');
  _navTplWrap.classList.remove('open');
}

_navTplLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (_navTplDropdown.classList.contains('hidden')) openNavTplDropdown();
  else closeNavTplDropdown();
});

// Click outside or press Escape to close
document.addEventListener('click', (e) => {
  if (_navTplDropdown.classList.contains('hidden')) return;
  if (!_navTplWrap.contains(e.target)) closeNavTplDropdown();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !_navTplDropdown.classList.contains('hidden')) closeNavTplDropdown();
});

// ==========================================================
//  START FROM SCRATCH — collect details, build a resume,
//  then reuse the template picker + /render-pdf pipeline.
// ==========================================================
const scratchModal = document.getElementById('scratchModal');
let scratchText = '';
let scratchGenerated = false;   // true once a resume has been generated from this form
const BASIC_TEMPLATE = 'modern';   // template used for the "Build normally" path

function resetScratchForm() {
  // Wipe every text input + textarea inside the modal
  scratchModal.querySelectorAll('input.sf-in, textarea.sf-in').forEach(el => { el.value = ''; });

  // Reset the repeatable sections back to their default empty rows
  ['sfSkills', 'sfInterns', 'sfProjects', 'sfCerts'].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.innerHTML = '';
  });
  addSkillRow(); addSkillRow(); addSkillRow();
  addInternRow();
  addProjectRow();
  addCertRow();

  // Reset the upload card + banners
  document.getElementById('sfUploadIdle').classList.remove('hidden');
  document.getElementById('sfUploadBusy').classList.add('hidden');
  document.getElementById('sfUploadBusy').classList.remove('flex');
  const done = document.getElementById('sfUploadDone');
  done.classList.add('hidden'); done.classList.remove('flex');
  document.getElementById('sfUploadError').classList.add('hidden');
  document.getElementById('sfMissingBanner').classList.add('hidden');
  document.getElementById('sfError').classList.add('hidden');
  document.querySelectorAll('.sf-in.sf-empty-flag').forEach(el => el.classList.remove('sf-empty-flag'));
  sfHiddenFileInput.value = '';

  scratchText = '';
  scratchGenerated = false;
}

function openScratchModal() {
  // If the user has just generated a resume, give them a fresh blank form for the next one.
  if (scratchGenerated) {
    resetScratchForm();
  } else {
    if (!document.querySelector('#sfSkills .sf-skill')) { addSkillRow(); addSkillRow(); addSkillRow(); }
    if (!document.querySelector('#sfInterns .sf-block')) addInternRow();
    if (!document.querySelector('#sfProjects .sf-block')) addProjectRow();
    if (!document.querySelector('#sfCerts .sf-cert')) addCertRow();
  }
  scratchModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeScratchModal() {
  scratchModal.classList.add('hidden');
  document.body.style.overflow = '';
}

const scratchBtnEl = document.getElementById('scratchBtn');
if (scratchBtnEl) scratchBtnEl.addEventListener('click', openScratchModal);
document.getElementById('closeScratchBtn').addEventListener('click', closeScratchModal);
scratchModal.addEventListener('click', (e) => { if (!e.target.closest('.sf-card-root')) closeScratchModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !scratchModal.classList.contains('hidden')) closeScratchModal(); });

// ---- repeatable rows ----
function addSkillRow(val) {
  const row = document.createElement('div');
  row.className = 'sf-skill flex items-center gap-2';
  row.innerHTML = `<input class="sf-in sf-skill-in" placeholder="e.g. Python"><button type="button" class="sf-row-rm" title="Remove">✕</button>`;
  if (val) row.querySelector('input').value = val;
  row.querySelector('.sf-row-rm').addEventListener('click', () => row.remove());
  document.getElementById('sfSkills').appendChild(row);
}

function addInternRow() {
  const row = document.createElement('div');
  row.className = 'sf-block sf-card';
  row.innerHTML = `
    <div class="flex justify-between items-start mb-3"><p class="sf-sub" style="margin:0">Internship</p><button type="button" class="sf-row-rm">Remove</button></div>
    <div class="grid sm:grid-cols-2 gap-3">
      <input class="sf-in i-role" placeholder="Role / Title">
      <input class="sf-in i-org" placeholder="Company">
      <input class="sf-in i-when" placeholder="Duration (e.g. Jun 2023 – Aug 2023)">
      <input class="sf-in i-loc" placeholder="Location (optional)">
    </div>
    <textarea class="sf-in i-desc mt-3" rows="2" placeholder="What you did / achieved — one point per line"></textarea>`;
  row.querySelector('.sf-row-rm').addEventListener('click', () => row.remove());
  document.getElementById('sfInterns').appendChild(row);
}

function addProjectRow() {
  const row = document.createElement('div');
  row.className = 'sf-block sf-card';
  row.innerHTML = `
    <div class="flex justify-between items-start mb-3"><p class="sf-sub" style="margin:0">Project</p><button type="button" class="sf-row-rm">Remove</button></div>
    <div class="grid sm:grid-cols-2 gap-3">
      <input class="sf-in p-name" placeholder="Project title">
      <input class="sf-in p-tech" placeholder="Tools / tech used (optional)">
    </div>
    <textarea class="sf-in p-desc mt-3" rows="2" placeholder="What it does / your contribution — one point per line"></textarea>`;
  row.querySelector('.sf-row-rm').addEventListener('click', () => row.remove());
  document.getElementById('sfProjects').appendChild(row);
}

function addCertRow() {
  const row = document.createElement('div');
  row.className = 'sf-cert flex items-center gap-2';
  row.innerHTML = `<input class="sf-in c-name" placeholder="e.g. AWS Certified Cloud Practitioner — 2024"><button type="button" class="sf-row-rm" title="Remove">✕</button>`;
  row.querySelector('.sf-row-rm').addEventListener('click', () => row.remove());
  document.getElementById('sfCerts').appendChild(row);
}

document.getElementById('sfAddSkill').addEventListener('click', () => addSkillRow());
document.getElementById('sfAddIntern').addEventListener('click', () => addInternRow());
document.getElementById('sfAddProject').addEventListener('click', () => addProjectRow());
document.getElementById('sfAddCert').addEventListener('click', () => addCertRow());

// ====================================================
// Upload an old resume → autofill the scratch form
// ====================================================
const sfUploadCard = document.querySelector('.sf-upload-card');
const sfHiddenFileInput = document.createElement('input');
sfHiddenFileInput.type = 'file';
sfHiddenFileInput.accept = '.pdf,.docx';
sfHiddenFileInput.style.display = 'none';
document.body.appendChild(sfHiddenFileInput);

function _sfSet(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = (val == null) ? '' : String(val);
}
function _sfReplaceList(containerId, items, addRowFn, valueSelector) {
  const c = document.getElementById(containerId);
  if (c) c.innerHTML = '';
  (items || []).forEach(v => { addRowFn(); });
  if (containerId === 'sfSkills') {
    document.querySelectorAll('#sfSkills .sf-skill-in').forEach((inp, i) => { inp.value = (items[i] || '').toString(); });
  } else if (containerId === 'sfCerts') {
    document.querySelectorAll('#sfCerts .c-name').forEach((inp, i) => { inp.value = (items[i] || '').toString(); });
  }
}

function populateScratchForm(d) {
  d = d || {};
  _sfSet('sfName', d.name);
  _sfSet('sfRole', d.role);
  _sfSet('sfMobile', d.mobile);
  _sfSet('sfEmail', d.email);
  _sfSet('sfLinkedin', d.linkedin);
  _sfSet('sfGithub', d.github);
  _sfSet('sfSummary', d.summary);
  _sfSet('sfHobbies', d.hobbies);

  const edu = d.education || {};
  ['pg', 'ug', 'school'].forEach(k => {
    const e = edu[k] || {};
    const prefix = 'sf' + (k === 'school' ? 'Sch' : k === 'pg' ? 'Pg' : 'Ug');
    _sfSet(prefix + 'Course', e.course);
    _sfSet(prefix + 'Inst', e.institution);
    _sfSet(prefix + 'Year', e.year);
    _sfSet(prefix + 'Score', e.score);
  });

  // Skills
  const skills = (d.skills || []).filter(s => String(s).trim());
  _sfReplaceList('sfSkills', skills.length ? skills : ['', '', ''], () => addSkillRow());

  // Certifications
  const certs = (d.certifications || []).filter(s => String(s).trim());
  _sfReplaceList('sfCerts', certs.length ? certs : [''], () => addCertRow());

  // Internships
  const internsCt = document.getElementById('sfInterns');
  internsCt.innerHTML = '';
  const internships = (d.internships || []).filter(i => i && (i.role || i.company || i.description));
  (internships.length ? internships : [{}]).forEach(item => {
    addInternRow();
    const row = internsCt.lastElementChild;
    row.querySelector('.i-role').value = item.role || '';
    row.querySelector('.i-org').value  = item.company || '';
    row.querySelector('.i-when').value = item.duration || '';
    row.querySelector('.i-loc').value  = item.location || '';
    row.querySelector('.i-desc').value = item.description || '';
  });

  // Projects
  const projCt = document.getElementById('sfProjects');
  projCt.innerHTML = '';
  const projects = (d.projects || []).filter(p => p && (p.name || p.description));
  (projects.length ? projects : [{}]).forEach(item => {
    addProjectRow();
    const row = projCt.lastElementChild;
    row.querySelector('.p-name').value = item.name || '';
    row.querySelector('.p-tech').value = item.tech || '';
    row.querySelector('.p-desc').value = item.description || '';
  });

  flagMissingFields();
}

function flagMissingFields() {
  // Clear previous flags
  document.querySelectorAll('.sf-in.sf-empty-flag').forEach(el => el.classList.remove('sf-empty-flag'));

  const missing = [];
  const checks = [
    ['sfName',    'Full name'],
    ['sfRole',    'Target role / title'],
    ['sfEmail',   'Email'],
    ['sfMobile',  'Mobile number'],
    ['sfSummary', 'Professional summary'],
    ['sfUgCourse','UG degree'],
    ['sfUgInst',  'UG institution'],
  ];
  checks.forEach(([id, label]) => {
    const el = document.getElementById(id);
    if (el && !el.value.trim()) {
      el.classList.add('sf-empty-flag');
      missing.push(label);
    }
  });

  const skillCount = Array.from(document.querySelectorAll('#sfSkills .sf-skill-in'))
    .filter(i => i.value.trim()).length;
  if (skillCount < 3) missing.push('At least 3 skills');

  const banner = document.getElementById('sfMissingBanner');
  const list   = document.getElementById('sfMissingList');
  if (missing.length) {
    list.textContent = missing.join(' · ');
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

async function handleSfFile(file) {
  if (!file) return;
  const errEl = document.getElementById('sfUploadError');
  const idle  = document.getElementById('sfUploadIdle');
  const busy  = document.getElementById('sfUploadBusy');
  const done  = document.getElementById('sfUploadDone');
  errEl.classList.add('hidden');
  idle.classList.add('hidden');
  done.classList.add('hidden');
  busy.classList.remove('hidden');
  busy.classList.add('flex');

  try {
    const fd = new FormData();
    fd.append('resume', file);
    const res = await fetch('http://127.0.0.1:5000/parse-resume', { method: 'POST', body: fd });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Failed to parse resume');

    populateScratchForm(json.data || {});
    document.getElementById('sfUploadFileName').textContent = file.name;
    done.classList.remove('hidden');
    done.classList.add('flex');
  } catch (err) {
    console.error('Resume parse error:', err);
    errEl.textContent = err.message || 'Could not read this resume.';
    errEl.classList.remove('hidden');
    idle.classList.remove('hidden');
  } finally {
    busy.classList.add('hidden');
    busy.classList.remove('flex');
  }
}

document.getElementById('sfPickFileBtn').addEventListener('click', () => sfHiddenFileInput.click());
sfHiddenFileInput.addEventListener('change', (e) => handleSfFile(e.target.files[0]));

if (sfUploadCard) {
  ['dragenter', 'dragover'].forEach(ev =>
    sfUploadCard.addEventListener(ev, (e) => { e.preventDefault(); sfUploadCard.classList.add('sf-drag-over'); }));
  ['dragleave', 'drop'].forEach(ev =>
    sfUploadCard.addEventListener(ev, (e) => { e.preventDefault(); sfUploadCard.classList.remove('sf-drag-over'); }));
  sfUploadCard.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) handleSfFile(f);
  });
}

document.getElementById('sfClearUploadBtn').addEventListener('click', () => {
  populateScratchForm({});
  document.getElementById('sfUploadDone').classList.add('hidden');
  document.getElementById('sfUploadIdle').classList.remove('hidden');
  sfHiddenFileInput.value = '';
});

// Re-check missing fields whenever the user edits anything in the form.
document.querySelector('.sf-card-root').addEventListener('input', () => {
  if (!document.getElementById('sfMissingBanner').classList.contains('hidden')) flagMissingFields();
});

// ---- assemble + hand off ----
function sfVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function sfEduLine(course, inst, year, score) {
  let head = [course, inst].filter(Boolean).join(', ');
  const tail = [year, score].filter(Boolean).join(' · ');
  if (tail) head += (head ? ' — ' : '') + tail;
  return head;
}

function sfBullets(text) {
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean)
    .map(s => '• ' + s.replace(/^[-•*]\s*/, ''));
}

document.getElementById('sfBuildBtn').addEventListener('click', buildScratchResume);

function buildScratchResume() {
  const err = document.getElementById('sfError');
  const fail = (msg) => { err.textContent = msg; err.classList.remove('hidden'); err.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const name = sfVal('sfName');
  const ugCourse = sfVal('sfUgCourse');
  const ugInst = sfVal('sfUgInst');
  if (!name) return fail('Please enter your full name.');
  if (!ugCourse || !ugInst) return fail('Undergraduate (UG) degree and institution are required.');
  err.classList.add('hidden');

  const lines = [];
  lines.push(name);
  const role = sfVal('sfRole'); if (role) lines.push(role);

  const contact = [sfVal('sfEmail'), sfVal('sfMobile'), sfVal('sfLinkedin'), sfVal('sfGithub')].filter(Boolean);
  if (contact.length) lines.push(contact.join(' | '));
  lines.push('');

  const summary = sfVal('sfSummary');
  if (summary) lines.push('PROFESSIONAL SUMMARY', summary, '');

  const skills = Array.from(document.querySelectorAll('#sfSkills .sf-skill-in')).map(i => i.value.trim()).filter(Boolean);
  if (skills.length) lines.push('TECHNICAL SKILLS', skills.join(', '), '');

  const edu = [
    sfEduLine(sfVal('sfPgCourse'), sfVal('sfPgInst'), sfVal('sfPgYear'), sfVal('sfPgScore')),
    sfEduLine(ugCourse, ugInst, sfVal('sfUgYear'), sfVal('sfUgScore')),
    sfEduLine(sfVal('sfSchCourse'), sfVal('sfSchInst'), sfVal('sfSchYear'), sfVal('sfSchScore'))
  ].filter(Boolean);
  if (edu.length) lines.push('EDUCATION', ...edu, '');

  const interns = [];
  document.querySelectorAll('#sfInterns .sf-block').forEach(b => {
    const r = b.querySelector('.i-role').value.trim();
    const o = b.querySelector('.i-org').value.trim();
    const w = b.querySelector('.i-when').value.trim();
    const loc = b.querySelector('.i-loc').value.trim();
    const d = b.querySelector('.i-desc').value.trim();
    if (!r && !o && !d) return;
    let head = [r, o].filter(Boolean).join(' — ');
    const meta = [loc, w].filter(Boolean).join(', ');
    if (meta) head += (head ? '   ' : '') + meta;
    if (head) interns.push(head);
    if (d) interns.push(...sfBullets(d));
  });
  if (interns.length) lines.push('INTERNSHIPS', ...interns, '');

  const projects = [];
  document.querySelectorAll('#sfProjects .sf-block').forEach(b => {
    const n = b.querySelector('.p-name').value.trim();
    const tech = b.querySelector('.p-tech').value.trim();
    const d = b.querySelector('.p-desc').value.trim();
    if (!n && !d) return;
    let head = n;
    if (tech) head += (head ? '   ' : '') + tech;
    if (head) projects.push(head);
    if (d) projects.push(...sfBullets(d));
  });
  if (projects.length) lines.push('ACADEMIC PROJECTS', ...projects, '');

  const certs = Array.from(document.querySelectorAll('#sfCerts .c-name')).map(i => i.value.trim()).filter(Boolean).map(c => '• ' + c);
  if (certs.length) lines.push('CERTIFICATIONS', ...certs, '');

  const hobbies = sfVal('sfHobbies');
  if (hobbies) lines.push('HOBBIES', hobbies, '');

  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Hold the assembled resume, then ask how to finish (normal vs with JD).
  scratchText = text;
  closeScratchModal();
  openBuildChoice();
}

// ==========================================================
//  BUILD CHOICE: normal (basic template) vs with job description
// ==========================================================
const buildChoiceModal = document.getElementById('buildChoiceModal');
const basicModal = document.getElementById('basicModal');

function openBuildChoice() {
  document.getElementById('buildJDPanel').classList.add('hidden');
  document.getElementById('buildChoiceButtons').classList.remove('hidden');
  document.getElementById('scratchJD').value = '';
  document.getElementById('scratchJDErr').classList.add('hidden');
  buildChoiceModal.classList.remove('hidden');
}
function closeBuildChoice() { buildChoiceModal.classList.add('hidden'); }

document.getElementById('closeBuildChoiceBtn').addEventListener('click', closeBuildChoice);
buildChoiceModal.addEventListener('click', (e) => { if (e.target === buildChoiceModal) closeBuildChoice(); });

// ---- Normal build: render the basic template + a download button ----
document.getElementById('buildNormalBtn').addEventListener('click', () => {
  parsedResume = parseResume(scratchText);
  pendingLabel = 'My_Resume';
  closeBuildChoice();
  // Honour the template the user picked in the showcase gallery, if any.
  openBasicPreview(chosenTemplate, 'finalize');
});

let currentPreviewTemplate = BASIC_TEMPLATE;
let chosenTemplate = BASIC_TEMPLATE;          // remembered across the Scratch → Build flow
let previewMode = 'finalize';                 // 'finalize' (download) or 'browse' (pick & use)

function openBasicPreview(tplId, mode) {
  currentPreviewTemplate = tplId || BASIC_TEMPLATE;
  previewMode = mode || 'finalize';
  const meta = TEMPLATES.find(t => t.id === currentPreviewTemplate);
  const subtitle = document.getElementById('basicSubtitle');
  if (subtitle) {
    const suffix = previewMode === 'browse'
      ? 'use this design for your resume.'
      : 'preview below, then download as PDF.';
    subtitle.textContent = meta ? `${meta.name} — ${suffix}` : 'Preview below.';
  }
  // Swap the bottom button between Download and Use-This-Template.
  const btn = document.getElementById('basicDownloadBtn');
  const lbl = btn.querySelector('.b-lbl');
  if (previewMode === 'browse') {
    lbl.textContent = 'Use this template →';
    btn.classList.add('sf-use-mode');
  } else {
    lbl.textContent = '⬇ Download PDF';
    btn.classList.remove('sf-use-mode');
  }
  const frame = document.getElementById('basicFrame');
  frame.srcdoc = buildResumeDoc(parsedResume, currentPreviewTemplate);
  basicModal.classList.remove('hidden');
  const fit = () => { frame.style.transform = `scale(${frame.parentElement.clientWidth / 816})`; };
  frame.addEventListener('load', fit);
  requestAnimationFrame(fit);
}
function closeBasicPreview() { basicModal.classList.add('hidden'); }
document.getElementById('closeBasicBtn').addEventListener('click', closeBasicPreview);
basicModal.addEventListener('click', (e) => { if (e.target === basicModal) closeBasicPreview(); });
window.addEventListener('resize', () => {
  const f = document.getElementById('basicFrame');
  if (f && !basicModal.classList.contains('hidden')) f.style.transform = `scale(${f.parentElement.clientWidth / 816})`;
});

document.getElementById('basicDownloadBtn').addEventListener('click', () => {
  if (previewMode === 'browse') return useChosenTemplate();
  return downloadBasic();
});

function useChosenTemplate() {
  // User picked a template from the showcase gallery — remember it, close the
  // preview + gallery, and drop them into Start-from-Scratch to fill in their data.
  chosenTemplate = currentPreviewTemplate;
  userPickedTemplate = true;
  basicModal.classList.add('hidden');
  templateModal.classList.add('hidden');
  // Reset the showcase sample so it doesn't leak into the user's actual build.
  if (pendingLabel === 'Sample') { parsedResume = null; pendingLabel = ''; }
  openScratchModal();
  showTemplateToast(`Template selected: ${(TEMPLATES.find(t => t.id === chosenTemplate) || {}).name || chosenTemplate}`);
}

async function downloadBasic() {
  const btn = document.getElementById('basicDownloadBtn');
  const lbl = btn.querySelector('.b-lbl');
  if (btn.disabled) return;
  btn.disabled = true;
  const old = lbl.textContent;
  lbl.textContent = 'Generating…';
  try {
    const html = buildResumeDoc(parsedResume, currentPreviewTemplate);
    const fileName = `Resume_${pendingLabel}_${currentPreviewTemplate}`;
    const res = await fetch('http://127.0.0.1:5000/render-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename: fileName })
    });
    if (!res.ok) {
      let m = 'PDF generation failed';
      try { const e = await res.json(); m = e.error || m; } catch (_) {}
      throw new Error(m);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${fileName}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showTemplateToast('Resume downloaded');
    scratchGenerated = true;   // next open of Start-from-Scratch will start blank
  } catch (err) {
    console.error(err);
    openPopup("Download Error ❌", [
      "Could not generate the PDF.",
      "Make sure the Flask backend is running on port 5000.",
      err.message || ""
    ]);
  } finally {
    btn.disabled = false;
    lbl.textContent = old;
  }
}

// ---- With job description: analyze + forge, then view versions ----
document.getElementById('buildJDBtn').addEventListener('click', () => {
  document.getElementById('buildChoiceButtons').classList.add('hidden');
  document.getElementById('buildJDPanel').classList.remove('hidden');
  document.getElementById('scratchJD').focus();
});
document.getElementById('backChoiceBtn').addEventListener('click', () => {
  document.getElementById('buildJDPanel').classList.add('hidden');
  document.getElementById('buildChoiceButtons').classList.remove('hidden');
});
document.getElementById('runJDBtn').addEventListener('click', runScratchJD);

async function runScratchJD() {
  const jd = document.getElementById('scratchJD').value.trim();
  const jderr = document.getElementById('scratchJDErr');
  if (jd.length < 30) {
    jderr.textContent = 'Please paste the full job description (at least a few lines).';
    jderr.classList.remove('hidden');
    return;
  }
  jderr.classList.add('hidden');

  currentResumeText = scratchText;
  currentJobDesc = jd;
  closeBuildChoice();

  // Show the craft modal in its loading state while we analyze.
  document.getElementById('craftLoading').classList.remove('hidden');
  document.getElementById('craftResults').classList.add('hidden');
  document.getElementById('craftStatusBadge').classList.remove('hidden');
  craftModal.classList.remove('hidden');

  try {
    const res = await fetch('http://127.0.0.1:5000/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_text: scratchText, job_description: jd })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Analysis failed');

    currentAnalysis = data.analysis;
    currentResumeText = data.resume_text || scratchText;

    // Hand off to the existing pipeline: honesty-check -> forge -> versions.
    craftModal.classList.add('hidden');
    startCraftFlow();
    scratchGenerated = true;   // next open of Start-from-Scratch will start blank
  } catch (err) {
    console.error(err);
    craftModal.classList.add('hidden');
    openPopup("Analysis Error ❌", [
      "Could not analyze the resume.",
      "Make sure the Flask backend is running on port 5000.",
      err.message || ""
    ]);
  }
}