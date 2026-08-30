


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."delete_block"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order INTEGER;
  v_lesson_id INTEGER;
BEGIN
  SELECT "order", lesson_id INTO v_order, v_lesson_id FROM blocks WHERE id = p_id;
  DELETE FROM blocks WHERE id = p_id;
  UPDATE blocks SET "order" = "order" - 1
  WHERE lesson_id = v_lesson_id AND "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_block"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_lesson"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order INTEGER;
  v_module_id INTEGER;
BEGIN
  SELECT "order", module_id INTO v_order, v_module_id FROM lessons WHERE id = p_id;
  DELETE FROM lessons WHERE id = p_id;
  UPDATE lessons SET "order" = "order" - 1
  WHERE module_id = v_module_id AND "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_lesson"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_module"("p_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_order INTEGER;
BEGIN
  SELECT "order" INTO v_order FROM modules WHERE id = p_id;
  DELETE FROM modules WHERE id = p_id;
  UPDATE modules SET "order" = "order" - 1 WHERE "order" > v_order;
END;
$$;


ALTER FUNCTION "public"."delete_module"("p_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (user_id, email, role_id)
  values (new.id, new.email, 1); -- 1 = student
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  INSERT INTO blocks (name, content, lesson_id, "order")
  VALUES (
    p_name,
    p_content,
    p_lesson_id,
    COALESCE((SELECT MAX("order") FROM blocks WHERE lesson_id = p_lesson_id), 0) + 1
  );
END;$$;


ALTER FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO lessons (name, module_id, "order")
  VALUES (
    p_name,
    p_module_id,
    COALESCE((SELECT MAX("order") FROM lessons WHERE module_id = p_module_id), 0) + 1
  );
END;
$$;


ALTER FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_module"("p_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO modules (name, "order")
  VALUES (p_name, COALESCE((SELECT MAX("order") FROM modules), 0) + 1);
END;
$$;


ALTER FUNCTION "public"."insert_module"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_blocks"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE blocks SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE blocks SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_blocks"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_lessons"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE lessons SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE lessons SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_lessons"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_modules"("p_ids" integer[]) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Primero mueve todos a valores negativos temporales para liberar todas las posiciones
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE modules SET "order" = -i WHERE id = p_ids[i];
  END LOOP;

  -- Luego asigna los valores finales según la posición en el array
  FOR i IN 1..array_length(p_ids, 1) LOOP
    UPDATE modules SET "order" = i WHERE id = p_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_modules"("p_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  UPDATE blocks
  SET name = p_name, content = p_content, lesson_id = p_lesson_id
  WHERE id = p_id;
END;$$;


ALTER FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  UPDATE lessons
  SET name = p_name, module_id = p_module_id
  WHERE id = p_id;
END;$$;


ALTER FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_module"("p_id" integer, "p_name" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE modules
  SET name = p_name
  WHERE id = p_id;
END;
$$;


ALTER FUNCTION "public"."update_module"("p_id" integer, "p_name" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."blocks" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "content" "text",
    "lesson_id" integer,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."blocks" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."blocks_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."blocks_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."blocks_id_seq" OWNED BY "public"."blocks"."id";



CREATE TABLE IF NOT EXISTS "public"."exercises" (
    "id" integer NOT NULL,
    "title" character varying(255) NOT NULL,
    "content" "text",
    "lesson_id" integer
);


ALTER TABLE "public"."exercises" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."exercises_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."exercises_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."exercises_id_seq" OWNED BY "public"."exercises"."id";



CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "module_id" integer,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."lessons_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lessons_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lessons_id_seq" OWNED BY "public"."lessons"."id";



CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."modules_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."modules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."modules_id_seq" OWNED BY "public"."modules"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" integer DEFAULT 1 NOT NULL,
    "profile_description" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" integer NOT NULL,
    "name" character varying(50) NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."roles_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."roles_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."roles_id_seq" OWNED BY "public"."roles"."id";



ALTER TABLE ONLY "public"."blocks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."blocks_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."exercises" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."exercises_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."lessons" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lessons_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."modules" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."modules_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."roles" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."roles_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_order_per_lesson_unique" UNIQUE ("lesson_id", "order");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_order_per_module_unique" UNIQUE ("module_id", "order");



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_order_unique" UNIQUE ("order");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blocks"
    ADD CONSTRAINT "blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."exercises"
    ADD CONSTRAINT "exercises_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Enable insert for authenticated users only" ON "public"."blocks" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."lessons" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."modules" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable insert for users based on user_id" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable read for authenticated users only" ON "public"."blocks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for authenticated users only" ON "public"."lessons" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for authenticated users only" ON "public"."modules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."blocks" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."lessons" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."modules" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable update for users based on user_id" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Enable users to view their own data only" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."exercises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_block"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_block"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_block"("p_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_lesson"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_lesson"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_lesson"("p_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_module"("p_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_module"("p_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_module"("p_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_block"("p_name" "text", "p_content" "text", "p_lesson_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_lesson"("p_name" "text", "p_module_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_module"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_module"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_module"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_blocks"("p_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_blocks"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_blocks"("p_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_lessons"("p_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_lessons"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_lessons"("p_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_modules"("p_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_modules"("p_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_modules"("p_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_block"("p_id" integer, "p_name" "text", "p_content" "text", "p_lesson_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lesson"("p_id" integer, "p_name" "text", "p_module_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_module"("p_id" integer, "p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_module"("p_id" integer, "p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_module"("p_id" integer, "p_name" "text") TO "service_role";



GRANT ALL ON TABLE "public"."blocks" TO "anon";
GRANT ALL ON TABLE "public"."blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."blocks" TO "service_role";



GRANT ALL ON SEQUENCE "public"."blocks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."blocks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."blocks_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."exercises" TO "anon";
GRANT ALL ON TABLE "public"."exercises" TO "authenticated";
GRANT ALL ON TABLE "public"."exercises" TO "service_role";



GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."exercises_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lessons_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lessons_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lessons_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON SEQUENCE "public"."modules_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."modules_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."modules_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







