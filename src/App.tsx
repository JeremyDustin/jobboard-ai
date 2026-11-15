
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase";
import type { Job, JobType } from "./types";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AuthPanel from "./components/AuthPanel";
import JobSeekerProfile from "./components/JobSeekerProfile";
import JobRecommendations from "./components/JobRecommendations";

import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import EmployerDashboard from "./components/EmployerDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

const jobTypes: JobType[] = [
  "Full-time",
  "Part-time",
  "Internship",
  "Contract",
];

const initialForm = {
  position: "",
  company: "",
  location: "",
  type: "Full-time" as JobType,
  requiredSkillsText: "",
};

function AppContent() {
  const { profile, loading: authLoading, logout } = useAuth();
  const location = useLocation();

  // Menggulir ke bagian halaman yang sesuai dengan route aktif.
  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    const sectionId =
      location.hash.replace("#", "") ||
      (location.pathname === "/job-seeker"
        ? "job-seeker-profile"
        : location.pathname === "/employer"
          ? "employer-dashboard"
          : location.pathname === "/admin"
            ? "jobs"
            : "home");

    // Beri waktu agar section selesai dirender sebelum scroll dijalankan.
    const timer = window.setTimeout(() => {
      scrollToSection(sectionId);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [location.pathname, location.hash]);

  // Hak akses berdasarkan role pengguna
  const isAdmin = profile?.role === "admin";
  const isEmployer = profile?.role === "employer";
  const canCreateJobs = isAdmin || isEmployer;

  // Admin dapat mengelola semua lowongan.
  // Employer hanya dapat mengelola lowongan miliknya.
  function canManageJob(job: Job) {
    if (isAdmin) return true;

    return (
      isEmployer &&
      job.employerId === profile?.uid
    );
  }

  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("All");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Mengambil lowongan milik employer yang sedang login
  const myJobs = jobs.filter(
    (job) => job.employerId === profile?.uid
  );

  const openJobs = myJobs.filter(
    (job) => job.status === "Open"
  );

  const closedJobs = myJobs.filter(
    (job) => job.status === "Closed"
  );

  useEffect(() => {
    if (showForm) {
      document.getElementById("job-form")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [showForm]);

  // Mengambil data lowongan dari Firestore
  async function fetchJobs() {
    setLoading(true);
    setError("");

    try {
      const snapshot = await getDocs(collection(db, "jobs"));

      const jobList: Job[] = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })) as Job[];

      setJobs(jobList);
    } catch (err) {
      console.error("Gagal mengambil data:", err);
      setError(
        "Gagal mengambil data. Periksa koneksi dan Firestore Rules."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchJobs();
  }, []);

  // Pencarian dan filter lowongan
  const filteredJobs = jobs.filter((job) => {
    const keyword = searchTerm.trim().toLowerCase();

    const matchesSearch =
      job.position.toLowerCase().includes(keyword) ||
      job.company.toLowerCase().includes(keyword) ||
      job.location.toLowerCase().includes(keyword);

    const matchesType =
      filterType === "All" || job.type === filterType;

    return matchesSearch && matchesType;
  });

  // Mengubah isi formulir
  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Mengubah daftar skill dari input menjadi array.
  // Skill duplikat dihapus tanpa membedakan huruf besar/kecil.
  function parseRequiredSkills(value: string): string[] {
    const uniqueSkills = new Map<string, string>();

    value
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean)
      .forEach((skill) => {
        const normalized = skill.toLowerCase();

        if (!uniqueSkills.has(normalized)) {
          uniqueSkills.set(normalized, skill);
        }
      });

    return Array.from(uniqueSkills.values());
  }

  // Membuka formulir tambah lowongan
 function openAddForm() {
    if (!canCreateJobs) return;

    setEditingId(null);
    setForm(initialForm);
    setError("");
    setMessage("");
    setShowForm(true);

    setTimeout(() => {
      document
        .getElementById("job-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 100);
  }

  // Membuka formulir edit lowongan
  function handleEdit(job: Job) {
    if (!canManageJob(job)) return;

    setEditingId(job.id);

    setForm({
      position: job.position,
      company: job.company,
      location: job.location,
      type: job.type,
      requiredSkillsText: (job.requiredSkills ?? []).join(", "),
    });

    setError("");
    setMessage("");
    setShowForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Membatalkan formulir
  function handleCancelEdit() {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(false);
    setError("");
    setMessage("");
  }

  // Menambahkan atau memperbarui lowongan
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canCreateJobs || !profile) {
      setError(
        "Anda tidak memiliki izin untuk mengelola lowongan."
      );
      return;
    }

    // Memastikan pengguna masih memiliki hak untuk mengedit
    if (editingId) {
      const jobToEdit = jobs.find(
        (job) => job.id === editingId
      );

      if (!jobToEdit || !canManageJob(jobToEdit)) {
        setError(
          "Anda tidak memiliki izin untuk mengedit lowongan ini."
        );
        return;
      }
    }

    // Mengolah skill yang dimasukkan Employer
    const requiredSkills = parseRequiredSkills(
      form.requiredSkillsText
    );

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (editingId) {
        // Memperbarui data tanpa mengubah employerId
        await updateDoc(doc(db, "jobs", editingId), {
          position: form.position.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          type: form.type,
          requiredSkills,
          updatedAt: serverTimestamp(),
        });

        setMessage("Lowongan berhasil diperbarui!");
      } else {
        // Menambahkan lowongan baru dengan ID pemilik
        await addDoc(collection(db, "jobs"), {
          position: form.position.trim(),
          company: form.company.trim(),
          location: form.location.trim(),
          type: form.type,
          requiredSkills,
          status: "Open",
          employerId: profile.uid,
          createdAt: serverTimestamp(),
        });

        setMessage("Lowongan berhasil ditambahkan!");
      }

      setForm(initialForm);
      setEditingId(null);
      setShowForm(false);

      await fetchJobs();
    } catch (err) {
      console.error("Gagal menyimpan lowongan:", err);
      setError(
        "Gagal menyimpan data. Periksa koneksi dan Firestore Rules."
      );
    } finally {
      setSaving(false);
    }
  }

  // Mengubah status Open dan Closed
  async function handleToggleStatus(job: Job) {
    if (!canManageJob(job)) return;

    setError("");
    setMessage("");

    try {
      const newStatus =
        job.status === "Open" ? "Closed" : "Open";

      await updateDoc(doc(db, "jobs", job.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setMessage(
        `Status lowongan diubah menjadi ${newStatus}.`
      );

      await fetchJobs();
    } catch (err) {
      console.error("Gagal mengubah status:", err);
      setError("Gagal mengubah status lowongan.");
    }
  }

  // Menghapus lowongan
  async function handleDelete(job: Job) {
    if (!canManageJob(job)) return;

    const confirmed = window.confirm(
      `Hapus lowongan "${job.position}" di ${job.company}?`
    );

    if (!confirmed) return;

    setDeletingId(job.id);
    setError("");
    setMessage("");

    try {
      await deleteDoc(doc(db, "jobs", job.id));

      if (editingId === job.id) {
        setEditingId(null);
        setForm(initialForm);
        setShowForm(false);
      }

      setMessage("Lowongan berhasil dihapus!");

      await fetchJobs();
    } catch (err) {
      console.error("Gagal menghapus lowongan:", err);
      setError("Gagal menghapus lowongan.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="app-shell">
      <nav className="navbar">
        <Link className="brand" to="/">
          <span className="brand-icon">J</span>
          <span>
            JobBoard<span className="brand-light"> AI</span>
          </span>
        </Link>

        <div className="nav-links">
          <Link
            to="/#home"
            onClick={() => scrollToSection("home")}
          >
            Beranda
          </Link>

          <Link
            to="/#jobs"
            onClick={() => scrollToSection("jobs")}
          >
            Cari Lowongan
          </Link>

          {isEmployer && (
            <Link
              to="/employer#employer-dashboard"
              onClick={() => scrollToSection("employer-dashboard")}
            >
              Dashboard Saya
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin#jobs"
              onClick={() => scrollToSection("jobs")}
            >
              Dashboard Admin
            </Link>
          )}

          {profile?.role === "jobSeeker" && (
            <Link
              to="/job-seeker#job-seeker-profile"
              onClick={() => scrollToSection("job-seeker-profile")}
            >
              Dashboard Saya
            </Link>
          )}
        </div>

        

        <div className="nav-actions">
          {authLoading ? (
            <span className="nav-loading">Memuat akun...</span>
          ) : profile ? (
            <>
              <div className="nav-user">
                <div className="nav-avatar">
                  {profile.name.charAt(0).toUpperCase()}
                </div>

                <div className="nav-user-info">
                  <span className="nav-user-name">
                    {profile.name}
                  </span>

                  <span className="nav-user-role">
                    {profile.role === "jobSeeker"
                      ? "Job Seeker"
                      : profile.role === "employer"
                        ? "Employer"
                        : "Administrator"}
                  </span>
                </div>
              </div>

              <button
                className="nav-logout-button"
                onClick={() => void logout()}
              >
                <span>Logout</span>
                <span className="logout-icon">↗</span>
              </button>

              {canCreateJobs && (
                <button
                  className="nav-button"
                  onClick={openAddForm}
                >
                  + Buat Lowongan
                </button>
              )}
            </>
          ) : (
            <button
              className="nav-login-button"
              onClick={() =>
                document
                  .getElementById("auth-panel")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Login / Register
            </button>
          )}
        </div>

      </nav>

      <main>
        {/* HERO SECTION */}
        <section className="hero" id="home">
          <div className="hero-content">
            <span className="hero-label">
              TEMUKAN KESEMPATAN BERIKUTNYA
            </span>

            <h1>
              Temukan pekerjaan
              <br />
              <span>yang tepat untukmu.</span>
            </h1>

            <p className="hero-description">
              Jelajahi berbagai peluang kerja dan temukan langkah
              selanjutnya untuk perjalanan kariermu.
            </p>

            <div className="hero-search">
              <span className="search-symbol">⌕</span>

              <input
                aria-label="Cari lowongan"
                placeholder="Cari posisi, perusahaan, atau lokasi..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />

              <button
                onClick={() =>
                  document.getElementById("jobs")?.scrollIntoView({
                    behavior: "smooth",
                  })
                }
              >
                Cari Pekerjaan
              </button>
            </div>

            <p className="hero-note">
              {jobs.length} lowongan tersedia dalam JobBoard AI
            </p>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <div className="decoration-circle circle-one" />
            <div className="decoration-circle circle-two" />

            <div className="floating-card">
              <span className="floating-icon">✦</span>
              <div>
                <strong>Kesempatan baru</strong>
                <p>Mulai perjalanan kariermu</p>
              </div>
            </div>

            <div className="floating-dot dot-one" />
            <div className="floating-dot dot-two" />
          </div>
        </section>

        {/* AUTHENTICATION */}
        {!authLoading && !profile && (
          <section
            className="content-section"
            id="auth-panel"
          >
            <AuthPanel />
          </section>
        )}

        {/* JOB SEEKER PROFILE */}
        {profile?.role === "jobSeeker" && (
          <section
            className="content-section"
            id="job-seeker-profile"
          >
            <JobSeekerProfile
              uid={profile.uid}
              name={profile.name}
              email={profile.email}
            />
          </section>
        )}

        {/* JOB SEEKER RECOMMENDATIONS */}
        {profile?.role === "jobSeeker" && (
          <section
            className="content-section"
            id="job-recommendations"
          >
            <JobRecommendations
              uid={profile.uid}
              jobs={jobs}
            />
          </section>
        )}

        {/* EMPLOYER DASHBOARD */}
        {isEmployer && (
          <EmployerDashboard
            totalJobs={myJobs.length}
            openJobs={openJobs.length}
            closedJobs={closedJobs.length}
            onAddJob={openAddForm}
          />
        )}

        {/* JOB LIST SECTION */}
        <section className="content-section" id="jobs">
          <div className="section-top">
            <div>
              <span className="eyebrow">
                PELUANG KARIER
              </span>

              <h2>Lowongan pekerjaan</h2>

              <p>
                Temukan peluang yang sesuai dengan minatmu.
              </p>
            </div>

            {canCreateJobs && (
              <button
                className="primary-button"
                onClick={openAddForm}
              >
                + Tambah Lowongan
              </button>
            )}
          </div>

          {/* JOB FORM */}
          {showForm && canCreateJobs && (
            <section className="form-panel" id="job-form">
              <div className="form-panel-heading">
                <div>
                  <span className="eyebrow">
                    KELOLA LOWONGAN
                  </span>

                  <h3>
                    {editingId
                      ? "Edit Lowongan"
                      : "Pasang Lowongan Baru"}
                  </h3>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={handleCancelEdit}
                  aria-label="Tutup formulir"
                >
                  ×
                </button>
              </div>

              <form
                className="job-form"
                onSubmit={handleSubmit}
              >
                <label>
                  Posisi Pekerjaan

                  <input
                    name="position"
                    value={form.position}
                    onChange={handleChange}
                    placeholder="Contoh: Frontend Developer"
                    required
                  />
                </label>

                <label>
                  Nama Perusahaan

                  <input
                    name="company"
                    value={form.company}
                    onChange={handleChange}
                    placeholder="Contoh: Tech Indonesia"
                    required
                  />
                </label>

                <label>
                  Lokasi

                  <input
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Contoh: Manado"
                    required
                  />
                </label>

                <label>
                  Tipe Pekerjaan

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                  >
                    {jobTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                {/* REQUIRED SKILLS */}
                <label>
                  Skill yang Dibutuhkan

                  <input
                    name="requiredSkillsText"
                    value={form.requiredSkillsText}
                    onChange={handleChange}
                    placeholder="Contoh: React, TypeScript, Firebase"
                  />

                  <small>
                    Pisahkan setiap skill menggunakan tanda koma.
                    Contoh: React, JavaScript, CSS.
                  </small>
                </label>

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? "Menyimpan..."
                      : editingId
                        ? "Simpan Perubahan"
                        : "Simpan Lowongan"}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleCancelEdit}
                  >
                    Batal
                  </button>
                </div>
              </form>
            </section>
          )}

          {message && (
            <p className="notice success">
              {message}
            </p>
          )}

          {error && (
            <p className="notice error">
              {error}
            </p>
          )}

          {/* SEARCH FILTER */}
          <div className="listing-toolbar">
            <div className="result-count">
              <strong>{filteredJobs.length}</strong>{" "}
              lowongan ditemukan
            </div>

            <label className="filter-control">
              <span>Jenis pekerjaan</span>

              <select
                value={filterType}
                onChange={(event) =>
                  setFilterType(event.target.value)
                }
              >
                <option value="All">Semua jenis</option>

                {jobTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* JOB LIST */}
          {loading ? (
            <p className="empty-state">
              Memuat lowongan pekerjaan...
            </p>
          ) : error && jobs.length === 0 ? (
            <p className="empty-state">{error}</p>
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">⌕</span>

              <h3>Lowongan tidak ditemukan</h3>

              <p>
                Coba kata kunci lain atau ubah filter pekerjaanmu.
              </p>

              <button
                className="secondary-button"
                onClick={() => {
                  setSearchTerm("");
                  setFilterType("All");
                }}
              >
                Reset Pencarian
              </button>
            </div>
          ) : (
            <div className="job-list">
              {filteredJobs.map((job) => (
                <article
                  className="job-card"
                  key={job.id}
                >
                  <div className="job-card-top">
                    <div className="company-logo">
                      {job.company.trim().charAt(0).toUpperCase() ||
                        "J"}
                    </div>

                    <span
                      className={
                        job.status === "Open"
                          ? "status-badge status-open"
                          : "status-badge status-closed"
                      }
                    >
                      <span className="status-dot" />

                      {job.status === "Open"
                        ? "Dibuka"
                        : "Ditutup"}
                    </span>
                  </div>

                  <div className="job-info">
                    <h3>{job.position}</h3>

                    <p className="company-name">
                      {job.company}
                    </p>

                    <p className="job-location">
                      <span aria-hidden="true">⌖</span>{" "}
                      {job.location}
                    </p>

                    {job.requiredSkills &&
                      job.requiredSkills.length > 0 && (
                        <div className="skill-list">
                          {job.requiredSkills.map((skill) => (
                            <span
                              className="skill-tag"
                              key={skill}
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="job-card-bottom">
                    <span className="job-type">
                      {job.type}
                    </span>

                    <span className="job-id">
                      Job opportunity
                    </span>
                  </div>

                  {/* Hanya pemilik lowongan dan admin
                      yang melihat tombol pengelolaan */}
                  {canManageJob(job) && (
                    <div className="job-actions">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit(job)}
                      >
                        Edit
                      </button>

                      <button
                        className="status-button"
                        disabled={deletingId === job.id}
                        onClick={() =>
                          void handleToggleStatus(job)
                        }
                      >
                        {job.status === "Open"
                          ? "Tutup"
                          : "Buka"}
                      </button>

                      <button
                        className="delete-button"
                        disabled={deletingId === job.id}
                        onClick={() =>
                          void handleDelete(job)
                        }
                      >
                        {deletingId === job.id
                          ? "..."
                          : "Hapus"}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <Link className="brand footer-brand" to="/">
          <span className="brand-icon">J</span>

          <span>
            JobBoard<span className="brand-light"> AI</span>
          </span>
        </Link>

        <p>Temukan peluang. Bangun masa depan.</p>

        <span>
          © {new Date().getFullYear()} JobBoard AI
        </span>
      </footer>
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Halaman utama untuk semua pengunjung */}
        <Route path="/" element={<AppContent />} />

        {/* Halaman khusus Admin */}
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<AppContent />} />
        </Route>

        {/* Halaman khusus Employer */}
        <Route element={<ProtectedRoute allowedRoles={["employer"]} />}>
          <Route path="/employer" element={<AppContent />} />
        </Route>

        {/* Halaman khusus Job Seeker */}
        <Route element={<ProtectedRoute allowedRoles={["jobSeeker"]} />}>
          <Route path="/job-seeker" element={<AppContent />} />
        </Route>

        {/* URL tidak dikenal */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

