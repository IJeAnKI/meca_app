<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';
requireMethod('POST');

try {
    $body = jsonRequestBody();
    $email = is_string($body['email'] ?? null) ? strtolower(trim($body['email'])) : '';
    $password = is_string($body['password'] ?? null) ? $body['password'] : '';
    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false || $password === '') {
        sendJson(422, false, 'Ingresa un correo y contraseña válidos.');
    }

    $statement = getDatabaseConnection()->prepare(
        'SELECT id_usuario, nombre, apellido, rol, password_hash FROM usuario WHERE email = :email'
    );
    $statement->execute([':email' => $email]);
    $user = $statement->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        sendJson(401, false, 'Correo o contraseña incorrectos.');
    }
    if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
        getDatabaseConnection()->prepare('UPDATE usuario SET password_hash = :hash WHERE id_usuario = :id')
            ->execute([':hash' => password_hash($password, PASSWORD_DEFAULT), ':id' => $user['id_usuario']]);
    }
    setAuthenticatedUser($user);
    sendJson(200, true, 'Inicio de sesión correcto.', ['user' => $_SESSION['user']]);
} catch (Throwable $exception) {
    error_log('Error al iniciar sesión: ' . $exception->getMessage());
    sendJson(500, false, 'No fue posible iniciar sesión.');
}
