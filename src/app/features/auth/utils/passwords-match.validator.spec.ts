import { FormBuilder } from '@angular/forms';
import { passwordsMatch } from './passwords-match.validator';

describe('passwordsMatch', () => {
  const formBuilder = new FormBuilder();

  const buildGroup = (password: string, confirmPassword: string) =>
    formBuilder.group(
      { password: [password], confirmPassword: [confirmPassword] },
      { validators: passwordsMatch('password', 'confirmPassword') },
    );

  it('no marca error cuando las contraseñas coinciden', () => {
    expect(buildGroup('unaClave123', 'unaClave123').hasError('passwordsMismatch')).toBeFalse();
  });

  it('marca error cuando las contraseñas difieren', () => {
    expect(buildGroup('unaClave123', 'otraClave456').hasError('passwordsMismatch')).toBeTrue();
  });

  it('no marca error mientras la confirmación está vacía', () => {
    // De la confirmación vacía ya se encarga `Validators.required`; adelantar el mensaje de
    // "no coinciden" solo sería ruido mientras el usuario escribe.
    expect(buildGroup('unaClave123', '').hasError('passwordsMismatch')).toBeFalse();
  });

  it('distingue mayúsculas y minúsculas', () => {
    expect(buildGroup('unaClave123', 'UNACLAVE123').hasError('passwordsMismatch')).toBeTrue();
  });
});
