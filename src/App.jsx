
import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser";
import "./App.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SKILLS = [
  "javascript", "typescript", "react", "next.js", "node.js",
  "html", "css", "sql", "python", "java", "c++", "c#",
  "excel", "power bi", "tableau", "data analysis",
  "data visualization", "machine learning", "statistics",
  "project management", "agile", "scrum", "git", "github",
  "rest api", "aws", "azure", "docker", "kubernetes",
  "communication", "customer service", "sales", "marketing",
  "leadership", "problem solving", "teamwork", "time management",
  "financial analysis", "accounting", "bookkeeping", "research",
  "writing", "editing", "social media", "seo", "crm",
  "human resources", "recruiting", "public speaking",
  "budgeting", "inventory management", "quality assurance",
  "testing", "cybersecurity", "networking", "linux",
  "project planning", "data entry", "administration",
];

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you",
  "your", "our", "are", "was", "were", "will", "have", "has",
  "had", "who", "what", "when", "where", "how", "can", "may",
  "not", "but", "all", "any", "job", "role", "work", "working",
  "team", "ability", "able", "must", "should", "their", "they",
  "them", "its", "into", "about", "across", "years", "year",
  "experience", "required", "preferred", "responsibilities",
  "requirements", "including", "using", "use", "based", "strong",
  "good", "new", "other", "such", "also", "more", "than", "both",
  "each", "per", "within", "through", "ensure", "our", "you'll",
  "we're", "who's", "whose", "been", "being", "there", "here",
]);


function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .match(/[a-z0-9+#.]+(?:'[a-z]+)?/g) || [];
}


function containsPhrase(text, phrase) {
  const escaped = phrase
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");

  return new RegExp(
    `(^|[^a-z0-9+#])${escaped}(?=$|[^a-z0-9+#])`,
    "i"
  ).test(text.toLowerCase());
}


function calculateMatch(resume, job) {
  const resumeText = resume.toLowerCase();
  const jobText = job.toLowerCase();

  // 1. Find skills that our dictionary recognizes in the job.
  const requiredSkills = SKILLS.filter((skill) =>
    containsPhrase(jobText, skill)
  );

  // 2. Check which of those skills also occur in the resume.
  const matchedSkills = requiredSkills.filter((skill) =>
    containsPhrase(resumeText, skill)
  );

  const missingSkills = requiredSkills.filter(
    (skill) => !matchedSkills.includes(skill)
  );

  // 3. Extract distinct job keywords, excluding common words.
  const resumeWords = new Set(normalize(resume));

  const jobKeywords = [
    ...new Set(normalize(job)),
  ].filter(
    (word) => word.length > 2 && !STOP_WORDS.has(word)
  );

  const matchedKeywords = jobKeywords.filter((word) =>
    resumeWords.has(word)
  );

  // 4. Calculate the coverage percentages.
  const hasRecognizedSkills = requiredSkills.length > 0;

  const skillCoverage = hasRecognizedSkills
    ? Math.round(
        (matchedSkills.length / requiredSkills.length) * 100
      )
    : null;

  const keywordCoverage = jobKeywords.length
    ? Math.round(
        (matchedKeywords.length / jobKeywords.length) * 100
      )
    : 0;

  // When skills are recognized, use the 75/25 weighted formula.
  // Otherwise, fall back to keyword coverage alone.
  const score = hasRecognizedSkills
    ? Math.round(
        skillCoverage * 0.75 + keywordCoverage * 0.25
      )
    : keywordCoverage;

  // 5. Generate recommendations using fixed rules.
  const suggestions = [];

  if (!hasRecognizedSkills) {
    suggestions.push({
      title: "Expand skill coverage",
      detail:
        "The job contains no skills recognized by the built-in dictionary. Add relevant job-specific skills to the dictionary or interpret the keyword score cautiously.",
    });
  }

  if (missingSkills.length > 0) {
    suggestions.push({
      title: "Review missing skills",
      detail:
        `The job mentions ${missingSkills.join(", ")}. ` +
        "If you genuinely have these skills, describe relevant projects or work experience that demonstrate them.",
    });
  }

  if (matchedSkills.length > 0) {
    suggestions.push({
      title: "Highlight matching skills",
      detail:
        `Your resume mentions ${matchedSkills.slice(0, 5).join(", ")}. ` +
        "Consider making the most relevant examples easy for a recruiter to find.",
    });
  }

  if (keywordCoverage < 50) {
    suggestions.push({
      title: "Review relevant terminology",
      detail:
        "Compare the job description with your resume. Add relevant terminology only where it accurately describes your skills and experience.",
    });
  }

  suggestions.push({
    title: "Show evidence of your skills",
    detail:
      "Where possible, describe what you did, which tools you used, and what measurable result you achieved.",
  });

  return {
    score,
    skillCoverage,
    keywordCoverage,
    requiredSkills,
    matchedSkills,
    missingSkills,
    matchedKeywords,
    totalKeywords: jobKeywords.length,
    suggestions,
  };
}


async function extractResumeText(file) {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (name.endsWith(".pdf")) {
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    }).promise;

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
      );
    }

    return pages.join("\n\n").trim();
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({
      arrayBuffer: buffer,
    });

    return result.value.trim();
  }

  throw new Error("Choose a PDF or DOCX file.");
}

