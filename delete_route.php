<?php
// delete_route.php
header('Content-Type: application/json');
session_start();

// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized access']);
    exit;
}

try {
    $db_config = [
        'host' => 'database-5017167920.webspace-host.com',
        'dbname' => 'dbs13794540',
        'user' => 'dbu5384423',
        'pass' => 'Maksik2011!'
    ];

    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id'])) {
        throw new Exception('Route ID is required');
    }

    $pdo = new PDO(
        "mysql:host={$db_config['host']};dbname={$db_config['dbname']};charset=utf8mb4",
        $db_config['user'],
        $db_config['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Use route_id instead of id for the delete operation
    $stmt = $pdo->prepare("DELETE FROM routes WHERE route_id = ?");
    $stmt->execute([$input['id']]);
    
    // Check if any rows were affected
    if ($stmt->rowCount() === 0) {
        // No rows were deleted, might be because id doesn't match route_id
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'message' => 'Route not found or already deleted'
        ]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Route successfully deleted']);

} catch (PDOException $e) {
    error_log("Database error in delete_route.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("General error in delete_route.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
exit;
?>