<?php
declare(strict_types=1);

/**
 * Carga un archivo .env local sin depender de paquetes externos.
 * Las variables ya definidas por Apache/Windows tienen prioridad.
 */
function loadLocalEnvironment(): void
{
    static $loaded = false;
    if ($loaded) return;
    $loaded = true;

    $file = dirname(__DIR__, 2) . '/.env';
    if (!is_readable($file)) return;

    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value);
        if ($name === '' || getenv($name) !== false) continue;
        if (strlen($value) >= 2 && $value[0] === '"' && $value[strlen($value) - 1] === '"') {
            $value = substr($value, 1, -1);
        }
        putenv($name . '=' . $value);
        $_ENV[$name] = $value;
    }
}

function environmentValue(string $name, ?string $default = null): ?string
{
    loadLocalEnvironment();
    $value = getenv($name);
    return $value === false ? $default : $value;
}

/** Devuelve los datos de una sola conexión, local o Supabase. */
function databaseConfiguration(): array
{
    $connection = strtolower(environmentValue('DB_CONNECTION', 'local'));
    if (!in_array($connection, ['local', 'supabase'], true)) {
        throw new RuntimeException('DB_CONNECTION debe ser local o supabase.');
    }

    $prefix = $connection === 'local' ? 'LOCAL_DB_' : 'SUPABASE_DB_';
    $host = environmentValue($prefix . 'HOST', $connection === 'local' ? '127.0.0.1' : null);
    $port = environmentValue($prefix . 'PORT', '5432');
    $name = environmentValue($prefix . 'NAME');
    $user = environmentValue($prefix . 'USER');
    $password = environmentValue($prefix . 'PASSWORD');
    $sslMode = environmentValue($prefix . 'SSLMODE', $connection === 'supabase' ? 'require' : null);

    if ($host === null || $host === '' || $name === null || $name === '' || $user === null || $user === '' || $password === null) {
        throw new RuntimeException('Faltan variables de conexión para ' . $connection . '.');
    }
    $validSslModes = [null, '', 'disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];
    if (!in_array($sslMode, $validSslModes, true)) {
        throw new RuntimeException('El modo SSL configurado no es válido.');
    }

    return compact('host', 'port', 'name', 'user', 'password', 'sslMode');
}
