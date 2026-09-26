<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
requireMethod('POST');

try {
    $body = jsonRequestBody();
    $nombre = is_string($body['nombre'] ?? null) ? trim($body['nombre']) : '';
    $apellido = is_string($body['apellido'] ?? null) ? trim($body['apellido']) : '';
    $email = is_string($body['email'] ?? null) ? strtolower(trim($body['email'])) : '';
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    $institucion = is_string($body['institucion'] ?? null) ? trim($body['institucion']) : null;
    $rol = $body['rol'] ?? null;

    if ($nombre === '' || strlen($nombre) > 100 || $apellido === '' || strlen($apellido) > 100
        || filter_var($email, FILTER_VALIDATE_EMAIL) === false || strlen($email) > 150
        || strlen($password) < 8 || strlen($password) > 255
        || ($institucion !== null && strlen($institucion) > 200)
        || !in_array($rol, ['ASESORADO', 'TUTOR'], true)) {
        sendJson(422, false, 'Verifica los datos del registro. La contraseña debe tener al menos 8 caracteres.');
    }

    $sql = 'INSERT INTO usuario (nombre, apellido, email, password_hash, institucion, rol)
            VALUES (:nombre, :apellido, :email, :password_hash, :institucion, :rol)
            RETURNING id_usuario, nombre, apellido, rol';
    $statement = getDatabaseConnection()->prepare($sql);
    $statement->execute([
        ':nombre' => $nombre,
        ':apellido' => $apellido,
        ':email' => $email,
        ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ':institucion' => $institucion === '' ? null : $institucion,
        ':rol' => $rol,
    ]);
    $user = $statement->fetch();
    setAuthenticatedUser($user);
    sendJson(201, true, 'Cuenta creada correctamente.', ['user' => $_SESSION['user']]);
} catch (PDOException $exception) {
    if ($exception->getCode() === '23505') {
        sendJson(409, false, 'Ya existe una cuenta registrada con ese correo.');
    }
    error_log('Error al registrar usuario: ' . $exception->getMessage());
    if (str_contains(strtolower($exception->getMessage()), 'could not find driver')) {
        sendJson(503, false, 'El controlador PostgreSQL de PHP no está habilitado. Activa pdo_pgsql y pgsql en php.ini y reinicia Apache.');
    }
    sendJson(500, false, 'No fue posible crear la cuenta.');
} catch (RuntimeException $exception) {
    error_log('Error de configuración al registrar usuario: ' . $exception->getMessage());
    sendJson(503, false, 'La conexión de la base de datos no está configurada. Crea el archivo .env a partir de .env.example y completa sus variables.');
} catch (Throwable $exception) {
    error_log('Error al registrar usuario: ' . $exception->getMessage());
    sendJson(500, false, 'No fue posible crear la cuenta.');
}
