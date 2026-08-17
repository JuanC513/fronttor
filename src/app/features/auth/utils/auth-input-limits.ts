/**
 * Límites de longitud de los campos de autenticación.
 *
 * Salen de restricciones externas, por eso viven en un solo
 * lugar en vez de repetirse en cada formulario.
 */

/** Mínimo exigido en el cliente. Supabase permite menos, aquí se es más estricto a propósito. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Supabase Auth cifra con bcrypt, que solo considera los primeros 72 caracteres. Sin este
 * tope, una contraseña más larga se guarda truncada en silencio y el usuario nunca se entera
 * de que el resto de lo que escribió es irrelevante.
 */
export const MAX_PASSWORD_LENGTH = 72;

/** Longitud máxima de una dirección de correo según el RFC 5321. */
export const MAX_EMAIL_LENGTH = 254;
