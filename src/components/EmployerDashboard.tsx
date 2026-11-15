
interface EmployerDashboardProps {
  totalJobs: number;
  openJobs: number;
  closedJobs: number;
  onAddJob: () => void;
}

export default function EmployerDashboard({
  totalJobs,
  openJobs,
  closedJobs,
  onAddJob,
}: EmployerDashboardProps) {
  return (
    <section className="content-section" id="employer-dashboard">
      <div className="form-panel">
        <span className="eyebrow">
          EMPLOYER DASHBOARD
        </span>

        <h2>Dashboard Perusahaan</h2>

        <p>
          Kelola dan pantau lowongan pekerjaan yang Anda
          publikasikan.
        </p>

        <div className="listing-toolbar">
          <div className="result-count">
            <strong>{totalJobs}</strong>{" "}
            total lowongan saya
          </div>

          <div className="result-count">
            <strong>{openJobs}</strong>{" "}
            lowongan dibuka
          </div>

          <div className="result-count">
            <strong>{closedJobs}</strong>{" "}
            lowongan ditutup
          </div>
        </div>

        <button
          className="primary-button"
          onClick={onAddJob}
        >
          + Pasang Lowongan Baru
        </button>
      </div>
    </section>
  );
}
