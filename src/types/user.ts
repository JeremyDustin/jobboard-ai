
export type UserRole = "admin" | "employer" | "jobSeeker";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}
