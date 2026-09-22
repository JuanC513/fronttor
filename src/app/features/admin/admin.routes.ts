import { Routes } from '@angular/router';
import { AdminMain } from './pages/admin-main/admin-main';
import { AdminExercises } from './pages/admin-exercises/admin-exercises';
import { ModuleFormDialog } from './components/module-form-dialog/module-form-dialog';
import { LessonFormDialog } from './components/lesson-form-dialog/lesson-form-dialog/lesson-form-dialog';
import { BlockFormDialog } from './components/block-form-dialog/block-form-dialog/block-form-dialog';
import { ExerciseFormDialog } from './components/exercise-form-dialog/exercise-form-dialog';

/**
 * `exercises` va antes que la ruta vacia: son hermanas, y si la vacia se evaluara primero se
 * quedaria con el segmento.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'exercises',
    component: AdminExercises,
    children: [
      { path: 'new', component: ExerciseFormDialog },
      { path: 'edit/:id', component: ExerciseFormDialog },
    ],
  },
  {
    path: '',
    component: AdminMain,
    children: [
      { path: 'module/new', component: ModuleFormDialog },
      { path: 'module/edit/:id', component: ModuleFormDialog },
      { path: 'lesson/new', component: LessonFormDialog },
      { path: 'lesson/edit/:id', component: LessonFormDialog },
      { path: 'block/new', component: BlockFormDialog },
      { path: 'block/edit/:id', component: BlockFormDialog },
    ],
  },
  { path: '**', redirectTo: '' },
];
