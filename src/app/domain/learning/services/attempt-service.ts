import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase-service';
import { CodeRunnerState } from '@domain/code-runner/models/code-runner-model';
import { CriterionResult } from '@domain/code-runner/validation/probe-model';

/** Lo que la vista de resolución entrega al registrar un envío. */
export interface AttemptSubmission {
  exerciseId: number;
  code: CodeRunnerState;
  passed: boolean;
  results: CriterionResult[];
}

/** El código de un envío anterior, para retomarlo al reabrir el ejercicio. */
export interface AttemptDraft {
  code: CodeRunnerState;
  passed: boolean;
  createdAt: string;
  /** La pista que la IA dio sobre este envío, si el estudiante llegó a pedirla. */
  feedback: string | null;
}

/**
 * Los envíos del estudiante a un ejercicio.
 *
 * Servicio aparte de `ExerciseService` porque no es una operación sobre el ejercicio sino sobre el
 * intento: escribe en otra tabla y, cuando el intento aprueba, dispara el recálculo del progreso
 * del subtema. Mezclarlo con el CRUD del panel del profesor confundiría dos cosas que solo
 * comparten el nombre.
 *
 * Igual que en `ProgressService`, la escritura va por una RPC `security definer` y no por un
 * `insert` directo: la RPC resuelve el usuario con `auth.uid()` del lado del servidor, así que
 * nadie puede registrar un intento a nombre de otro. Lo que sí queda en manos del cliente es el
 * valor de `passed` —limitación conocida y documentada en `exercise-attempt-model.ts`—, porque
 * validar de verdad exigiría ejecutar el código fuera del navegador.
 */
@Injectable({
  providedIn: 'root',
})
export class AttemptService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly supabase = this.supabaseService.client;
  readonly refreshTrigger = signal(0);

  private notifyRefresh(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  /**
   * Registra un envío y devuelve el id con el que quedó guardado.
   *
   * Se guardan todos, no solo el que aprueba: el historial es lo que después permite hablar del
   * progreso real del estudiante. La RPC se encarga sola de marcar el subtema como empezado y, si
   * el intento aprueba, de recalcular si queda completado.
   *
   * **El id es lo que permite archivar después la retroalimentación en el intento correcto.**
   * Entre enviar y recibir la pista del modelo pasan segundos, tiempo de sobra para que el
   * estudiante reenvíe; sin el id habría que buscar «su intento más reciente» y la pista del envío
   * anterior acabaría colgada del nuevo.
   */
  async submitAttempt(submission: AttemptSubmission): Promise<number> {
    const { data, error } = await this.supabase.rpc('submit_exercise_attempt', {
      p_exercise_id: submission.exerciseId,
      p_html: submission.code.html,
      p_css: submission.code.css,
      p_js: submission.code.js,
      p_passed: submission.passed,
      p_results: submission.results,
    });

    if (error) throw new Error(error.message);
    this.notifyRefresh();

    return data as number;
  }

  /**
   * El último envío del estudiante a un ejercicio, o `null` si nunca ha enviado nada.
   *
   * Es lo que permite retomar el trabajo donde se dejó sin guardar nada nuevo: el código de cada
   * intento ya se almacena, así que el «borrador» no es una funcionalidad de almacenamiento sino
   * una lectura que hasta ahora nadie hacía. Al vivir en el servidor, además, sigue al estudiante
   * a otro navegador.
   *
   * **El filtro por `user_id` no sobra**, por tercera vez en este dominio: `exercise_attempts`
   * tiene dos políticas de lectura, y una cuenta con rol de profesor ve por RLS los intentos de
   * todo el mundo. Sin acotarlo, «tu último envío» podría ser el de otra persona —y con el
   * `order by created_at desc`, justamente el más reciente de cualquiera—.
   */
  async getLastAttempt(exerciseId: number, userId: string): Promise<AttemptDraft | null> {
    const { data, error } = await this.supabase
      .from('exercise_attempts')
      .select('submitted_html, submitted_css, submitted_js, passed, created_at, feedback')
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const row = data as {
      submitted_html: string;
      submitted_css: string;
      submitted_js: string;
      passed: boolean;
      created_at: string;
      feedback: string | null;
    };

    return {
      code: { html: row.submitted_html, css: row.submitted_css, js: row.submitted_js },
      passed: row.passed,
      createdAt: row.created_at,
      feedback: row.feedback,
    };
  }

  /**
   * Guarda la pista de la IA contra el último envío del estudiante a ese ejercicio.
   *
   * Va por RPC y no por un `update` porque no hay ninguna vía directa: `authenticated` tiene sobre
   * `exercise_attempts` solo `SELECT, INSERT`, y tampoco existe una política de update. Las dos
   * cosas faltan a propósito —un intento enviado es el registro de lo que hizo el estudiante y no
   * se reescribe—, así que la única excepción contemplada es esta, y vive del lado del servidor.
   *
   * Recibe el id del intento y no el del ejercicio. Es la diferencia entre archivar la pista donde
   * corresponde y adivinar: «el último intento de este ejercicio» deja de ser el correcto en cuanto
   * el estudiante reenvía mientras el modelo piensa, y ahí el profesor leería una retroalimentación
   * que no describe el código de esa fila.
   */
  async setFeedback(attemptId: number, feedback: string): Promise<void> {
    const { error } = await this.supabase.rpc('set_attempt_feedback', {
      p_attempt_id: attemptId,
      p_feedback: feedback,
    });

    if (error) throw new Error(error.message);
  }
}
