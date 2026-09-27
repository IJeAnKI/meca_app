-- ============================================================
-- PARCHE: corrige el hallazgo "Security Definer View" (CRITICAL)
-- sobre public.vista_catalogo_tutores
--
-- Ejecuta esto DESPUÉS del script BaseDeDatosMECA_Supabase.sql
-- que ya corriste. No borra tablas ni datos existentes.
-- ============================================================

-- 1. Restringe qué columnas de "usuario" puede ver cualquiera
--    (Supabase, por defecto, concede SELECT de TODAS las columnas
--    a anon/authenticated en tablas nuevas; el RLS por sí solo no
--    protege columnas, solo filas).
REVOKE SELECT ON usuario FROM anon, authenticated;
GRANT SELECT (id_usuario, nombre, apellido, institucion) ON usuario TO anon, authenticated;

-- 2. Nueva política: además de ver su propia fila, cualquiera puede
--    ver la fila de un usuario que sea tutor ACTIVO (pero solo las
--    columnas concedidas arriba: nombre, apellido, institucion).
CREATE POLICY "usuario_select_publica_tutor_activo" ON usuario
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfil_tutor pt
            WHERE pt.id_tutor = usuario.id_usuario AND pt.estado = 'ACTIVO'
        )
    );

-- 3. perfil_tutor: además del dueño, cualquiera puede ver un perfil
--    ACTIVO (sin esto, la vista en modo "invoker" no vería nada).
CREATE POLICY "perfil_tutor_select_publica" ON perfil_tutor
    FOR SELECT USING (estado = 'ACTIVO');

-- 4. materia_tutor: la política anterior era FOR ALL restringida al
--    dueño, lo cual bloqueaba también la lectura pública. Se agrega
--    una política de SELECT pública para materias de tutores activos.
CREATE POLICY "materia_tutor_select_publica" ON materia_tutor
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM perfil_tutor pt
            WHERE pt.id_tutor = materia_tutor.id_tutor AND pt.estado = 'ACTIVO'
        )
    );

-- 5. Función para leer TU PROPIO perfil completo (correo, teléfono,
--    rol, puntos_xp), ya que el GRANT del paso 1 ya no expone esas
--    columnas directamente. SECURITY DEFINER + filtro por auth.uid()
--    hace que sea seguro: solo puedes obtener tu propia fila.
CREATE OR REPLACE FUNCTION public.obtener_mi_perfil()
RETURNS usuario
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT * FROM usuario WHERE id_usuario = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.obtener_mi_perfil() TO authenticated;

-- 6. Recrear la vista como SECURITY INVOKER: ahora respeta el RLS y
--    los permisos de columna del rol que consulta (anon/authenticated),
--    en vez de correr con los permisos de quien la creó.
DROP VIEW IF EXISTS vista_catalogo_tutores;

CREATE VIEW vista_catalogo_tutores
WITH (security_invoker = true)
AS
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

-- ============================================================
-- Verificación manual sugerida después de correr esto:
-- 1. Panel Supabase -> Advisors -> Security Advisor -> Rerun linter.
--    El hallazgo "Security Definer View" ya no debería aparecer.
-- 2. Como anon (o probando en el navegador sin sesión), consulta:
--      GET .../rest/v1/usuario?select=*
--    Debe devolver SOLO id_usuario, nombre, apellido, institucion,
--    y solo de tutores ACTIVOS. Nunca debe devolver email.
-- 3. Con sesión iniciada, llama:
--      supabase.rpc('obtener_mi_perfil')
--    Debe devolver tu fila completa (incluido tu email/telefono/rol).
-- ============================================================
