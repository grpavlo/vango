<?php
declare(strict_types=1);

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'vango_db',
        'user' => 'vango_user',
        'pass' => 'strong-db-password',
    ],
    'session' => [
        'secure_cookie' => true,
        'domain' => 'vango.com.ua',
    ],
    'admin' => [
        // Generate with:
        // php -r "echo password_hash('YOUR_ADMIN_PASSWORD', PASSWORD_DEFAULT), PHP_EOL;"
        'password_hash' => '$2y$10$replace_me_with_real_hash',
    ],
    'geoip' => [
        'enabled' => true,
        'url_template' => 'https://ipwho.is/{ip}',
        'api_key' => '',
        'api_key_query_param' => '',
        'timeout_seconds' => 3,
    ],
];
