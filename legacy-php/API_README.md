# API REST de M.E.C.A.

## Arquitectura

`reservas.html` carga `js/app.js`; este consulta rutas relativas de la API PHP con `fetch()`. PHP usa PDO y el esquema PostgreSQL ya existente. La misma API selecciona PostgreSQL local o Supabase con `DB_CONNECTION`; el frontend nunca recibe credenciales ni claves de Supabase.

```text
reservas.html -> app.js -> API PHP/PDO -> PostgreSQL local o Supabase
```

La consulta de tutores usa `STRING_AGG` para agrupar materias, de modo que cada tutor activo se entrega una sola vez con un arreglo `materias`.

## Instalación con XAMPP

1. Copie el proyecto a `C:\xampp\htdocs\meca_app`.
2. En `C:\xampp\php\php.ini`, habilite `extension=pdo_pgsql` y `extension=pgsql`; reinicie Apache.
3. Cree una base PostgreSQL e importe el esquema proporcionado. La API no modifica tablas ni ENUM.
4. Copie `.env.example` como `.env` y rellene únicamente las variables del entorno elegido. `.env` está ignorado por Git; `.htaccess` añade una denegación para ese archivo cuando Apache permite reglas por directorio.
5. Abra `http://localhost/meca_app/reservas.html`.

La página y la API comparten el origen `http://localhost`, por lo que no se configura CORS. La URL relativa del frontend se resuelve como `http://localhost/meca_app/api/tutores/listar.php`.

## Configuración de bases de datos

En `.env`, seleccione solo una opción:

```dotenv
DB_CONNECTION=local
```

Para desarrollo local complete `LOCAL_DB_HOST`, `LOCAL_DB_PORT`, `LOCAL_DB_NAME`, `LOCAL_DB_USER`, `LOCAL_DB_PASSWORD` y, si corresponde, `LOCAL_DB_SSLMODE`.

Para Supabase use:

```dotenv
DB_CONNECTION=supabase
SUPABASE_DB_HOST=db.tu-project-ref.supabase.co
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=tu_contraseña_de_base_de_datos
SUPABASE_DB_SSLMODE=require
```

Obtenga host, usuario, contraseña y el tipo de conexión en **Supabase Dashboard → Database → Connect**. Algunos proyectos usan host/puerto de pooler en lugar del host directo; copie exactamente el conjunto que proporciona Supabase. No use en este proyecto la `service_role key`, secretos JWT ni API keys en PHP, HTML o JavaScript: PDO se conecta con credenciales PostgreSQL que permanecen en `.env`.

Las variables de entorno definidas en Apache/Windows tienen prioridad sobre `.env`, lo que permite despliegues sin guardar un archivo local.

## Endpoints

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/tutores/listar.php` | Tutores activos, sin duplicados |
| GET | `/api/tutores/listar.php?materia=Programacion&precio_max=18000` | Catálogo filtrado en PostgreSQL |
| GET | `/api/tutores/obtener.php?id=1` | Un tutor activo y sus materias |
| POST | `/api/auth/registrar.php` | Crea cuenta `ASESORADO` o `TUTOR` e inicia sesión |
| POST | `/api/auth/iniciar_sesion.php` | Valida contraseña e inicia sesión |
| GET | `/api/auth/sesion.php` | Devuelve el usuario de la sesión actual |
| POST | `/api/auth/cerrar_sesion.php` | Cierra la sesión actual |
| POST | `/api/reservas/crear.php` | Crea una reserva validada |

Respuesta de lista:

```json
{
  "success": true,
  "message": "Tutores obtenidos correctamente",
  "data": [{
    "id_tutor": 1,
    "nombre": "Juan",
    "apellido": "Pérez",
    "formacion_academica": "Ingeniería de Sistemas",
    "precio_hora": 18000,
    "promedio_calificacion": 4.8,
    "estado": "ACTIVO",
    "certificacion_capacitado": true,
    "materias": ["Bases de Datos", "Programación"]
  }]
}
```

Un tutor ausente devuelve HTTP 404 con `success: false` y `data: null`. La API valida métodos, parámetros y JSON; utiliza sentencias preparadas y no devuelve errores SQL al cliente.

## Pruebas con Postman o Thunder Client

Use estas URLs si el proyecto está en `C:\xampp\htdocs\meca_app`:

- `GET http://localhost/meca_app/api/tutores/listar.php`
- `GET http://localhost/meca_app/api/tutores/listar.php?materia=Programacion`
- `GET http://localhost/meca_app/api/tutores/listar.php?precio_max=18000`
- `GET http://localhost/meca_app/api/tutores/listar.php?materia=Programacion&precio_max=18000`
- `GET http://localhost/meca_app/api/tutores/obtener.php?id=1`

Para registrar una cuenta, envíe `POST /api/auth/registrar.php` con `Content-Type: application/json`:

```json
{
  "nombre": "Ana",
  "apellido": "Pérez",
  "email": "ana@example.com",
  "institucion": "Universidad",
  "rol": "ASESORADO",
  "password": "una-contraseña-segura"
}
```

Use `"rol": "TUTOR"` para una cuenta de tutor. El registro usa `password_hash()` y el login `POST /api/auth/iniciar_sesion.php` recibe `email` y `password`; ambos crean una cookie de sesión `HttpOnly` con `SameSite=Lax`.

Para crear una reserva, inicie sesión primero como `ASESORADO` y envíe `POST` con `Content-Type: application/json`:

```json
{
  "id_tutor": 4,
  "materia": "Programacion",
  "fecha_hora_inicio": "2026-10-15T14:00",
  "duracion_horas": 1,
  "room_token_url": null
}
```

El endpoint toma el estudiante de la sesión y exige el rol `ASESORADO`; verifica que el tutor exista, esté `ACTIVO` y ofrezca la materia. El servidor calcula `monto_total` con `precio_hora × duracion_horas` y fija la comisión en 15; no acepta importes del cliente que puedan ser alterados.

## Problemas comunes

- **HTTP 500 al conectar:** revise las variables del destino seleccionado, PostgreSQL accesible y la extensión `pdo_pgsql` activa.
- **Supabase no conecta:** confirme host/puerto del modo de conexión elegido y que `SUPABASE_DB_SSLMODE=require` permanezca activo.
- **Catálogo vacío:** inserte usuarios, tutores y materias de prueba coherentes, con `perfil_tutor.estado` en `ACTIVO`.
- **Abre el HTML con `file:///`:** use Apache/XAMPP; PHP no se ejecuta desde el sistema de archivos.
- **Reserva rechazada:** use IDs existentes y una materia que pertenezca exactamente al tutor.

El registro e inicio de sesión ya son funcionales. No hay todavía un formulario de fecha/hora para reservar en el frontend; por eso el botón del catálogo informa el rol requerido. Una cuenta `TUTOR` no se muestra en el catálogo hasta que un proceso posterior cree su `perfil_tutor` y lo deje en estado `ACTIVO`.
