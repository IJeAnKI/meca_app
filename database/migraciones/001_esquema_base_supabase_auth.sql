-- ============================================================
-- BASE DE DATOS: PLATAFORMA DE TUTORÍAS (M.E.C.A.) - SUPABASE
-- Versión 2: integrada con Supabase Auth + RLS real + RPC segura
--
-- CÓMO USAR:
-- 1. Abre tu proyecto en supabase.com -> SQL Editor -> New query.
-- 2. Pega TODO este archivo y ejecútalo (Run).
-- 3. Esto BORRA las tablas anteriores y sus datos. Si ya tienes
--    usuarios de prueba creados con el esquema viejo (password_hash),
--    bórralos también desde Authentication > Users, porque ese
--    esquema no es compatible con este.
-- ============================================================

-- 0. LIMPIEZA DE OBJETOS PREVIOS
DROP VIEW IF EXISTS vista_catalogo_tutores CASCADE;
DROP TABLE IF EXISTS insignia_usuario CASCADE;
DROP TABLE IF EXISTS blog_post CASCADE;
DROP TABLE IF EXISTS evaluacion CASCADE;
DROP TABLE IF EXISTS reserva CASCADE;
DROP TABLE IF EXISTS horario_disponible CASCADE;
DROP TABLE IF EXISTS materia_tutor CASCADE;
DROP TABLE IF EXISTS perfil_tutor CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.crear_reserva(uuid, varchar, timestamp, integer, varchar) CASCADE;
DROP TYPE IF EXISTS rol_usuario CASCADE;
DROP TYPE IF EXISTS estado_tutor CASCADE;
DROP TYPE IF EXISTS dia_semana CASCADE;
DROP TYPE IF EXISTS estado_pago CASCADE;
DROP TYPE IF EXISTS estado_reserva CASCADE;

-- 1. TIPOS ENUM (igual que antes)
CREATE TYPE rol_usuario AS ENUM ('ASESORADO', 'TUTOR', 'ADMIN');
CREATE TYPE estado_tutor AS ENUM ('ACTIVO', 'EN_CAPACITACION', 'INACTIVO');
CREATE TYPE dia_semana AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO');
CREATE TYPE estado_pago AS ENUM ('PENDIENTE', 'APROBADO', 'REEMBOLSADO');
CREATE TYPE estado_reserva AS ENUM ('PROGRAMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA');

-- 2. TABLA USUARIO
-- id_usuario YA NO es SERIAL: es el mismo UUID que Supabase Auth
-- asigna en auth.users. Ya no existe password_hash: Supabase Auth
-- guarda y cifra la contraseña en un esquema separado que la API
-- pública nunca expone.
CREATE TABLE usuario (
    id_usuario UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    telefono VARCHAR(20),
    institucion VARCHAR(200),
    rol rol_usuario NOT NULL DEFAULT 'ASESORADO',
    puntos_xp INTEGER NOT NULL DEFAULT 0,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_usuario_puntos CHECK (puntos_xp >= 0)
);

-- 3. TABLA PERFIL_TUTOR
CREATE TABLE perfil_tutor (
    id_tutor UUID PRIMARY KEY REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    formacion_academica TEXT,
    precio_hora NUMERIC(10,2) NOT NULL,
    promedio_calificacion NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    estado estado_tutor NOT NULL DEFAULT 'EN_CAPACITACION',
    certificacion_capacitado BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_precio_hora CHECK (precio_hora >= 0),
    CONSTRAINT chk_promedio_calificacion CHECK (promedio_calificacion >= 0 AND promedio_calificacion <= 5)
);

-- 4. TABLA MATERIA_TUTOR
CREATE TABLE materia_tutor (
    id_materia SERIAL PRIMARY KEY,
    id_tutor UUID NOT NULL REFERENCES perfil_tutor(id_tutor) ON DELETE CASCADE,
    nombre_materia VARCHAR(150) NOT NULL,
    descripcion_materia TEXT
);

