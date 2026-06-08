# 🎯 ATS Resume Analyzer, Job Match Evaluator & AI Resume Generator

> **ATS Resume Analyzer & AI Resume Builder** — A free AI-powered tool that analyzes your resume against any job description, scores ATS compatibility, generates tailored resumes in seconds, and lets you build a professional resume from scratch with smart templates. No signup. No payment. Ever.

---

## 🚀 Features

### 📊 ATS Resume Analyzer & Job Match Evaluator
Upload your resume and paste a job description to instantly receive a structured ATS report with **6 key outputs**:

| Output | Description |
|---|---|
| ✅ Match Score | How well your resume aligns with the job |
| 📝 Professional Summary Review | Feedback on your summary section |
| 💪 Strengths | What your resume does well |
| ❌ Missing Skills | Skills in the JD that your resume lacks |
| ⚠️ ATS Issues | Formatting or keyword problems hurting visibility |
| 💡 Improvement Suggestions | Actionable fixes to boost your score |

---

### 🤖 AI Resume Generator
Paste a job description and let the AI build a **brand-new, job-tailored resume** using a **5-step pipeline**:

```
Step 1 — First Impression Scan
         10-second recruiter eye test

Step 2 — Weakness Deep-Dive
         Raw competitive assessment

Step 3 — ATS Keyword Mapping
         Job description alignment

Step 4 — Achievement Rewrite
         Impact-driven bullet points

Step 5 — Industry Tone Calibration
         Matches the tone of your target industry
```

#### 🔀 Dual Output Modes
After generation, you receive **two resume versions** — each with its own ATS match percentage:

- **⚡ Precise Version** — Clean, factual, structured for applicant tracking systems
- **🔥 Impact Version** — Bold, achievement-driven language for human recruiters

Pick the one that fits your application, or use both to compare.

---

### ✍️ Resume Builder — Start From Scratch (New)
Don't have a resume yet? No problem. Use the **Start From Scratch** mode to build a professional resume from the ground up:

- Fill in every section manually — personal info, experience, education, skills, projects, and more
- Choose from a set of **professionally designed resume templates**
- Paste a job description to let the AI **tailor your content** to the role as you build
- Instantly preview your resume and download it

#### 🗂️ How It Works
```
Step 1 — Select "Start From Scratch"
         Choose your preferred resume template

Step 2 — Enter Your Details
         Fill in each section: personal info, experience, education, skills, etc.

Step 3 — Paste a Job Description (Optional)
         AI tailors your content to align with the target role

Step 4 — Preview & Download
         Review the generated resume and export it
```

---

### 🎨 Resume Templates (New)
Choose from a collection of **professionally designed templates** across styles:

- **Classic** — Traditional layout, ATS-safe formatting
- **Modern** — Clean lines, subtle accents
- **Impact** — Bold headers, achievement-focused structure
- **Minimal** — Distraction-free, content-first design

Templates are available in both the AI Generator and the Start From Scratch builder.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python |
| Frontend | HTML · CSS · JavaScript |
| AI Engine | Gemini API (LLM) |
| Communication | REST API |
| File Handling | Python file upload & parsing |

---

## 📁 Project Structure

```
ATS-Resume-checker/
│
├── app.py               # Entry point, server setup & Gemini API integration
│
├── templates/
│   └── index.html       # Main frontend UI
│
├── static/
│   ├── style.css        # Styling & responsive layout
│   └── script.js        # Frontend logic & API calls
│
└── README.md
```

---

## ⚙️ How It Works

### Upload & Analyze Mode
1. User uploads their resume (PDF/text) and pastes a job description
2. Python backend receives the inputs and builds an optimized LLM prompt
3. Gemini API processes the prompt and returns a structured JSON response
4. Backend parses the JSON and serves it to the frontend
5. Frontend renders the ATS report or generated resume on a clean dashboard

### Start From Scratch Mode
1. User selects **Start From Scratch** and picks a template
2. User fills in each resume section via guided input fields
3. Optionally pastes a job description to AI-tailor the content
4. AI generates a complete, job-aligned resume using the entered details
5. User previews the result, selects a version, and downloads it

---

## 🏃 Getting Started

### Prerequisites
- Python 3.8+
- A Gemini API key → [Get one here](https://aistudio.google.com/app/apikey)

### Installation

```bash
# Clone the repository
git clone https://github.com/srinumerugu/ATS-Resume-checker.git
cd ATS-Resume-checker

# Install dependencies
pip install -r requirements.txt

# Add your Gemini API key
# Open chat.py and set your API key:
# API_KEY = "your_gemini_api_key_here"

# Run the app
python main.py
```

Then open your browser and go to `http://localhost:5000`

---

## 💡 Why I Built This

Most ATS tools are paywalled, require signups, or give vague feedback. I wanted to build something that actually helps job seekers — completely free — with real, actionable analysis, the ability to generate an entirely new resume tailored to any job in seconds, and now the ability to build a professional resume from scratch with AI guidance and beautiful templates.

---

## 📌 Roadmap

- [x] ATS Resume Analyzer with 6-point scoring
- [x] AI Resume Generator with Precise & Impact versions
- [x] Start From Scratch resume builder
- [x] Professional resume templates
- [ ] PDF resume export for generated resumes
- [ ] Support for multiple file formats (DOCX, TXT)
- [ ] Side-by-side comparison of Precise vs Impact versions
- [ ] Save & history feature for past analyses

---

## 👨‍💻 Author

**Merugu Srinivas**
Software Developer · Java & Python
📧 srinumerugu18@gmail.com
🔗 [github.com/srinumerugu](https://github.com/srinumerugu)
📍 Hyderabad, Telangana

---

## 📄 License

This project is open source and free to use.
