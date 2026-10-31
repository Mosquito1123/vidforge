export type UserRole = "user" | "admin" | "system";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends Omit<User, "credits"> {
  bio: string | null;
  locale: string;
}
