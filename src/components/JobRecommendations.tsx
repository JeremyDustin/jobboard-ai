
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db, auth } from "../firebase";
import type { Job } from "../types";

interface JobRecommendationsProps {
  uid: string;
  jobs: Job[];
}

interface MatchResult {
  job: Job;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
}

interface AIResult {
  success: boolean;
  analysis: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
}

function normalizeSkill(skill: string) {
  return skill.trim().toLowerCase();
}

export default function JobRecommendations({
  uid,
  jobs,
}: JobRecommendationsProps) {
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State untuk AI Analysis
  const [aiResults, setAiResults] = useState<
    Record<string, AIResult>
  >({});

  const [aiLoading, setAiLoading] = useState<
    Record<string, boolean>
  >({});

  const [aiErrors, setAiErrors] = useState<
    Record<string, string>
  >({});

  // ======================================
  // 1. LOAD SKILL PENGGUNA
  // ======================================

  useEffect(() => {
    let active = true;

    async function loadSkills() {
      setLoading(true);
      setError("");

      try {
        const snapshot = await getDoc(
          doc(db, "users", uid)
        );

        if (!snapshot.exists()) {
          throw new Error("Profil pengguna tidak ditemukan.");
        }

        const data = snapshot.data();

        const skills = Array.isArray(data.skills)
          ? data.skills.filter(
              (skill: unknown): skill is string =>
                typeof skill === "string" &&
                skill.trim().length > 0
            )
          : [];

        if (active) {
          setUserSkills(skills);
        }
      } catch (err) {
        console.error("Gagal mengambil skill:", err);

        if (active) {
          setError("Gagal memuat skill profil Anda.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSkills();

    return () => {
      active = false;
    };
  }, [uid]);

  // ======================================
  // 2. JOB MATCHING SYSTEM
  // ======================================

  const recommendations: MatchResult[] = jobs
    .filter((job) => job.status === "Open")
    .filter(
      (job) =>
        Array.isArray(job.requiredSkills) &&
        job.requiredSkills.length > 0
    )
    .map((job) => {
      const requiredSkills = [
        ...new Map(
          job.requiredSkills!
            .filter(
              (skill) =>
                typeof skill === "string" &&
                skill.trim()
            )
            .map((skill) => [
              normalizeSkill(skill),
              skill.trim(),
            ])
        ).values(),
      ];

      const userSkillSet = new Set(
        userSkills.map(normalizeSkill)
      );

      const matchedSkills = requiredSkills.filter(
        (skill) =>
          userSkillSet.has(normalizeSkill(skill))
      );

      const missingSkills = requiredSkills.filter(
        (skill) =>
          !userSkillSet.has(normalizeSkill(skill))
      );

      const score =
        requiredSkills.length === 0
          ? 0
          : Math.round(
              (matchedSkills.length /
                requiredSkills.length) *
                100
            );

      return {
        job,
        score,
        matchedSkills,
        missingSkills,
      };
    })
    .sort((a, b) => b.score - a.score);

  // ======================================
  // 3. LOWONGAN TANPA REQUIRED SKILLS
  // ======================================

  const jobsWithoutRequirements = jobs.filter(
    (job) =>
      job.status === "Open" &&
      (!Array.isArray(job.requiredSkills) ||
        job.requiredSkills.length === 0)
  );

  // ======================================
  // 4. GEMINI AI ANALYSIS
  // ======================================

  async function analyzeJob(jobId: string) {
    setAiLoading((previous) => ({
      ...previous,
      [jobId]: true,
    }));

    setAiErrors((previous) => ({
      ...previous,
      [jobId]: "",
    }));

    try {
      const currentUser = auth.currentUser;

      if (!currentUser || currentUser.uid !== uid) {
        throw new Error(
          "Sesi login tidak ditemukan. Silakan login kembali."
        );
      }

      // Ambil Firebase ID Token
      const idToken = await currentUser.getIdToken();

      // Kirim permintaan ke backend
      const response = await fetch(
        "http://localhost:5000/api/ai/analyze-job",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            jobId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Gagal melakukan analisis AI."
        );
      }

      setAiResults((previous) => ({
        ...previous,
        [jobId]: data,
      }));
    } catch (err) {
      console.error("AI Analysis Error:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menghubungi AI.";

      setAiErrors((previous) => ({
        ...previous,
        [jobId]: message,
      }));
    } finally {
      setAiLoading((previous) => ({
        ...previous,
        [jobId]: false,
      }));
    }
  }

  // ======================================
  // 5. LOADING STATE
  // ======================================

  if (loading) {
    return (
      <div className="form-panel">
        Memuat rekomendasi pekerjaan...
      </div>
    );
  }

  // ======================================
  // 6. ERROR STATE
  // ======================================

  if (error) {
    return (
      <div className="form-panel">
        <p className="notice error">{error}</p>
      </div>
    );
  }

  // ======================================
  // 7. RENDER COMPONENT
  // ======================================

  return (
    <section className="form-panel">
      <span className="eyebrow">
        JOB MATCHING SYSTEM
      </span>

      <h2>Rekomendasi Pekerjaan Untukmu</h2>

      <p>
        Sistem membandingkan skill pada profilmu dengan
        persyaratan skill setiap lowongan.
      </p>

      {/* SKILL PENGGUNA */}

      <div className="skill-list">
        {userSkills.length > 0 ? (
          userSkills.map((skill) => (
            <span className="skill-tag" key={skill}>
              {skill}
            </span>
          ))
        ) : (
          <p className="skill-help">
            Kamu belum menambahkan skill pada profil.
            Lengkapi profil agar rekomendasi lebih relevan.
          </p>
        )}
      </div>

      {/* REKOMENDASI PEKERJAAN */}

      {recommendations.length === 0 ? (
        <p className="empty-state">
          Belum ada lowongan dengan persyaratan skill
          yang dapat dicocokkan.
        </p>
      ) : (
        <div className="job-list">
          {recommendations.map((result) => (
            <article
              className="job-card"
              key={result.job.id}
            >
              <div className="job-info">
                <h3>{result.job.position}</h3>

                <p className="company-name">
                  {result.job.company}
                </p>

                <p className="job-location">
                  {result.job.location}
                </p>
              </div>

              {/* MATCH SCORE */}

              <div className="match-result">
                <strong>
                  {result.score}% Match
                </strong>

                <div className="match-progress">
                  <div
                    className="match-progress-fill"
                    style={{
                      width: `${result.score}%`,
                    }}
                  />
                </div>
              </div>

              {/* MATCHED SKILLS */}

              <div className="match-skills">
                <p>
                  <strong>Skill cocok:</strong>
                </p>

                <div className="skill-list">
                  {result.matchedSkills.length > 0 ? (
                    result.matchedSkills.map((skill) => (
                      <span
                        className="skill-tag"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span>
                      Belum ada skill yang cocok.
                    </span>
                  )}
                </div>

                <p>
                  <strong>
                    Skill yang perlu dipelajari:
                  </strong>
                </p>

                <div className="skill-list">
                  {result.missingSkills.length > 0 ? (
                    result.missingSkills.map((skill) => (
                      <span
                        className="missing-skill-tag"
                        key={skill}
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span>
                      Semua skill persyaratan sudah cocok!
                    </span>
                  )}
                </div>
              </div>

              {/* AI ANALYSIS BUTTON */}

              <div className="ai-analysis-section">
                <button
                  type="button"
                  onClick={() =>
                    analyzeJob(String(result.job.id))
                  }
                  disabled={Boolean(
                    aiLoading[result.job.id]
                  )}
                >
                  {aiLoading[result.job.id]
                    ? "Sedang menganalisis..."
                    : aiResults[result.job.id]
                      ? "Analisis Ulang dengan AI"
                      : "✨ Analisis dengan AI"}
                </button>

                {/* AI ERROR */}

                {aiErrors[result.job.id] && (
                  <p className="notice error">
                    {aiErrors[result.job.id]}
                  </p>
                )}

                {/* AI RESULT */}
                {aiResults[result.job.id] && (
                  <div className="ai-analysis-result">
                    <div className="ai-analysis-header">
                      <div>
                        <span className="ai-analysis-label">AI INSIGHT</span>
                        <h3>✨ Hasil Analisis Gemini</h3>
                        <p>Analisis kecocokan profil dengan persyaratan pekerjaan.</p>
                      </div>
                      <span className="ai-powered-badge">Gemini AI</span>
                    </div>

                    <div className="ai-score-card">
                      <div>
                        <span className="ai-score-label">Tingkat Kecocokan</span>
                        <strong className="ai-score-value">
                          {aiResults[result.job.id].matchScore}%
                        </strong>
                      </div>

                      <div className="ai-score-progress">
                        <div
                          className="ai-score-progress-fill"
                          style={{
                            width: `${aiResults[result.job.id].matchScore}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="ai-skill-grid">
                      <div className="ai-skill-group">
                        <h4>
                          <span className="ai-skill-indicator matched" />
                          Skill yang cocok
                        </h4>

                        <div className="ai-skill-tags">
                          {aiResults[result.job.id].matchedSkills.length > 0 ? (
                            aiResults[result.job.id].matchedSkills.map((skill) => (
                              <span className="ai-skill-chip matched" key={skill}>
                                ✓ {skill}
                              </span>
                            ))
                          ) : (
                            <p className="ai-empty-skill">Belum ada skill yang cocok.</p>
                          )}
                        </div>
                      </div>

                      <div className="ai-skill-group">
                        <h4>
                          <span className="ai-skill-indicator missing" />
                          Skill yang perlu dipelajari
                        </h4>

                        <div className="ai-skill-tags">
                          {aiResults[result.job.id].missingSkills.length > 0 ? (
                            aiResults[result.job.id].missingSkills.map((skill) => (
                              <span className="ai-skill-chip missing" key={skill}>
                                + {skill}
                              </span>
                            ))
                          ) : (
                            <p className="ai-empty-skill">
                              Semua skill persyaratan sudah terpenuhi.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ai-analysis-body">
                      <div className="ai-analysis-body-heading">
                        <span className="ai-analysis-icon">✦</span>
                        <div>
                          <h4>Analisis dan Rekomendasi</h4>
                          <p>Insight berdasarkan profil dan kemampuan kandidat.</p>
                        </div>
                      </div>

                      <div className="ai-analysis-text">
                        {aiResults[result.job.id].analysis}
                      </div>
                    </div>

                    <p className="ai-disclaimer">
                      Analisis AI merupakan rekomendasi pendukung dan bukan jaminan
                      penerimaan kerja.
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* JOBS WITHOUT REQUIREMENTS */}

      {jobsWithoutRequirements.length > 0 && (
        <p className="skill-help">
          {jobsWithoutRequirements.length} lowongan belum
          memiliki persyaratan skill sehingga belum dapat
          dihitung kecocokannya.
        </p>
      )}
    </section>
  );
}
