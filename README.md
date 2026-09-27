# M.E.C.A.

Una plataforma digital que conecta a estudiantes que dominan ciertas materias
con otros que requieren apoyo.

## Arquitectura actual

M.E.C.A. es un sitio 100% estático (HTML, CSS, JS) desplegado en GitHub Pages,
que se conecta directamente a Supabase (PostgreSQL + Auth + RLS) desde el
navegador usando `supabase-js`. No hay backend propio en producción.

### `legacy-php/` (histórico, no desplegado)

Esta carpeta contiene una primera implementación del backend en PHP/PDO,
usada mientras evaluábamos arquitecturas. Se descontinuó porque GitHub
Pages —nuestro hosting gratuito con disponibilidad 24/7— no ejecuta PHP.
Se conserva en el repositorio como evidencia del proceso de diseño y
porque documenta patrones de seguridad (sentencias preparadas, cálculo
de montos en servidor) que se reimplementaron como funciones RPC de
Postgres en la arquitectura actual (ver `database/migraciones/`).
No se debe modificar ni usar como referencia de cómo funciona el sitio hoy.

## `database/migraciones/` (historial de la base de datos)

Contiene, en orden, los scripts SQL que construyeron el esquema actual
en Supabase (tablas, RLS, funciones RPC) y los parches de seguridad
aplicados tras revisar el Security Advisor. Ver el README de esa carpeta
para más detalle.