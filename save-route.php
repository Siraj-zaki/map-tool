<?php
header('Content-Type: application/json');

// Database configuration
$config = [
    'host' => 'database-5017167920.webspace-host.com',
    'username' => 'dbu5384423',
    'password' => 'Maksik2011!',
    'database' => 'dbs13794540'
];

// Define image directory path
$imageDir = 'images/poi';

// Function to safely save base64 image
function saveBase64Image($imageData, $poiName) {
    global $imageDir;
    
    // Extract image data and type
    if (preg_match('/^data:image\/(\w+);base64,/', $imageData, $type)) {
        $data = substr($imageData, strpos($imageData, ',') + 1);
        $type = strtolower($type[1]); // jpg, png, etc.
        
        if ($decodedData = base64_decode($data)) {
            // Generate safe filename
            $safeName = preg_replace('/[^a-z0-9]+/', '-', strtolower($poiName));
            $fileName = $safeName . '-' . uniqid() . '.' . $type;
            $fullPath = $imageDir . '/' . $fileName;
            
            if (file_put_contents($fullPath, $decodedData)) {
                return 'images/poi/' . $fileName;
            }
        }
    }
    
    return null;
}

try {
    // Ensure image directory exists and is writable
    if (!file_exists($imageDir) && !mkdir($imageDir, 0755, true)) {
        throw new Exception('Failed to create image directory');
    }
    
    if (!is_writable($imageDir)) {
        throw new Exception('Image directory is not writable');
    }

    // Connect to database
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Get and validate POST data
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        throw new Exception('Invalid input data');
    }

    // Start transaction
    $pdo->beginTransaction();

    // Check if we're updating an existing route or creating a new one
    $isUpdatingRoute = isset($data['id']) && $data['id'] !== null;
    $routeId = $isUpdatingRoute ? $data['id'] : null;

    if ($isUpdatingRoute) {
        // Update existing route
        $routeStmt = $pdo->prepare("
            UPDATE routes 
            SET name = ?, start_point = ST_GeomFromText(?), end_point = ST_GeomFromText(?), 
                distance = ?, duration = ?, highest_point = ?, 
                lowest_point = ?, total_ascent = ?, total_descent = ?
            WHERE route_id = ?
        ");

        $routeStmt->execute([
            $data['name'],
            "POINT({$data['startPoint'][0]} {$data['startPoint'][1]})",
            "POINT({$data['endPoint'][0]} {$data['endPoint'][1]})",
            $data['distance'],
            $data['duration'],
            $data['highestPoint'],
            $data['lowestPoint'],
            $data['totalAscent'],
            $data['totalDescent'],
            $routeId
        ]);

        // Delete existing waypoints and POIs to replace them
        $pdo->prepare("DELETE FROM waypoints WHERE route_id = ?")->execute([$routeId]);
        $pdo->prepare("DELETE FROM poi_images WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)")->execute([$routeId]);
        $pdo->prepare("DELETE FROM poi_amenities WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)")->execute([$routeId]);
        $pdo->prepare("DELETE FROM pois WHERE route_id = ?")->execute([$routeId]);
    } else {
        // Insert new route
        $routeStmt = $pdo->prepare("
            INSERT INTO routes (name, start_point, end_point, distance, duration, 
                              highest_point, lowest_point, total_ascent, total_descent)
            VALUES (?, ST_GeomFromText(?), ST_GeomFromText(?), ?, ?, ?, ?, ?, ?)
        ");

        $routeStmt->execute([
            $data['name'],
            "POINT({$data['startPoint'][0]} {$data['startPoint'][1]})",
            "POINT({$data['endPoint'][0]} {$data['endPoint'][1]})",
            $data['distance'],
            $data['duration'],
            $data['highestPoint'],
            $data['lowestPoint'],
            $data['totalAscent'],
            $data['totalDescent']
        ]);

        $routeId = $pdo->lastInsertId();
    }

    // Insert waypoints
    if (!empty($data['waypoints'])) {
        $waypointStmt = $pdo->prepare("
            INSERT INTO waypoints (route_id, position, location)
            VALUES (?, ?, ST_GeomFromText(?))
        ");

        foreach ($data['waypoints'] as $index => $waypoint) {
            $waypointStmt->execute([
                $routeId,
                $index,
                "POINT({$waypoint[0]} {$waypoint[1]})"
            ]);
        }
    }

    // Handle POIs with multiple images
    if (!empty($data['pois'])) {
        $poiStmt = $pdo->prepare("
            INSERT INTO pois (route_id, name, description, location, type, best_time)
            VALUES (?, ?, ?, ST_GeomFromText(?), ?, ?)
        ");

        $poiImageStmt = $pdo->prepare("
            INSERT INTO poi_images (poi_id, image_path)
            VALUES (?, ?)
        ");

        $amenityStmt = $pdo->prepare("
            INSERT INTO poi_amenities (poi_id, amenity)
            VALUES (?, ?)
        ");

        foreach ($data['pois'] as $poi) {
            // Insert POI basic data with type and best time
            $poiStmt->execute([
                $routeId,
                $poi['name'],
                $poi['description'],
                "POINT({$poi['lngLat'][0]} {$poi['lngLat'][1]})",
                $poi['type'] ?? null,  // POI type
                $poi['best_time'] ?? null  // Best visit time
            ]);

            $poiId = $pdo->lastInsertId();

            // Handle multiple images
            if (!empty($poi['images']) && is_array($poi['images'])) {
                foreach ($poi['images'] as $imageData) {
                    // Save image and get path
                    $imagePath = saveBase64Image($imageData, $poi['name']);
                    
                    if ($imagePath) {
                        // Insert image path into database
                        $poiImageStmt->execute([$poiId, $imagePath]);
                    }
                }
            }

            // Insert amenities
            if (!empty($poi['amenities'])) {
                foreach ($poi['amenities'] as $amenity) {
                    $amenityStmt->execute([$poiId, $amenity]);
                }
            }
        }
    }

    // Commit transaction
    $pdo->commit();

    echo json_encode([
        'success' => true,
        'routeId' => $routeId
    ]);

} catch (Exception $e) {
    if (isset($pdo)) {
        $pdo->rollBack();
    }
    
    error_log('Route save error: ' . $e->getMessage());
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}