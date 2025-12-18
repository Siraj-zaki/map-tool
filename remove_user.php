<?php
session_start();
header('Content-Type: application/json');

// Check if user is logged in and is admin
if (!isset($_SESSION['user_id']) || !isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized access'
    ]);
    exit;
}

// Get and validate input
$input = json_decode(file_get_contents('php://input'), true);
if (!isset($input['userId']) || !is_numeric($input['userId'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid user ID'
    ]);
    exit;
}

$userId = intval($input['userId']);

try {
    require_once 'db_connect.php'; // Your database connection file

    // First check if user exists and is not an admin
    $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        throw new Exception('User not found');
    }

    if ($user['role'] === 'admin') {
        throw new Exception('Cannot remove admin users');
    }

    // Don't allow users to delete themselves
    if ($userId === $_SESSION['user_id']) {
        throw new Exception('Cannot remove your own account');
    }

    // Begin transaction
    $pdo->beginTransaction();

    // Delete user's related records first (if you have any)
    // For example:
    // $stmt = $pdo->prepare('DELETE FROM user_settings WHERE user_id = ?');
    // $stmt->execute([$userId]);

    // Delete the user
    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$userId]);

    // Commit transaction
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'User removed successfully'
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database error occurred'
    ]);
    
    // Log the actual error (but don't send to client)
    error_log('Error removing user: ' . $e->getMessage());
}