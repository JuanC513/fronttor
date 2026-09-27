-- ============================================================================
-- Un borrador es un borrador tambien en la base.
--
-- DEPENDE de 20260818130000, que declaro las policies de lectura del contenido,
-- de 20260921120000, que dejo is_teacher() con su nombre actual, y de
-- 20260926120000, que puso el filtro por publicacion en exercises -y que esta
-- migracion reemplaza por una version que mira la cadena entera-.
--
-- EL PROBLEMA, MEDIDO
-- Al verificar 20260926120000 con una cuenta de SOLO estudiante -la primera que
-- se ha podido usar- quedo confirmado que los ejercicios sin publicar estan
-- escondidos. Pero esa misma prueba destapo que exercises era la UNICA tabla de
-- contenido con ese filtro. modules, lessons y blocks conservan desde agosto:
--
--   create policy modules_select_authenticated on public.modules
--     for select to authenticated using (true);
--
-- Con la sesion de estudiante se leyo por la API el tema sin publicar
-- "Integracion y Practicas Guiadas", LOS NOMBRES DE SUS CUATRO SUBTEMAS -que si
-- estan publicados; lo unico no publicado es su tema- y el contenido completo de
-- un bloque en borrador.
--
-- No se ve en la aplicacion porque getLearningTree filtra por is_published en
-- los tres niveles. Es el mismo patron que este proyecto lleva cerrando: la
-- vista filtra, la base no.
--
-- POR QUE MIRA AL PADRE Y NO SOLO AL is_published PROPIO
-- Porque los cuatro subtemas que se leyeron estaban publicados: lo que debia
-- esconderlos era su tema. Un filtro que solo mirase la fila dejaria esa fuga
-- abierta. Mirando la cadena, la base entrega exactamente lo que muestra
-- getLearningTree, que parte de los temas publicados.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Temas
--
-- Sin padre, asi que es la forma simple, la misma de 20260926120000.
--
-- is_teacher() va primero en el `or` no por rendimiento -es stable y barata-
-- sino porque es la rama que explica la policy: el profesor lo ve todo, y lo
-- demas es la regla del estudiante.
-- ----------------------------------------------------------------------------

drop policy if exists modules_select_authenticated       on public.modules;
drop policy if exists modules_select_published_or_teacher on public.modules;

create policy modules_select_published_or_teacher on public.modules
  for select to authenticated
  using (public.is_teacher() or is_published);


-- ----------------------------------------------------------------------------
-- 2. Subtemas
--
-- POR QUE LA COMPROBACION DEL PADRE SE ESCRIBE EXPLICITA
-- La subconsulta de una policy pasa por la RLS de la tabla que consulta, de modo
-- que el `m.is_published` de aqui abajo es redundante: la policy de la seccion 1
-- ya escondera el tema sin publicar. Se deja escrito para que esta policy no
-- DEPENDA de que aquella siga siendo correcta. Es el mismo instinto que obligo a
-- filtrar por auth.uid() dentro de las funciones security definer aunque la RLS
-- pareciera bastar.
--
-- SOBRE EL ANIDAMIENTO
-- blocks mira a lessons, lessons mira a modules, y modules no mira a nadie: la
-- cadena es finita. Conviene saberlo antes de tocar la seccion 1, porque una
-- policy en modules que mirase a lessons cerraria el ciclo y PostgreSQL
-- responderia con recursion infinita en cada lectura de contenido.
--
-- SOBRE EL COSTE
-- Son busquedas por clave primaria -de lessons.module_id a modules.id- asi que
-- no hace falta ningun indice nuevo. Sobre 24 subtemas y 13 bloques es ruido, y
-- lo sigue siendo un orden de magnitud mas arriba.
-- ----------------------------------------------------------------------------

drop policy if exists lessons_select_authenticated       on public.lessons;
drop policy if exists lessons_select_published_or_teacher on public.lessons;

create policy lessons_select_published_or_teacher on public.lessons
  for select to authenticated
  using (
    public.is_teacher()
    or (
      is_published
      and exists (
        select 1 from public.modules m
        where m.id = lessons.module_id
          and m.is_published
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 3. Bloques
--
-- El que mas importa de los tres: es donde vive el material didactico. Un bloque
-- se ve cuando el, su subtema y su tema estan publicados.
-- ----------------------------------------------------------------------------

drop policy if exists blocks_select_authenticated       on public.blocks;
drop policy if exists blocks_select_published_or_teacher on public.blocks;

create policy blocks_select_published_or_teacher on public.blocks
  for select to authenticated
  using (
    public.is_teacher()
    or (
      is_published
      and exists (
        select 1
        from public.lessons l
        join public.modules m on m.id = l.module_id
        where l.id = blocks.lesson_id
          and l.is_published
          and m.is_published
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 4. Ejercicios
--
-- Ya tenia filtro desde 20260926120000, pero solo sobre su propio is_published,
-- asi que arrastraba el mismo hueco un escalon mas abajo: un ejercicio publicado
-- dentro de un subtema o un tema sin publicar seguia siendo legible. Se recrea
-- con la cadena completa.
--
-- El nombre de la policy no cambia: sigue describiendo lo que hace.
-- ----------------------------------------------------------------------------

drop policy if exists exercises_select_authenticated        on public.exercises;
drop policy if exists exercises_select_published_or_teacher on public.exercises;

create policy exercises_select_published_or_teacher on public.exercises
  for select to authenticated
  using (
    public.is_teacher()
    or (
      is_published
      and exists (
        select 1
        from public.lessons l
        join public.modules m on m.id = l.module_id
        where l.id = exercises.lesson_id
          and l.is_published
          and m.is_published
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 5. Cache de esquema de PostgREST
--
-- Las policies no viven en el cache, pero el notify no cuesta nada y mantiene la
-- costumbre: toda migracion que cambia lo que la API entrega lo repuebla.
-- ----------------------------------------------------------------------------

notify pgrst, 'reload schema';