export default function App() {
  const [resume, setResume] = useState("");
  const [job, setJob] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setError("");
    setResult(null);

    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError("Please select a PDF or DOCX resume.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("The file must be smaller than 10 MB.");
      return;
    }

    setLoading(true);

    try {
      const text = await extractResumeText(file);

      if (!text || text.length < 30) {
        throw new Error(
          "Not enough text could be extracted. This may be a scanned PDF. Try a text-based PDF or paste the resume manually."
        );
      }

      setResume(text);
      setFileName(file.name);
    } catch (err) {
      setError(err.message || "Could not read this file.");
    } finally {
      setLoading(false);
    }
  }

  function handleMatch(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    if (resume.trim().length < 30 || job.trim().length < 30) {
      setError(
        "Please provide at least 30 characters in both fields."
      );
      return;
    }

    setResult(calculateMatch(resume, job));
  }

  function handleReset() {
    setResume("");
    setJob("");
    setFileName("");
    setResult(null);
    setError("");
  }

  function downloadReport() {
    if (!result) return;

    const report = [
      "RESUME MATCH REPORT",
      "===================",
      "",
      `Match score: ${result.score}%`,
      `Detected job skills: ${result.requiredSkills.length}`,
      `Matched skills: ${result.matchedSkills.join(", ") || "None"}`,
      `Skills to review: ${result.missingSkills.join(", ") || "None"}`,
      "",
      "SHARED KEYWORDS",
      result.matchedKeywords.join(", ") || "None",
      "",
      "SUGGESTIONS",
      ...result.suggestions.map(
        (item, index) => `${index + 1}. ${item.title}\n${item.detail}`
      ),
      "",
      "Note: This is a deterministic keyword-based estimate, not a",
      "prediction of hiring success. Check all results for accuracy.",
    ].join("\n");

    const blob = new Blob([report], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "resume-match-report.txt";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <main className="container">
      <header className="hero">
        <p className="eyebrow">YOUR JOB SEARCH ASSISTANT</p>
        <h1>Resume Match</h1>
        <p className="subtitle">
          Compare your resume with a job description using
          transparent, rule-based matching.
        </p>
        <div className="free-label">
          <span className="status-dot" />
          Free · No AI · Browser-based analysis
        </div>
      </header>

      <form className="analyzer" onSubmit={handleMatch}>
        <div className="section-heading">
          <span className="step-number">1</span>
          <div>
            <h2>Your resume</h2>
            <p>Upload a file or paste your resume text.</p>
          </div>
        </div>

        <label htmlFor="resume-file">Upload PDF or DOCX</label>
        <input
          id="resume-file"
          className="file-input"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileChange}
          disabled={loading}
        />

        {loading && (
          <p className="file-status" role="status">
            Extracting resume text in your browser...
          </p>
        )}

        {fileName && !loading && (
          <p className="file-status">
            Loaded: {fileName}
          </p>
        )}

        <label htmlFor="resume">Resume text</label>
        <textarea
          id="resume"
          value={resume}
          onChange={(event) => {
            setResume(event.target.value);
            setFileName("");
          }}
          placeholder="Upload your resume above, or paste your resume here..."
          required
          minLength={30}
          rows={9}
        />
        <p className="character-count">
          {resume.length.toLocaleString()} characters
        </p>

        <div className="section-heading second-heading">
          <span className="step-number">2</span>
          <div>
            <h2>Target job</h2>
            <p>Paste the job description to compare against.</p>
          </div>
        </div>

        <label htmlFor="job">Job description</label>
        <textarea
          id="job"
          value={job}
          onChange={(event) => setJob(event.target.value)}
          placeholder="Paste the job description, skills, and responsibilities..."
          required
          minLength={30}
          rows={9}
        />

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={loading}
        >
          {loading ? "Reading resume..." : "Analyze my resume →"}
          {loading && (
              <p className="file-status" role="status" aria-live="polite">
                    Extracting resume text in your browser...
                     </p>
                    )}
          
        </button>

        <p className="privacy-note">
          Text extraction and matching run locally in your browser.
          This app does not upload your resume to a server.
        </p>
      </form>

      {result && (
        <section className="results" aria-live="polite">
          <div className="results-header">
            <div>
              <p className="eyebrow">YOUR ANALYSIS</p>
              <h2>Resume match results</h2>
            </div>
            <button
              className="reset-button"
              type="button"
              onClick={handleReset}
            >
              Start over
            </button>
          </div>

          <div className="score-panel">
            <div
              className="score-ring"
              style={{ "--score": `${result.score * 3.6}deg` }}
              role="img"
              aria-label={`Match score: ${result.score}%`}
            >
              <div className="score-inner">
                <span className="score">{result.score}%</span>
                <span className="score-caption">match</span>
              </div>
            </div>

            <div className="score-details">
              <h3>
                {result.score >= 75
                  ? "Strong keyword alignment"
                  : result.score >= 50
                  ? "Some relevant alignment"
                  : "Room to improve alignment"}
              </h3>
              <p>
                {result.matchedSkills.length} of{" "}
                {result.requiredSkills.length} detected job skills
                were found in your resume.
              </p>
              <p>
                 Skill coverage:{" "}
                  {result.skillCoverage === null
                    ? "No recognized skills"
                    : `${result.skillCoverage}%`}
            </p>

<p>
  Keyword coverage: {result.keywordCoverage}%
</p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">
                {result.matchedSkills.length}
              </span>
              <span className="stat-label">Matched skills</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {result.missingSkills.length}
              </span>
              <span className="stat-label">Skills to review</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">
                {result.matchedKeywords.length}
              </span>
              <span className="stat-label">Shared keywords</span>
            </div>
          </div>

          <div className="skill-section">
            <h3>Matching skills</h3>
            <p className="section-description">
              Listed skills found in both texts.
            </p>
            <div className="skill-list">
              {result.matchedSkills.length ? (
                result.matchedSkills.map((skill) => (
                  <span className="skill-tag matched" key={skill}>
                    ✓ {skill}
                  </span>
                ))
              ) : (
                <p className="empty-state">
                  No listed skills matched yet.
                </p>
              )}
            </div>
          </div>

          <div className="skill-section">
            <h3>Skills to review</h3>
            <p className="section-description">
              These job skills weren't found in your resume text.
              Add them only if they accurately reflect your abilities.
            </p>
            <div className="skill-list">
              {result.missingSkills.length ? (
                result.missingSkills.map((skill) => (
                  <span className="skill-tag missing" key={skill}>
                    {skill}
                  </span>
                ))
              ) : (
                <p className="empty-state">
                  No missing skills from the built-in dictionary.
                </p>
              )}
            </div>
          </div>

          <div className="skill-section">
            <h3>Shared keywords</h3>
            <p className="section-description">
              These individual words appear in both texts. Some
              may be less relevant than others.
            </p>
            <div className="skill-list">
              {result.matchedKeywords.slice(0, 40).map((word) => (
                <span className="skill-tag matched" key={word}>
                  {word}
                </span>
              ))}
            </div>
          </div>

          <div className="suggestions-panel">
            <h3>Rule-based recommendations</h3>
            <ul>
              {result.suggestions.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}.</strong> {item.detail}
                </li>
              ))}
            </ul>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={downloadReport}
          >
            Download text report ↓
          </button>

          <p className="note">
            The score is a heuristic based on a built-in skill
            dictionary and shared keywords. It is not an ATS score
            or a prediction of hiring success. Scanned PDFs may
            require OCR, which is not included in this version.
          </p>
        </section>
      )}

      <footer className="footer">
        &#9786; ycjuliana - 2026 &#9786;
      </footer>
    </main>
  );
}
