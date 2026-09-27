import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { ProgressService } from '@domain/learning/services/progress-service';

/**
 * Impide abrir por URL un subtema al que el estudiante todavía no ha llegado.
 *
 * Vive en la feature y no en `core/guards/` porque sabe qué es un subtema. Los otros guards están
 * ahí por depender de `AuthService`, que sí es transversal; esto es una regla del recorrido.
 *
 * **No es la barrera.** La barrera está en `mark_lesson_viewed` y `submit_exercise_attempt`, que
 * desde `20260929120000` se niegan a crear progreso fuera de orden. Este guard es lo que evita que
 * el estudiante vea contenido que su progreso no va a registrar, que sin él era la parte confusa:
 * leías un subtema y no contaba.
 */
export const lessonReachableGuard: CanActivateFn = async (route: ActivatedRouteSnapshot) => {
  const progressService = inject(ProgressService);
  const router = inject(Router);

  const alModulos = () => router.createUrlTree(['/learning/modules']);
  const lessonId = Number(route.paramMap.get('lessonId'));

  // `> 0` y no solo `isInteger`: `Number(null)` es 0, así que una ruta sin `lessonId` pasaría el
  // filtro y se iría a preguntar por el subtema 0, que no existe.
  if (!Number.isInteger(lessonId) || lessonId <= 0) return alModulos();

  try {
    return (await progressService.isLessonReachable(lessonId)) || alModulos();
  } catch (err) {
    // Se deja pasar a propósito. La barrera real está en la base, así que lo único que se pierde
    // aquí es la comodidad; dejar a alguien sin poder leer por un fallo de red sería peor que el
    // problema que este guard resuelve. Es el mismo criterio que ya aplica `markViewed`.
    console.error('No se pudo comprobar la disponibilidad del subtema', err);
    return true;
  }
};
