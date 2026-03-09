export interface Profile {
  id: string;
  email: string;
  role: 'student' | 'admin';
  created_at?: string;
}
