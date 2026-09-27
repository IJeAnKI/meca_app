-- ============================================================
-- PARCHE 3: cierra el "Public Can Execute" (rol anon) restante.
--
-- Supabase configura, por defecto, privilegios que conceden EXECUTE
-- directamente a "anon" y "authenticated" sobre funciones nuevas del
-- esquema public (además de PUBLIC). El parche anterior solo revocó
-- de PUBLIC; faltaba revocar explícitamente de anon.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.crear_reserva(uuid, varchar, timestamp, integer, varchar) FROM anon;
REVOKE EXECUTE ON FUNCTION public.obtener_mi_perfil() FROM anon;

-- Reafirmamos que solo authenticated puede ejecutarlas (sin cambios,
-- pero lo dejamos explícito para que quede claro en el historial).
GRANT EXECUTE ON FUNCTION public.crear_reserva(uuid, varchar, timestamp, integer, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_mi_perfil() TO authenticated;

-- ============================================================
-- Después de correr esto, en el Security Advisor deberían quedar
-- SOLO estas 2 advertencias (ya no 4):
--   - "Signed-In Users Can Execute SECURITY DEFINER Function" en
--     crear_reserva
--   - "Signed-In Users Can Execute SECURITY DEFINER Function" en
--     obtener_mi_perfil
-- Esas dos NO se deben eliminar: son el comportamiento deseado
-- (un usuario con sesión iniciada SÍ debe poder llamarlas). Quedan
-- como "riesgo aceptado y documentado", no como pendiente.
-- ============================================================
