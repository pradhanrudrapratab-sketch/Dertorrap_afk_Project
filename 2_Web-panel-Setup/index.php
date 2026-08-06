<?php
// ─── Config ───────────────────────────────────────────────
define('BOT_URL',  'https://your-bot.onrender.com'); // Change this to your Render URL
define('API_KEY',  'your_api_key_here');              // Change this to your API key
define('ALLOWED_ORIGIN', 'https://yourdomain.infinityfreeapp.com'); // Change to your InfinityFree domain

// ─── CORS / Origin Check ──────────────────────────────────
header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';

// Allow only requests from same domain
$allowedDomain = parse_url(ALLOWED_ORIGIN, PHP_URL_HOST);
$refererHost   = parse_url($referer, PHP_URL_HOST);
$originHost    = parse_url($origin, PHP_URL_HOST);

$fromSameDomain = ($refererHost === $allowedDomain || $originHost === $allowedDomain);

// Also allow localhost for testing
$isLocalhost = in_array($refererHost, ['localhost', '127.0.0.1']) ||
               in_array($originHost,  ['localhost', '127.0.0.1']);

if (!$fromSameDomain && !$isLocalhost) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden: Direct access not allowed']);
    exit;
}

// ─── Get Action ───────────────────────────────────────────
$action = trim($_GET['action'] ?? '');
$value  = trim($_GET['value']  ?? '');

if (empty($action)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No action specified']);
    exit;
}

// ─── Whitelist Valid Actions ──────────────────────────────
$simpleActions = ['start', 'stop', 'jump', 'move', 'sneak', 'stopaction', 'status', 'health'];
$valueActions  = ['ip', 'port', 'rename', 'version'];

if (!in_array($action, array_merge($simpleActions, $valueActions))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Unknown action: $action"]);
    exit;
}

// Value actions require a value
if (in_array($action, $valueActions) && empty($value)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => "Action '$action' requires a value"]);
    exit;
}

// ─── Build Bot URL ────────────────────────────────────────
$botEndpoint = BOT_URL . '/' . urlencode($action) . '?key=' . urlencode(API_KEY);
if (!empty($value)) {
    $botEndpoint .= '&value=' . urlencode($value);
}

// ─── Call Bot API ─────────────────────────────────────────
$ctx = stream_context_create([
    'http' => [
        'method'  => 'GET',
        'timeout' => 10,
        'ignore_errors' => true,
        'header'  => "User-Agent: DertorrapPanel/1.0\r\n",
    ],
    'ssl' => [
        'verify_peer'      => true,
        'verify_peer_name' => true,
    ]
]);

$raw = @file_get_contents($botEndpoint, false, $ctx);

// Check HTTP response code
$httpCode = 200;
if (isset($http_response_header)) {
    foreach ($http_response_header as $h) {
        if (preg_match('/HTTP\/\d\.\d\s+(\d+)/', $h, $m)) {
            $httpCode = (int)$m[1];
        }
    }
}

if ($raw === false) {
    http_response_code(502);
    echo json_encode([
        'success' => false,
        'error'   => 'Could not reach bot server. Is it running on Render?'
    ]);
    exit;
}

$data = json_decode($raw, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(502);
    echo json_encode(['success' => false, 'error' => 'Invalid response from bot server']);
    exit;
}

http_response_code($httpCode);
echo json_encode($data);
