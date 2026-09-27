# Migraciones de base de datos (Supabase)

Estos scripts documentan, en orden, cómo se construyó el esquema actual
de la base de datos en Supabase (PostgreSQL). Ya fueron ejecutados
manualmente en el SQL Editor del proyecto de Supabase — este historial
existe para trazabilidad y para poder reconstruir la base desde cero si
fuera necesario, no para volver a correrlos sobre la base actual.

| Archivo | Qué hace |
|---|---|
| `001_esquema_base_supabase_auth.sql` | Esquema completo: tablas, tipos ENUM, integración con Supabase Auth (`auth.users`), trigger de creación automática de perfil, función RPC `crear_reserva()` con cálculo de monto en servidor, políticas RLS iniciales y la vista pública `vista_catalogo_tutores`. |
| `002_parche_security_definer_view.sql` | Corrige un hallazgo `CRITICAL` del Security Advisor de Supabase: la vista del catálogo corría con privilegios del creador (bypass de RLS). Se cambió a `security_invoker` y se ajustaron permisos por columna. |
| `003_parche_execute_functions.sql` | Corrige advertencias del Security Advisor: revoca el `EXECUTE` público por defecto de las funciones `SECURITY DEFINER`. |
| `004_parche_revoke_anon.sql` | Corrige la advertencia restante: revoca `EXECUTE` del rol `anon` específicamente (Supabase lo concede por defecto además de a `PUBLIC`). |

## Si necesitas reconstruir la base desde cero

Ejecuta los 4 archivos en el SQL Editor, en el orden numérico. El
resultado final queda con: **0 errores y 2 advertencias aceptadas**
(`crear_reserva` y `obtener_mi_perfil` son ejecutables por usuarios
autenticados por diseño — documentado en cada archivo).

## Si vas a agregar una migración nueva

Numera el siguiente archivo como `005_...sql`, descríbelo en la tabla de
arriba, y agrégalo aquí después de correrlo en Supabase. El SQL Editor
de Supabase no tiene control de versiones propio — este archivo es el
único lugar donde queda un historial legible de cómo cambió el esquema.