-- 5. TABLA HORARIO_DISPONIBLE
CREATE TABLE horario_disponible (
    id_horario SERIAL PRIMARY KEY,
    id_tutor UUID NOT NULL REFERENCES perfil_tutor(id_tutor) ON DELETE CASCADE,
    dia_semana dia_semana NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    CONSTRAINT chk_horario CHECK (hora_fin > hora_inicio)
);

-- 6. TABLA RESERVA
-- No se otorga permiso de INSERT directo desde el cliente: se crea
-- exclusivamente mediante la función crear_reserva() (ver más abajo),
-- que calcula el monto en el servidor.
CREATE TABLE reserva (
    id_reserva SERIAL PRIMARY KEY,
    id_estudiante UUID NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
    id_tutor UUID NOT NULL REFERENCES perfil_tutor(id_tutor) ON DELETE RESTRICT,
    materia VARCHAR(150) NOT NULL,
    fecha_hora_inicio TIMESTAMP NOT NULL,
    duracion_horas INTEGER NOT NULL DEFAULT 1,
    monto_total NUMERIC(10,2) NOT NULL,
    comision_meca NUMERIC(5,2) NOT NULL,
    pago_estado estado_pago NOT NULL DEFAULT 'PENDIENTE',
    estado_reserva estado_reserva NOT NULL DEFAULT 'PROGRAMADA',
    room_token_url VARCHAR(500),
    CONSTRAINT chk_duracion CHECK (duracion_horas > 0),
    CONSTRAINT chk_monto CHECK (monto_total >= 0),
    CONSTRAINT chk_comision CHECK (comision_meca >= 0 AND comision_meca <= 100)
);

-- 7. TABLA EVALUACION (para el módulo M05, futuro)
CREATE TABLE evaluacion (
    id_evaluacion SERIAL PRIMARY KEY,
    id_reserva INTEGER NOT NULL UNIQUE REFERENCES reserva(id_reserva) ON DELETE CASCADE,
    calificacion_estrellas INTEGER NOT NULL,
    comentario TEXT,
    fecha_emision TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_calificacion CHECK (calificacion_estrellas >= 1 AND calificacion_estrellas <= 5)
);

-- 8. TABLA BLOG_POST (para el módulo M06, futuro)
CREATE TABLE blog_post (
    id_post SERIAL PRIMARY KEY,
    id_autor UUID NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    materia_relacionada VARCHAR(150),
    contenido TEXT NOT NULL,
    fecha_publicacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABLA INSIGNIA_USUARIO (para el módulo M06, futuro)
CREATE TABLE insignia_usuario (
    id_insignia SERIAL PRIMARY KEY,
    id_usuario UUID NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
    nombre_insignia VARCHAR(150) NOT NULL,
    fecha_otorgado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. ÍNDICES
CREATE INDEX idx_materia_tutor ON materia_tutor(id_tutor);
CREATE INDEX idx_horario_tutor ON horario_disponible(id_tutor);
CREATE INDEX idx_reserva_estudiante ON reserva(id_estudiante);
CREATE INDEX idx_reserva_tutor ON reserva(id_tutor);
CREATE INDEX idx_reserva_fecha ON reserva(fecha_hora_inicio);
CREATE INDEX idx_blog_autor ON blog_post(id_autor);
CREATE INDEX idx_insignia_usuario ON insignia_usuario(id_usuario);

-- ============================================================
-- 11. TRIGGER: crear perfil automáticamente al registrarse
-- Cuando el frontend llama supabase.auth.signUp({ email, password,
-- options: { data: { nombre, apellido, telefono, institucion, rol } } }),
-- Supabase crea la fila en auth.users y este trigger crea la fila
-- correspondiente en public.usuario.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.usuario (id_usuario, nombre, apellido, email, telefono, institucion, rol)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'nombre', ''),
        COALESCE(new.raw_user_meta_data->>'apellido', ''),
        new.email,
        new.raw_user_meta_data->>'telefono',
        new.raw_user_meta_data->>'institucion',
        COALESCE(NULLIF(new.raw_user_meta_data->>'rol', ''), 'ASESORADO')::rol_usuario
    );
    RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 12. FUNCIÓN RPC: crear_reserva
