
export type JobType =
  | "Full-time"
  | "Part-time"
  | "Internship"
  | "Contract";

export type JobStatus = "Open" | "Closed";

export interface Job {
  id: string;
  position: string;
  company: string;
  location: string;
  type: JobType;
  status: JobStatus;
  employerId: string;

  // Skill yang dibutuhkan untuk lowongan
  // Opsional agar data lowongan lama tetap kompatibel
  requiredSkills?: string[];
}
