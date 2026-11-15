
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import type { UserRole } from "../types/user";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const { profile, loading } = useAuth();

  // Menunggu proses autentikasi selesai
  if (loading) {
    return <p>Memeriksa autentikasi...</p>;
  }

  // Pengguna belum login
  if (!profile) {
    return <Navigate to="/" replace />;
  }

  // Role pengguna tidak memiliki izin
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  // Pengguna memiliki izin
  return <Outlet />;
}