-- El precio y el monto NUNCA llegan desde el cliente: se calculan
-- aquí, con los mismos datos y validaciones que tenías en
-- api/reservas/crear.php, pero corriendo dentro de Postgres.
-- ============================================================
CREATE OR REPLACE FUNCTION public.crear_reserva(
    p_id_tutor UUID,
    p_materia VARCHAR,
    p_fecha_hora_inicio TIMESTAMP,
    p_duracion_horas INTEGER,
    p_room_token_url VARCHAR DEFAULT NULL
)
RETURNS reserva
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_precio_hora NUMERIC(10,2);
    v_monto_total NUMERIC(10,2);
    v_comision NUMERIC(5,2) := 15.00;
    v_reserva reserva;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para reservar.';
    END IF;

    IF p_duracion_horas IS NULL OR p_duracion_horas < 1 THEN
        RAISE EXCEPTION 'duracion_horas debe ser un entero mayor o igual a 1.';
    END IF;

    IF p_materia IS NULL OR length(trim(p_materia)) = 0 OR length(p_materia) > 150 THEN
        RAISE EXCEPTION 'materia inválida.';
    END IF;

    SELECT pt.precio_hora INTO v_precio_hora
    FROM perfil_tutor pt
    WHERE pt.id_tutor = p_id_tutor
      AND pt.estado = 'ACTIVO'
      AND EXISTS (
          SELECT 1 FROM materia_tutor mt
          WHERE mt.id_tutor = pt.id_tutor
            AND LOWER(mt.nombre_materia) = LOWER(p_materia)
      );

    IF v_precio_hora IS NULL THEN
        RAISE EXCEPTION 'El tutor no está activo o no ofrece esa materia.';
    END IF;

    v_monto_total := round(v_precio_hora * p_duracion_horas, 2);

    INSERT INTO reserva (
        id_estudiante, id_tutor, materia, fecha_hora_inicio,
        duracion_horas, monto_total, comision_meca, room_token_url
    ) VALUES (
        auth.uid(), p_id_tutor, p_materia, p_fecha_hora_inicio,
        p_duracion_horas, v_monto_total, v_comision, p_room_token_url
    ) RETURNING * INTO v_reserva;

    RETURN v_reserva;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crear_reserva TO authenticated;

-- ============================================================
-- 13. ROW LEVEL SECURITY: cada quien ve/edita solo lo suyo
-- ============================================================
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfil_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE materia_tutor ENABLE ROW LEVEL SECURITY;
ALTER TABLE horario_disponible ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserva ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post ENABLE ROW LEVEL SECURITY;
ALTER TABLE insignia_usuario ENABLE ROW LEVEL SECURITY;

-- usuario: cada persona solo lee/edita su propia fila.
-- (El trigger usa SECURITY DEFINER, así que el INSERT al registrarse
-- no necesita política propia.)
CREATE POLICY "usuario_select_propio" ON usuario
    FOR SELECT USING (auth.uid() = id_usuario);
CREATE POLICY "usuario_update_propio" ON usuario
    FOR UPDATE USING (auth.uid() = id_usuario) WITH CHECK (auth.uid() = id_usuario);

-- perfil_tutor: el tutor administra su propio perfil.
CREATE POLICY "perfil_tutor_select_propio" ON perfil_tutor
    FOR SELECT USING (auth.uid() = id_tutor);
CREATE POLICY "perfil_tutor_insert_propio" ON perfil_tutor
    FOR INSERT WITH CHECK (auth.uid() = id_tutor);
CREATE POLICY "perfil_tutor_update_propio" ON perfil_tutor
    FOR UPDATE USING (auth.uid() = id_tutor) WITH CHECK (auth.uid() = id_tutor);

