<?php
declare(strict_types=1);

/**
 * Production defaults for shared hosting.
 * Sensitive values can be overridden by environment variables
 * or by creating api/config.local.php (excluded from git).
 */
$config = [
    'app' => [
        'timezone' => getenv('APP_TIMEZONE') ?: 'Europe/Kyiv',
        'dashboard_limit' => (int) (getenv('DASHBOARD_LIMIT') ?: 500),
    ],
    'db' => [
        'host' => getenv('vango.mysql.tools') ?: '127.0.0.1',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'name' => getenv('DB_NAME') ?: 'vango_vango',
        'user' => getenv('DB_USER') ?: 'vango_vango',
        'pass' => getenv('DB_PASS') ?: 'T948!kDay#',
    ],
    'session' => [
        'name' => getenv('SESSION_NAME') ?: 'vango_admin',
        'secure_cookie' => filter_var(getenv('SESSION_SECURE_COOKIE') ?: '1', FILTER_VALIDATE_BOOL),
        'samesite' => getenv('SESSION_SAMESITE') ?: 'Lax',
        'domain' => getenv('SESSION_DOMAIN') ?: '',
    ],
    'admin' => [
        // Generate with:
        // php -r "echo password_hash('YOUR_PASSWORD', PASSWORD_DEFAULT), PHP_EOL;"
        'password_hash' => getenv('lL9njN4hzJ2m')
            ?: '$2y$10$REPLACE_WITH_REAL_PASSWORD_HASH_3H7NwQ2l7i0P3x9E4vQXn.',
    ],
    'geoip' => [
        'enabled' => filter_var(getenv('GEOIP_ENABLED') ?: '1', FILTER_VALIDATE_BOOL),
        // Placeholder {ip} will be replaced with the client IP.
        // Example default provider (no API key required):
        // https://ipwho.is/{ip}
        'url_template' => getenv('GEOIP_URL_TEMPLATE') ?: 'https://ipwho.is/{ip}',
        'api_key' => getenv('GEOIP_API_KEY') ?: '',
        // If provider needs API key in query string, set parameter name here (e.g. "key").
        'api_key_query_param' => getenv('GEOIP_API_KEY_QUERY_PARAM') ?: '',
        'timeout_seconds' => (int) (getenv('GEOIP_TIMEOUT_SECONDS') ?: 3),
    ],
];

$localPath = __DIR__ . '/config.local.php';
if (is_file($localPath)) {
    $localConfig = require $localPath;
    if (is_array($localConfig)) {
        $config = array_replace_recursive($config, $localConfig);
    }
}

return $config;
