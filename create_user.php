<?php
session_start();

// Check if user is logged in and is an admin
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Admin access required.']);
    exit;
}

header('Content-Type: application/json');

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

    // Enable logging for debugging
    error_log("Starting user creation process by admin ID: " . $_SESSION['user_id']);

    // Get input data
    $input = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';
    $role = $input['role'] ?? 'user';

    // Validate input
    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username and password are required']);
        exit;
    }

    // Debug input values
    error_log("Username received: " . $username);
    error_log("Role received: " . $role);

    // Check if username already exists
    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE username = :username");
    $checkStmt->execute(['username' => $username]);
    if ($checkStmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode(['success' => false, 'message' => 'Username already exists']);
        exit;
    }

    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    error_log("Password hashed successfully");

    // Check if the column is 'password' or 'passwor'
    $columnInfo = $pdo->query("SHOW COLUMNS FROM users LIKE 'password'");
    if ($columnInfo->rowCount() > 0) {
        $passwordColumn = 'password';
    } else {
        $passwordColumn = 'passwor';
        error_log("Using 'passwor' column instead of 'password'");
    }

    // Construct the query with the correct column name
    $query = "INSERT INTO users (username, $passwordColumn, role) VALUES (:username, :password, :role)";
    error_log("Executing query: " . $query);
    
    // Insert new user
    $insertStmt = $pdo->prepare($query);
    $insertResult = $insertStmt->execute([
        'username' => $username,
        'password' => $hashedPassword,
        'role' => $role
    ]);
    
    error_log("Insert executed, result: " . ($insertResult ? "success" : "failure"));
    
    if ($insertResult) {
        $newUserId = $pdo->lastInsertId();
        error_log("New user created with ID: " . $newUserId);
        echo json_encode([
            'success' => true, 
            'message' => 'User created successfully',
            'user_id' => $newUserId
        ]);
    } else {
        throw new Exception("Failed to insert user record");
    }
    
} catch (PDOException $e) {
    error_log("Database error in create_user.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("General error in create_user.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
exit;
?>