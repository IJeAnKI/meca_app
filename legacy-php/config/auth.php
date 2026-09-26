<?php
declare(strict_types=1);

require_once __DIR__ . '/response.php';

function startMecaSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? null) === '443');
    session_name('meca_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function setAuthenticatedUser(array $user): void
{
    startMecaSession();
    session_regenerate_id(true);
    $_SESSION['user'] = [
        'id_usuario' => (int) $user['id_usuario'],
        'nombre' => $user['nombre'],
        'apellido' => $user['apellido'],
        'rol' => $user['rol'],
    ];
}

function authenticatedUser(?string $requiredRole = null): array
{
    startMecaSession();
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user)) sendJson(401, false, 'Debes iniciar sesión para realizar esta acción.');
    if ($requiredRole !== null && $user['rol'] !== $requiredRole) {
        sendJson(403, false, 'Tu rol no tiene permiso para realizar esta acción.');
    }
    return $user;
}

function jsonRequestBody(): array
{
    $contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? '');
    if (!str_starts_with($contentType, 'application/json')) {
        sendJson(415, false, 'El contenido debe ser application/json.');
    }
    try {
        $body = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        sendJson(400, false, 'El JSON enviado no es válido.');
    }
    if (!is_array($body)) sendJson(422, false, 'El cuerpo de la solicitud no es válido.');
    return $body;
}
