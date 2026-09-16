<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/auth.php';
requireMethod('GET');

startMecaSession();
$user = $_SESSION['user'] ?? null;
if (!is_array($user)) sendJson(401, false, 'No hay una sesión activa.');
sendJson(200, true, 'Sesión activa.', ['user' => $user]);
