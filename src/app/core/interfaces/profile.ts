export type UserRole = 'student' | 'admin';

export interface Profile {
  user_id: string;
  email: string;
  created_at?: string;
  profile_description: string | null;
  role_id: number;
  role: UserRole;
}
