-- ============================================================================
-- Solucion de referencia de los ejercicios.
--
-- Cada ejercicio guarda, junto a su codigo inicial, un codigo que SI cumple sus
-- criterios. Es lo que permite comprobar que los criterios estan bien escritos.
--
-- DEPENDE de 20260830120000_content_publication.sql, que define la version
-- vigente de insert_exercise y update_exercise.
--
-- Sin una solucion de referencia, un criterio mal escrito solo se descubre
-- cuando un estudiante se queda atascado sin salida. El caso tipico es
-- computed_style: se compara contra getComputedStyle, asi que 'red' nunca casa
-- con lo que devuelve el navegador, que es 'rgb(255, 0, 0)'. Correr los
-- criterios contra un codigo que deberia aprobarlos convierte ese error en algo
-- que se ve al crear el ejercicio.
--
-- La solucion no se expone al estudiante mientras resuelve; que llegue a
-- mostrarse, y cuando, es una decision de la interfaz.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Las columnas
--
-- Vacias por defecto, igual que el codigo inicial: un ejercicio sin solucion
-- escrita es valido, solo que sus criterios no se pueden comprobar.
-- ----------------------------------------------------------------------------

alter table public.exercises
  add column if not exists solution_html text not null default '',
  add column if not exists solution_css  text not null default '',
  add column if not exists solution_js   text not null default '';


-- ----------------------------------------------------------------------------
-- 2. RPC de administracion
--
-- Se sueltan antes de recrearse: `create or replace` con parametros de mas no
-- reemplaza, crea una SOBRECARGA, y con dos firmas vivas PostgREST responde
-- "Could not choose the best candidate function" en cada llamada.
--
-- Al soltar una funcion se pierden sus permisos, de ahi el grant que la sigue.
--
-- La solucion va junto al codigo inicial en el orden de parametros porque son
-- lo mismo visto desde los dos extremos: de donde parte el estudiante y a donde
-- deberia llegar.
-- ----------------------------------------------------------------------------

drop function if exists public.insert_exercise(
  integer, text, text, text, text, text, text, jsonb, text, boolean
);
create or replace function public.insert_exercise(
  p_lesson_id     integer,
  p_name          text,
  p_statement     text,
  p_difficulty    text    DEFAULT 'media',
  p_starter_html  text    DEFAULT '',
  p_starter_css   text    DEFAULT '',
  p_starter_js    text    DEFAULT '',
  p_solution_html text    DEFAULT '',
  p_solution_css  text    DEFAULT '',
  p_solution_js   text    DEFAULT '',
  p_criteria      jsonb   DEFAULT '[]'::jsonb,
  p_source        text    DEFAULT 'manual',
  p_is_published  boolean DEFAULT false
)
returns void
language plpgsql
as $function$
BEGIN
  INSERT INTO exercises (
    lesson_id, name, statement, difficulty,
    starter_html, starter_css, starter_js,
    solution_html, solution_css, solution_js,
    criteria, source, is_published, "order"
  )
  VALUES (
    p_lesson_id,
    p_name,
    p_statement,
    p_difficulty,
    p_starter_html,
    p_starter_css,
    p_starter_js,
    p_solution_html,
    p_solution_css,
    p_solution_js,
    p_criteria,
    p_source,
    p_is_published,
    COALESCE((SELECT MAX("order") FROM exercises WHERE lesson_id = p_lesson_id), 0) + 1
  );
END;
$function$;

grant execute on function public.insert_exercise(
  integer, text, text, text, text, text, text, text, text, text, jsonb, text, boolean
) to authenticated;

drop function if exists public.update_exercise(
  integer, text, text, integer, text, text, text, text, jsonb, text, boolean
);
create or replace function public.update_exercise(
  p_id            integer,
  p_name          text,
  p_statement     text,
  p_lesson_id     integer,
  p_difficulty    text    DEFAULT 'media',
  p_starter_html  text    DEFAULT '',
  p_starter_css   text    DEFAULT '',
  p_starter_js    text    DEFAULT '',
  p_solution_html text    DEFAULT '',
  p_solution_css  text    DEFAULT '',
  p_solution_js   text    DEFAULT '',
  p_criteria      jsonb   DEFAULT '[]'::jsonb,
  p_source        text    DEFAULT 'manual',
  p_is_published  boolean DEFAULT false
)
returns void
language plpgsql
as $function$
BEGIN
  UPDATE exercises
  SET name          = p_name,
      statement     = p_statement,
      lesson_id     = p_lesson_id,
      difficulty    = p_difficulty,
      starter_html  = p_starter_html,
      starter_css   = p_starter_css,
      starter_js    = p_starter_js,
      solution_html = p_solution_html,
      solution_css  = p_solution_css,
      solution_js   = p_solution_js,
      criteria      = p_criteria,
      source        = p_source,
      is_published  = p_is_published
  WHERE id = p_id;
END;
$function$;

grant execute on function public.update_exercise(
  integer, text, text, integer, text, text, text, text, text, text, text, jsonb, text, boolean
) to authenticated;


-- ============================================================================
-- Comprobacion
--
--   -- Las tres columnas existen
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'exercises'
--     and column_name like 'solution%';
--
--   -- Y ninguna RPC quedo duplicada: una fila por nombre
--   select proname, count(*)
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('insert_exercise', 'update_exercise')
--   group by proname;
-- ============================================================================
