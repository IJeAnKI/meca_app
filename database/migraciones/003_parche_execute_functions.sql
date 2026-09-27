-- ============================================================
-- PARCHE 2: corrige las advertencias "Public/Signed-In Users Can
-- Execute SECURITY DEFINER Function" del Security Advisor.
--
-- Causa: Postgres concede EXECUTE a PUBLIC (incluye anon Y
-- authenticated) en toda función nueva, salvo que se revoque.
-- Ejecuta esto en el SQL Editor de Supabase.
-- ============================================================

-- crear_reserva: solo usuarios con sesión iniciada.
REVOKE EXECUTE ON FUNCTION public.crear_reserva(uuid, varchar, timestamp, integer, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_reserva(uuid, varchar, timestamp, integer, varchar) TO authenticated;

-- obtener_mi_perfil: solo usuarios con sesión iniciada.
REVOKE EXECUTE ON FUNCTION public.obtener_mi_perfil() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.obtener_mi_perfil() TO authenticated;

-- handle_new_user: es una función de trigger. Nadie debe poder
-- llamarla directamente (ni anon ni authenticated); solo la dispara
-- Postgres internamente cuando se inserta una fila en auth.users.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ============================================================
-- Verificación sugerida:
-- Advisors -> Security Advisor -> Refresh. Deberían quedar 0
-- errores y 0 advertencias. Si te queda alguna sobre "search_path"
-- de función mutable, dímelo porque es otro hallazgo distinto y
-- también tiene arreglo puntual.
-- ============================================================
