export type UserRole = 'student' | 'teacher';

/** La fila de `public.profiles` del usuario con sesion, con sus roles ya resueltos. */
export interface Profile {
  /** El id de `auth.users`. Es la clave con la que todo lo demas cuelga del usuario. */
  user_id: string;

  /** Correo de registro. No sale nunca hacia el modelo de IA. */
  email: string;

  /** Alta de la cuenta, en ISO 8601. Alimenta el «Miembro desde» del perfil. */
  created_at?: string;

  /**
   * Lo que el estudiante escribio sobre si mismo.
   *
   * Viaja al prompt como `<PERFIL_ESTUDIANTE>` y se trata como CONTENIDO NO CONFIABLE: ajusta
   * nivel, ejemplos y tono, nunca la tarea que se le pide al modelo.
   */
  profile_description: string | null;
  /**
   * Los roles concedidos al usuario, resueltos por nombre desde la tabla puente `user_roles`.
   *
   * Puede venir vacío: es lo que ocurre si alguien le retira todos los roles a mano. Los guards lo
   * tratan como «sin acceso a ninguna vista con rol», que es el comportamiento seguro.
   */
  roles: UserRole[];
}
