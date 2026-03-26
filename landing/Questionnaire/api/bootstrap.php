<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

date_default_timezone_set((string) ($config['app']['timezone'] ?? 'UTC'));

final class HttpError extends RuntimeException
{
    public int $status;

    public function __construct(int $status, string $message)
    {
        parent::__construct($message);
        $this->status = $status;
    }
}

function abort(int $status, string $message): never
{
    throw new HttpError($status, $message);
}

function start_app_session(): void
{
    global $config;

    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $session = $config['session'] ?? [];
    session_name((string) ($session['name'] ?? 'vango_admin'));
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => (string) ($session['domain'] ?? ''),
        'secure' => (bool) ($session['secure_cookie'] ?? true),
        'httponly' => true,
        'samesite' => (string) ($session['samesite'] ?? 'Lax'),
    ]);
    session_start();
}

function send_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        abort(400, 'Invalid JSON body');
    }

    return $decoded;
}

function require_method(string $expected): void
{
    $actual = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($actual !== strtoupper($expected)) {
        abort(405, 'Method Not Allowed');
    }
}

function db(): PDO
{
    static $pdo = null;
    global $config;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = $config['db'] ?? [];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) ($db['host'] ?? '127.0.0.1'),
        (int) ($db['port'] ?? 3306),
        (string) ($db['name'] ?? '')
    );

    try {
        $pdo = new PDO($dsn, (string) ($db['user'] ?? ''), (string) ($db['pass'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        error_log('DB connection failed: ' . $e->getMessage());
        abort(500, 'Database connection failed');
    }

    return $pdo;
}

function string_or_empty(mixed $value): string
{
    if (!is_string($value)) {
        return '';
    }
    return trim($value);
}

function text_length(string $value): int
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value);
    }
    return strlen($value);
}

function get_client_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
        $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
        $_SERVER['REMOTE_ADDR'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || $candidate === '') {
            continue;
        }

        // X-Forwarded-For may contain a list: client, proxy1, proxy2
        $parts = array_map('trim', explode(',', $candidate));
        foreach ($parts as $part) {
            if (filter_var($part, FILTER_VALIDATE_IP)) {
                return $part;
            }
        }
    }

    return '0.0.0.0';
}

function detect_device_type(string $userAgent): string
{
    $ua = strtolower($userAgent);
    if (str_contains($ua, 'android')) {
        return 'Android';
    }

    if (str_contains($ua, 'iphone') || str_contains($ua, 'ipad') || str_contains($ua, 'ipod') || str_contains($ua, 'ios')) {
        return 'iOS';
    }

    return 'Desktop';
}

function geoip_lookup(string $ip): array
{
    global $config;
    $geo = $config['geoip'] ?? [];

    if (!(bool) ($geo['enabled'] ?? true)) {
        return ['city' => 'Unknown', 'country_code' => null];
    }

    $template = (string) ($geo['url_template'] ?? '');
    if ($template === '' || !str_contains($template, '{ip}')) {
        return ['city' => 'Unknown', 'country_code' => null];
    }

    $url = str_replace('{ip}', rawurlencode($ip), $template);
    $apiKey = string_or_empty($geo['api_key'] ?? '');
    $apiKeyParam = string_or_empty($geo['api_key_query_param'] ?? '');

    if ($apiKey !== '' && $apiKeyParam !== '') {
        $separator = str_contains($url, '?') ? '&' : '?';
        $url .= $separator . rawurlencode($apiKeyParam) . '=' . rawurlencode($apiKey);
    }

    if (!function_exists('curl_init')) {
        return ['city' => 'Unknown', 'country_code' => null];
    }

    $timeout = (int) ($geo['timeout_seconds'] ?? 3);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => $timeout,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if (!is_string($raw) || $raw === '' || $httpCode < 200 || $httpCode >= 300) {
        if ($curlError !== '') {
            error_log('GeoIP request failed: ' . $curlError);
        }
        return ['city' => 'Unknown', 'country_code' => null];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return ['city' => 'Unknown', 'country_code' => null];
    }

    // ipwho.is response
    if (array_key_exists('success', $data) && $data['success'] === false) {
        return ['city' => 'Unknown', 'country_code' => null];
    }

    // Support several common providers.
    $city = string_or_empty($data['city'] ?? '');
    $countryCode = string_or_empty($data['country_code'] ?? ($data['countryCode'] ?? ''));

    // ip-api.com format
    if (($data['status'] ?? null) === 'fail') {
        return ['city' => 'Unknown', 'country_code' => null];
    }

    return [
        'city' => $city !== '' ? $city : 'Unknown',
        'country_code' => $countryCode !== '' ? strtoupper($countryCode) : null,
    ];
}

