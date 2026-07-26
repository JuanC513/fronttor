/**
 * Traduce los errores de Supabase Auth a mensajes en español listos para mostrar en la UI.
 *
 * `AuthService` relanza el `AuthError` crudo (a diferencia de los servicios de dominio, que
 * relanzan `new Error(error.message)`) justamente para que aquí podamos discriminar por
 * `error.code` en vez de comparar cadenas en inglés, que Supabase puede cambiar sin aviso.
 */

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  email_not_confirmed: 'Aún no has confirmado tu correo. Revisa tu bandeja de entrada.',
  email_address_invalid: 'El correo electrónico no es válido.',
  user_already_exists: 'Ya existe una cuenta con este correo.',
  email_exists: 'Ya existe una cuenta con este correo.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  same_password: 'La nueva contraseña debe ser distinta a la anterior.',
  over_email_send_rate_limit:
    'Enviamos demasiados correos a esta dirección. Espera unos minutos e inténtalo de nuevo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  signup_disabled: 'El registro de nuevas cuentas está deshabilitado.',
  provider_disabled: 'Este método de inicio de sesión no está habilitado.',
  validation_failed: 'Revisa los datos ingresados.',
  otp_expired: 'El enlace expiró o ya fue usado. Solicita uno nuevo.',
  session_expired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  user_not_found: 'No encontramos una cuenta con este correo.',
};

const FALLBACK_MESSAGE = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** `true` si el valor tiene la forma de un `AuthError` de Supabase. */
function hasErrorCode(error: unknown): error is { code?: string; message?: string } {
  return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
}

export function authErrorMessage(error: unknown): string {
  if (!hasErrorCode(error)) {
    return FALLBACK_MESSAGE;
  }

  const code = error.code;

  if (code && code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[code];
  }

  // Sin conexión el SDK lanza un TypeError de fetch, no un AuthError: vale la pena distinguirlo
  // porque el usuario puede actuar sobre ello.
  if (typeof error.message === 'string' && /failed to fetch|network/i.test(error.message)) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión a internet.';
  }

  return FALLBACK_MESSAGE;
}