-- materia_tutor / horario_disponible: el tutor administra las suyas.
CREATE POLICY "materia_tutor_todo_propio" ON materia_tutor
    FOR ALL USING (
        auth.uid() = (SELECT pt.id_tutor FROM perfil_tutor pt WHERE pt.id_tutor = materia_tutor.id_tutor)
    ) WITH CHECK (
        auth.uid() = (SELECT pt.id_tutor FROM perfil_tutor pt WHERE pt.id_tutor = materia_tutor.id_tutor)
    );
CREATE POLICY "horario_disponible_todo_propio" ON horario_disponible
    FOR ALL USING (
        auth.uid() = (SELECT pt.id_tutor FROM perfil_tutor pt WHERE pt.id_tutor = horario_disponible.id_tutor)
    ) WITH CHECK (
        auth.uid() = (SELECT pt.id_tutor FROM perfil_tutor pt WHERE pt.id_tutor = horario_disponible.id_tutor)
    );

-- reserva: solo el estudiante o el tutor de esa reserva la pueden ver.
-- No hay política de INSERT: se crea solo vía crear_reserva().
CREATE POLICY "reserva_select_involucrados" ON reserva
    FOR SELECT USING (auth.uid() = id_estudiante OR auth.uid() = id_tutor);

-- evaluacion / blog_post / insignia_usuario: bases listas para cuando
-- se implementen esos módulos (M05/M06). Por ahora, solo lectura pública
-- de evaluaciones (para mostrar reseñas) y escritura del propio dueño.
CREATE POLICY "evaluacion_select_publica" ON evaluacion FOR SELECT USING (true);
CREATE POLICY "blog_post_select_publica" ON blog_post FOR SELECT USING (true);
CREATE POLICY "blog_post_insert_propio" ON blog_post
    FOR INSERT WITH CHECK (auth.uid() = id_autor);
CREATE POLICY "insignia_select_propia" ON insignia_usuario
    FOR SELECT USING (auth.uid() = id_usuario);

-- ============================================================
-- 14. VISTA PÚBLICA DEL CATÁLOGO
-- Las tablas base están bloqueadas (RLS: solo el dueño), pero esta
-- vista la crea el rol "postgres" (dueño por defecto), y en Postgres
-- una vista corre con los permisos de su dueño salvo que se marque
-- security_invoker. Por eso SÍ puede juntar datos de usuario y
-- perfil_tutor y exponerlos públicamente, sin abrir las tablas base.
-- ============================================================
CREATE OR REPLACE VIEW vista_catalogo_tutores AS
SELECT
    pt.id_tutor,
    u.nombre,
    u.apellido,
    u.institucion,
    pt.formacion_academica,
    pt.precio_hora,
    pt.promedio_calificacion,
    pt.estado,
    pt.certificacion_capacitado,
    COALESCE(
        json_agg(
            json_build_object(
                'id_materia', mt.id_materia,
                'nombre_materia', mt.nombre_materia,
                'descripcion', mt.descripcion_materia
            )
        ) FILTER (WHERE mt.id_materia IS NOT NULL), '[]'
    ) AS materias
FROM perfil_tutor pt
INNER JOIN usuario u ON pt.id_tutor = u.id_usuario
LEFT JOIN materia_tutor mt ON pt.id_tutor = mt.id_tutor
WHERE pt.estado = 'ACTIVO'
GROUP BY pt.id_tutor, u.nombre, u.apellido, u.institucion,
         pt.formacion_academica, pt.precio_hora, pt.promedio_calificacion,
         pt.estado, pt.certificacion_capacitado;

GRANT SELECT ON vista_catalogo_tutores TO anon, authenticated;

-- Nota deliberada: NO se expone el correo (u.email) en esta vista
-- pública, a diferencia de la versión anterior. El correo es un dato
-- sensible (Ley 1581) y no aporta nada al catálogo.
