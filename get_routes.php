<?php
header('Content-Type: application/json');

// Start session to check for authentication
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

    $pdo = new PDO(
        "mysql:host={$db_config['host']};dbname={$db_config['dbname']};charset=utf8mb4",
        $db_config['user'],
        $db_config['pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // First, let's check the actual table structure
    $tableInfo = $pdo->query("SHOW COLUMNS FROM routes");
    $columns = $tableInfo->fetchAll(PDO::FETCH_COLUMN);
    
    // Only use columns that actually exist in the table
    $validColumns = ['route_id', 'name'];
    $selectColumns = [];
    
    foreach ($validColumns as $column) {
        if (in_array($column, $columns)) {
            $selectColumns[] = $column;
        }
    }
    
    // If no valid columns were found, try getting all columns
    if (empty($selectColumns)) {
        $selectColumns = $columns;
    }
    
    // Build the query dynamically based on available columns
    $query = "SELECT " . implode(", ", $selectColumns) . " FROM routes";
    
    // Add ORDER BY if created_at exists
    if (in_array('created_at', $columns)) {
        $query .= " ORDER BY created_at DESC";
    }
    
    $stmt = $pdo->query($query);
    $routes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Transform the data to match what the frontend expects
    foreach ($routes as &$route) {
        // Map route_id to id for frontend compatibility
        if (isset($route['route_id'])) {
            $route['id'] = $route['route_id'];
            unset($route['route_id']);
        }
        
        // Ensure description exists (even if empty) for frontend compatibility
        if (!isset($route['description'])) {
            $route['description'] = '';
        }
        
        // Format date if it exists
        if (isset($route['created_at'])) {
            $timestamp = strtotime($route['created_at']);
            $route['created_at_formatted'] = date('M d, Y', $timestamp);
        }
    }
    
    echo json_encode(['success' => true, 'data' => $routes]);

} catch (PDOException $e) {
    // Database error
    error_log("Database error in get_routes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Database error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    // General error
    error_log("General error in get_routes.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false, 
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}
exit;
?>