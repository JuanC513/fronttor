export type UserRole = 'student' | 'admin';

export interface Profile {
  user_id: string;
  email: string;
  created_at?: string;
  profile_description: string | null;
  /**
   * Los roles concedidos al usuario, resueltos por nombre desde la tabla puente `user_roles`.
   *
   * Puede venir vacío: es lo que ocurre si alguien le retira todos los roles a mano. Los guards lo
   * tratan como «sin acceso a ninguna vista con rol», que es el comportamiento seguro.
   */
  roles: UserRole[];
}
