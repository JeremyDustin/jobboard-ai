
import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase";

interface JobSeekerProfileProps {
  uid: string;
  name: string;
  email: string;
}

interface ProfileForm {
  education: string;
  major: string;
  experience: string;
  bio: string;
  skills: string[];
}

const initialForm: ProfileForm = {
  education: "",
  major: "",
  experience: "",
  bio: "",
  skills: [],
};

export default function JobSeekerProfile({
  uid,
  name,
  email,
}: JobSeekerProfileProps) {
  const [form, setForm] = useState<ProfileForm>(initialForm);
  const [skillInput, setSkillInput] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Mengambil profil Job Seeker dari Firestore
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const userRef = doc(db, "users", uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
          throw new Error("Dokumen profil pengguna tidak ditemukan.");
        }

        const data = snapshot.data();

        if (!active) return;

        setForm({
          education: data.education ?? "",
          major: data.major ?? "",
          experience: data.experience ?? "",
          bio: data.bio ?? "",
          skills: Array.isArray(data.skills)
            ? data.skills.filter(
                (skill: unknown): skill is string =>
                  typeof skill === "string"
              )
            : [],
        });
      } catch (err) {
        console.error("Gagal mengambil profil:", err);

        if (active) {
          setError("Gagal memuat profil. Periksa koneksi dan Firestore Rules.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [uid]);

  // Mengubah data formulir
  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Menambahkan skill
  function handleAddSkill() {
    const newSkill = skillInput.trim();

    if (!newSkill) return;

    const alreadyExists = form.skills.some(
      (skill) =>
        skill.toLowerCase() === newSkill.toLowerCase()
    );

    if (alreadyExists) {
      setError("Skill tersebut sudah ada.");
      return;
    }

    setForm((current) => ({
      ...current,
      skills: [...current.skills, newSkill],
    }));

    setSkillInput("");
    setError("");
    setMessage("");
  }

  // Menghapus skill
  function handleRemoveSkill(skillToRemove: string) {
    setForm((current) => ({
      ...current,
      skills: current.skills.filter(
        (skill) => skill !== skillToRemove
      ),
    }));
  }

  // Menyimpan profil ke Firestore
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateDoc(doc(db, "users", uid), {
        education: form.education.trim(),
        major: form.major.trim(),
        experience: form.experience.trim(),
        bio: form.bio.trim(),
        skills: form.skills,
        profileUpdatedAt: serverTimestamp(),
      });

      setMessage("Profil berhasil disimpan!");
    } catch (err) {
      console.error("Gagal menyimpan profil:", err);

      setError(
        "Gagal menyimpan profil. Periksa koneksi dan Firestore Rules."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="form-panel">
        Memuat profil pengguna...
      </div>
    );
  }

  return (
    <div className="form-panel seeker-profile">
      <div className="form-panel-heading">
        <div>
          <span className="eyebrow">
            JOB SEEKER PROFILE
          </span>

          <h3>Profil dan Keahlian Saya</h3>

          <p>
            Lengkapi profil agar sistem dapat memberikan
            rekomendasi pekerjaan yang lebih relevan.
          </p>
        </div>
      </div>

      <form className="job-form" onSubmit={handleSubmit}>
        <label>
          Nama Lengkap
          <input value={name} disabled />
        </label>

        <label>
          Email
          <input value={email} disabled />
        </label>

        <label>
          Pendidikan Terakhir
          <select
            name="education"
            value={form.education}
            onChange={handleChange}
            required
          >
            <option value="">Pilih pendidikan</option>
            <option value="SMA/SMK">SMA / SMK</option>
            <option value="Diploma">Diploma</option>
            <option value="S1">Sarjana (S1)</option>
            <option value="S2">Magister (S2)</option>
            <option value="S3">Doktor (S3)</option>
          </select>
        </label>

        <label>
          Jurusan atau Program Studi
          <input
            name="major"
            value={form.major}
            onChange={handleChange}
            placeholder="Contoh: Informatika"
            required
          />
        </label>

        <label>
          Pengalaman
          <textarea
            name="experience"
            value={form.experience}
            onChange={handleChange}
            placeholder="Contoh: Pernah membuat aplikasi menggunakan React dan Firebase."
            rows={3}
          />
        </label>

        <label>
          Tentang Saya
          <textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            placeholder="Ceritakan secara singkat tentang diri dan tujuan kariermu."
            rows={3}
          />
        </label>

        <div className="skill-section">
          <label htmlFor="skill-input">
            Keahlian (Skills)
          </label>

          <p className="skill-help">
            Tambahkan keahlian yang kamu miliki.
            Contoh: React, JavaScript, TypeScript, Firebase.
          </p>

          <div className="skill-entry">
            <input
              id="skill-input"
              value={skillInput}
              onChange={(event) =>
                setSkillInput(event.target.value)
              }
              placeholder="Masukkan nama skill..."
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddSkill();
                }
              }}
            />

            <button
              type="button"
              className="secondary-button"
              onClick={handleAddSkill}
            >
              + Tambah
            </button>
          </div>

          <div className="skill-list">
            {form.skills.length === 0 ? (
              <p className="skill-help">
                Belum ada skill yang ditambahkan.
              </p>
            ) : (
              form.skills.map((skill) => (
                <span className="skill-tag" key={skill}>
                  {skill}

                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    aria-label={`Hapus ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {error && (
          <p className="notice error">{error}</p>
        )}

        {message && (
          <p className="notice success">{message}</p>
        )}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Profil"}
          </button>
        </div>
      </form>
    </div>
  );
}
