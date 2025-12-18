<?php
header('Content-Type: application/json');

$config = [
    'host' => 'database-5017167920.webspace-host.com',
    'username' => 'dbu5384423',
    'password' => 'Maksik2011!',
    'database' => 'dbs13794540'
];

try {
    if (!isset($_GET['route_id'])) {
        throw new Exception('Route ID is required');
    }

    $routeId = intval($_GET['route_id']);

    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['database']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    // Get route data
    $routeStmt = $pdo->prepare("
        SELECT 
            name,
            ST_X(start_point) as start_lng,
            ST_Y(start_point) as start_lat,
            ST_X(end_point) as end_lng,
            ST_Y(end_point) as end_lat,
            distance,
            duration,
            highest_point,
            lowest_point,
            total_ascent,
            total_descent
        FROM routes 
        WHERE route_id = ?
    ");
    $routeStmt->execute([$routeId]);
    $route = $routeStmt->fetch(PDO::FETCH_ASSOC);

    if (!$route) {
        throw new Exception('Route not found');
    }

    // Get waypoints
    $waypointStmt = $pdo->prepare("
        SELECT 
            ST_X(location) as lng,
            ST_Y(location) as lat,
            position
        FROM waypoints 
        WHERE route_id = ?
        ORDER BY position
    ");
    $waypointStmt->execute([$routeId]);
    $waypoints = $waypointStmt->fetchAll(PDO::FETCH_ASSOC);

    // Get POIs with all fields including type and best_time
    $poiStmt = $pdo->prepare("
        SELECT 
            p.poi_id,
            p.name,
            p.description,
            p.type,
            p.best_time,
            ST_X(p.location) as lng,
            ST_Y(p.location) as lat,
            p.type,         /* Explicitly include type */
            p.best_time     /* Explicitly include best_time */
        FROM pois p
        WHERE p.route_id = ?
    ");
    $poiStmt->execute([$routeId]);
    $pois = $poiStmt->fetchAll(PDO::FETCH_ASSOC);

    // Debug: Log the raw POI data
    error_log('Raw POI data from database: ' . json_encode($pois));

    // Get amenities for each POI
    $amenityStmt = $pdo->prepare("
        SELECT amenity 
        FROM poi_amenities 
        WHERE poi_id = ?
    ");

    // Get images for each POI
    $imageStmt = $pdo->prepare("
        SELECT image_path 
        FROM poi_images 
        WHERE poi_id = ?
    ");

    foreach ($pois as &$poi) {
        // Get amenities
        $amenityStmt->execute([$poi['poi_id']]);
        $poi['amenities'] = $amenityStmt->fetchAll(PDO::FETCH_COLUMN);

        // Get and process images
        $imageStmt->execute([$poi['poi_id']]);
        $imagePaths = $imageStmt->fetchAll(PDO::FETCH_COLUMN);
        $poi['images'] = [];

        foreach ($imagePaths as $imagePath) {
            if (file_exists($imagePath)) {
                try {
                    $imageData = file_get_contents($imagePath);
                    $imageType = pathinfo($imagePath, PATHINFO_EXTENSION);
                    $base64Image = 'data:image/' . $imageType . ';base64,' . base64_encode($imageData);
                    $poi['images'][] = $base64Image;
                } catch (Exception $e) {
                    error_log("Error processing image {$imagePath}: " . $e->getMessage());
                    continue;
                }
            }
        }

        // Ensure type and best_time are properly set
        $poi['type'] = $poi['type'] ?? '';
        $poi['best_time'] = $poi['best_time'] ?? '';

        // Debug: Log each processed POI
        error_log('Processed POI data: ' . json_encode([
            'id' => $poi['poi_id'],
            'name' => $poi['name'],
            'type' => $poi['type'],
            'best_time' => $poi['best_time']
        ]));

        unset($poi['poi_id']); // Remove database ID from response
    }

    // Debug: Log the final POIs array
    error_log('Final POIs data: ' . json_encode($pois));

    $response = [
        'success' => true,
        'route' => [
            'name' => $route['name'],
            'startPoint' => [$route['start_lng'], $route['start_lat']],
            'endPoint' => [$route['end_lng'], $route['end_lat']],
            'distance' => $route['distance'],
            'duration' => $route['duration'],
            'highestPoint' => $route['highest_point'],
            'lowestPoint' => $route['lowest_point'],
            'totalAscent' => $route['total_ascent'],
            'totalDescent' => $route['total_descent'],
            'waypoints' => array_map(function($wp) {
                return [$wp['lng'], $wp['lat']];
            }, $waypoints),
            'pois' => $pois
        ]
    ];

    // Debug: Log the final response
    error_log('Final response: ' . json_encode($response));

    echo json_encode($response);

} catch (Exception $e) {
    error_log('Error in get-route.php: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}