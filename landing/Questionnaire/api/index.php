<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

run_api(function (): void {
    global $config;

    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/api'), PHP_URL_PATH) ?: '/api';
    $route = preg_replace('#^/api#', '', $path, 1);
    $route = '/' . ltrim((string) $route, '/');
    $route = rtrim($route, '/') ?: '/';
    if ($route === '/index.php') {
        $route = '/';
    }

    if ($route === '/survey/submit') {
        require_method('POST');
        $body = json_body();

        $answers = normalize_answers($body['answers'] ?? []);
        if ($answers === []) {
            abort(422, 'Answers are required');
        }

        $name = string_or_empty($body['name'] ?? answer_label_by_node($answers, 'q_name_input'));
        $contact = string_or_empty($body['contact'] ?? answer_label_by_node($answers, 'q_contact_input'));

        if ($name === '' || $contact === '') {
            abort(422, 'Name and contact are required');
        }

        if (text_length($name) > 120 || text_length($contact) > 190) {
            abort(422, 'Name or contact is too long');
        }

        $role = derive_role($answers);
        $ip = get_client_ip();
        $userAgent = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $device = detect_device_type($userAgent);
        $geo = geoip_lookup($ip);

        $pdo = db();
        $stmt = $pdo->prepare(
            'INSERT INTO survey_responses (name, contact, role, device_type, ip, city, country_code, user_agent, answers_json)
             VALUES (:name, :contact, :role, :device_type, :ip, :city, :country_code, :user_agent, :answers_json)'
        );
        $stmt->execute([
            ':name' => $name,
            ':contact' => $contact,
            ':role' => $role,
            ':device_type' => $device,
            ':ip' => $ip,
            ':city' => (string) ($geo['city'] ?? 'Unknown'),
            ':country_code' => $geo['country_code'] ?? null,
            ':user_agent' => $userAgent,
            ':answers_json' => json_encode($answers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        send_json([
            'ok' => true,
            'responseId' => (int) $pdo->lastInsertId(),
        ]);
    }

    if ($route === '/admin/login') {
        require_method('POST');
        $body = json_body();
        $password = string_or_empty($body['password'] ?? '');

        if ($password === '') {
            abort(422, 'Password is required');
        }

        $passwordHash = (string) ($config['admin']['password_hash'] ?? '');
        if ($passwordHash === '' || str_contains($passwordHash, 'REPLACE_WITH_REAL_PASSWORD_HASH')) {
            abort(500, 'Admin password hash is not configured');
        }

        if (!password_verify($password, $passwordHash)) {
            abort(401, 'Invalid password');
        }

        session_regenerate_id(true);
        $_SESSION['admin_authenticated'] = true;
        $_SESSION['admin_login_at'] = gmdate('c');

        send_json(['ok' => true]);
    }

    if ($route === '/admin/session') {
        require_method('GET');
        send_json([
            'ok' => true,
            'authenticated' => (bool) ($_SESSION['admin_authenticated'] ?? false),
        ]);
    }

    if ($route === '/admin/logout') {
        require_method('POST');
        $_SESSION = [];
        clear_session_cookie();
        session_destroy();

        send_json(['ok' => true]);
    }

    if ($route === '/admin/dashboard') {
        require_method('GET');
        require_admin_auth();

        $pdo = db();
        $limit = max(1, (int) ($config['app']['dashboard_limit'] ?? 500));

        $responses = [];
        $rows = $pdo->query(
            'SELECT id, name, contact, role, device_type, city, created_at, answers_json
             FROM survey_responses
             ORDER BY id DESC
             LIMIT ' . $limit
        )->fetchAll();

        foreach ($rows as $row) {
            $responses[] = [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'contact' => (string) $row['contact'],
                'role' => (string) $row['role'],
                'device' => (string) $row['device_type'],
                'city' => (string) $row['city'],
                'createdAt' => (string) $row['created_at'],
                'answers' => normalize_answers_for_admin($row['answers_json']),
            ];
        }

        $palette = [
            'hsl(48, 100%, 50%)',
            'hsl(200, 80%, 50%)',
            'hsl(140, 70%, 45%)',
            'hsl(280, 60%, 55%)',
            'hsl(20, 90%, 55%)',
            'hsl(340, 70%, 50%)',
            'hsl(60, 80%, 45%)',
            'hsl(170, 60%, 45%)',
        ];

        $roleRows = $pdo->query(
            'SELECT role AS name, COUNT(*) AS value
             FROM survey_responses
             GROUP BY role
             ORDER BY value DESC, name ASC'
        )->fetchAll();

        $deviceRows = $pdo->query(
            'SELECT device_type AS name, COUNT(*) AS value
             FROM survey_responses
             GROUP BY device_type
             ORDER BY value DESC, name ASC'
        )->fetchAll();

        $cityRows = $pdo->query(
            'SELECT city AS name, COUNT(*) AS value
             FROM survey_responses
             GROUP BY city
             ORDER BY value DESC, name ASC
             LIMIT 20'
        )->fetchAll();

        $cityDistribution = [];
        foreach ($cityRows as $cityRow) {
            $name = string_or_empty($cityRow['name'] ?? '');
            $value = (int) ($cityRow['value'] ?? 0);
            if ($name === '' || $value <= 0) {
                continue;
            }
            $cityDistribution[] = [
                'name' => $name,
                'value' => $value,
            ];
        }

        send_json([
            'ok' => true,
            'responses' => $responses,
            'roleDistribution' => distribution_with_colors($roleRows, $palette),
            'deviceDistribution' => distribution_with_colors($deviceRows, $palette),
            'cityDistribution' => $cityDistribution,
        ]);
    }

    if ($route === '/health') {
        require_method('GET');
        send_json(['ok' => true, 'status' => 'up']);
    }

    abort(404, 'Not Found');
});