function require_admin_auth(): void
{
    if (!($_SESSION['admin_authenticated'] ?? false)) {
        abort(401, 'Unauthorized');
    }
}

function clear_session_cookie(): void
{
    if (!ini_get('session.use_cookies')) {
        return;
    }

    global $config;
    $params = session_get_cookie_params();
    $session = $config['session'] ?? [];
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'] ?: '/',
        (string) ($session['domain'] ?? ''),
        (bool) ($session['secure_cookie'] ?? true),
        true
    );
}

function normalize_answers(mixed $rawAnswers): array
{
    if (!is_array($rawAnswers)) {
        return [];
    }

    $normalized = [];
    foreach ($rawAnswers as $entry) {
        if (!is_array($entry)) {
            continue;
        }

        $question = string_or_empty($entry['question'] ?? '');
        $label = string_or_empty($entry['label'] ?? ($entry['answer'] ?? ''));
        $value = string_or_empty($entry['value'] ?? $label);
        $nodeId = string_or_empty($entry['nodeId'] ?? '');

        if ($question === '' && $label === '') {
            continue;
        }

        $normalized[] = [
            'nodeId' => $nodeId,
            'question' => $question,
            'label' => $label,
            'value' => $value,
            'answer' => $label !== '' ? $label : $value,
        ];
    }

    return $normalized;
}

function answer_value_by_node(array $answers, string $nodeId): string
{
    foreach ($answers as $answer) {
        if (($answer['nodeId'] ?? '') === $nodeId) {
            return string_or_empty($answer['value'] ?? ($answer['label'] ?? ''));
        }
    }
    return '';
}

function answer_label_by_node(array $answers, string $nodeId): string
{
    foreach ($answers as $answer) {
        if (($answer['nodeId'] ?? '') === $nodeId) {
            return string_or_empty($answer['label'] ?? ($answer['value'] ?? ''));
        }
    }
    return '';
}

function derive_role(array $answers): string
{
    $value = strtolower(answer_value_by_node($answers, 'q_role'));
    if ($value === '') {
        foreach ($answers as $answer) {
            $question = string_or_empty($answer['question'] ?? '');
            if ($question !== '' && str_contains($question, 'Ким ви себе')) {
                $value = strtolower(string_or_empty($answer['value'] ?? ''));
                break;
            }
        }
    }

    $map = [
        'driver' => 'Водій',
        'customer' => 'Замовник',
        'both' => 'Обидва',
        'curious' => 'Цікаво',
    ];

    if (isset($map[$value])) {
        return $map[$value];
    }

    $roleLabel = answer_label_by_node($answers, 'q_role');
    return $roleLabel !== '' ? $roleLabel : 'Unknown';
}

function normalize_answers_for_admin(mixed $answersJson): array
{
    $decoded = json_decode((string) $answersJson, true);
    if (!is_array($decoded)) {
        return [];
    }

    $result = [];
    foreach ($decoded as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $question = string_or_empty($entry['question'] ?? '');
        $answer = string_or_empty($entry['answer'] ?? ($entry['label'] ?? $entry['value'] ?? ''));
        if ($question === '' && $answer === '') {
            continue;
        }
        $result[] = [
            'question' => $question,
            'answer' => $answer,
        ];
    }

    return $result;
}

function distribution_with_colors(array $rows, array $palette): array
{
    $result = [];
    $i = 0;
    foreach ($rows as $row) {
        $name = string_or_empty($row['name'] ?? '');
        $value = (int) ($row['value'] ?? 0);
        if ($name === '' || $value <= 0) {
            continue;
        }
        $result[] = [
            'name' => $name,
            'value' => $value,
            'fill' => $palette[$i % count($palette)],
        ];
        $i++;
    }

    return $result;
}

function run_api(callable $handler): never
{
    start_app_session();

    try {
        $handler();
    } catch (HttpError $e) {
        send_json(['ok' => false, 'error' => $e->getMessage()], $e->status);
    } catch (Throwable $e) {
        error_log('Unhandled API error: ' . $e->getMessage());
        send_json(['ok' => false, 'error' => 'Internal Server Error'], 500);
    }
}
