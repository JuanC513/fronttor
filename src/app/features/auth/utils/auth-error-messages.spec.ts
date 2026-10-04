import { authErrorMessage } from './auth-error-messages';

describe('authErrorMessage', () => {
  it('traduce los códigos conocidos de Supabase', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe(
      'Correo o contraseña incorrectos.',
    );
    expect(authErrorMessage({ code: 'email_not_confirmed' })).toBe(
      'Aún no has confirmado tu correo. Revisa tu bandeja de entrada.',
    );
    expect(authErrorMessage({ code: 'over_email_send_rate_limit' })).toContain(
      'demasiados correos',
    );
  });

  it('reconoce los fallos de red, que no llegan como AuthError', () => {
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'No pudimos conectar con el servidor. Revisa tu conexión a internet.',
    );
  });

  it('usa el mensaje genérico para códigos desconocidos', () => {
    expect(authErrorMessage({ code: 'algo_que_no_conocemos', message: 'boom' })).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });

  it('no revienta con valores que no son errores', () => {
    expect(authErrorMessage(null)).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
    expect(authErrorMessage(undefined)).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
    expect(authErrorMessage('cadena suelta')).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});
