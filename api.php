<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!isset($input['query'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Query parameter required']);
    exit;
}

$query = $input['query'];

// Query ChromaDB
$chromaQuery = [
    'query_texts' => [$query],
    'n_results' => 5
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, 'http://127.0.0.1:8000/api/v1/collections/proschool360/query');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($chromaQuery));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$chromaResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['error' => 'ChromaDB query failed']);
    exit;
}

$chromaData = json_decode($chromaResponse, true);
$documents = $chromaData['documents'][0] ?? [];

// Build context
$context = implode("\n\n", array_slice($documents, 0, 5));

// Build prompt
$prompt = "Use only the following ProSchool360 code:\n\n{$context}\n\nQuestion: {$query}";

// Call Gemini API
$geminiPayload = [
    'contents' => [
        [
            'parts' => [
                ['text' => $prompt]
            ]
        ]
    ]
];

$apiKey = 'YOUR_API_KEY'; // Replace with actual API key
$geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={$apiKey}";

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $geminiUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($geminiPayload));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$geminiResponse = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['error' => 'Gemini API call failed']);
    exit;
}

$geminiData = json_decode($geminiResponse, true);
$reply = $geminiData['candidates'][0]['content']['parts'][0]['text'] ?? 'No response generated';

echo json_encode(['reply' => $reply]);
?>