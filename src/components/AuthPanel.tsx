
import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function AuthPanel() {
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
    } catch (err) {
      console.error(err);
      setError(
        mode === "login"
          ? "Login gagal. Periksa email dan password."
          : "Registrasi gagal. Periksa data dan koneksi."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="form-panel">
      <h3>
        {mode === "login" ? "Login JobBoard AI" : "Buat Akun Baru"}
      </h3>

      <p>
        {mode === "login"
          ? "Masuk untuk mengelola akun dan aktivitasmu."
          : "Daftar sebagai pencari kerja."}
      </p>

      <form className="job-form" onSubmit={handleSubmit}>
        {mode === "register" && (
          <label>
            Nama Lengkap
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        {error && <p className="notice error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving
              ? "Memproses..."
              : mode === "login"
                ? "Login"
                : "Daftar"}
          </button>
        </div>
      </form>

      <p>
        {mode === "login"
          ? "Belum punya akun?"
          : "Sudah punya akun?"}
        {" "}
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "Daftar sekarang" : "Login"}
        </button>
      </p>
    </section>
  );
}
