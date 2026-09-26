<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/** Crea la conexión PDO usando el destino elegido en DB_CONNECTION. */
function getDatabaseConnection(): PDO
{
    $config = databaseConfiguration();
    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $config['host'], $config['port'], $config['name']);
    if ($config['sslMode'] !== null && $config['sslMode'] !== '') {
        $dsn .= ';sslmode=' . $config['sslMode'];
    }
    return new PDO($dsn, $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
