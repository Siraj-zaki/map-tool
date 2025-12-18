"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = __importDefault(require("../db.js"));
const auth_js_1 = require("./auth.js");
const router = (0, express_1.Router)();
// GET /api/routes - List all routes
router.get('/', (req, res) => {
    try {
        const routes = db_js_1.default
            .prepare(`
      SELECT route_id as id, name, description, start_point, end_point, 
             distance, duration, highest_point, lowest_point, 
             total_ascent, total_descent, created_at
      FROM routes 
      ORDER BY created_at DESC
    `)
            .all();
        // Parse JSON coordinates and map to camelCase
        const parsedRoutes = routes.map((route) => ({
            id: route.id,
            name: route.name,
            description: route.description,
            startPoint: JSON.parse(route.start_point),
            endPoint: JSON.parse(route.end_point),
            distance: route.distance,
            duration: route.duration,
            highestPoint: route.highest_point,
            lowestPoint: route.lowest_point,
            totalAscent: route.total_ascent,
            totalDescent: route.total_descent,
            createdAt: route.created_at,
        }));
        res.json({ success: true, data: parsedRoutes });
    }
    catch (error) {
        console.error('Get routes error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch routes' });
    }
});
// GET /api/routes/:id - Get single route with waypoints and POIs
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const route = db_js_1.default
            .prepare(`
      SELECT route_id as id, name, description, start_point, end_point,
             route_geometry, distance, duration, highest_point, lowest_point,
             total_ascent, total_descent, created_at
      FROM routes WHERE route_id = ?
    `)
            .get(id);
        if (!route) {
            return res.status(404).json({ success: false, error: 'Route not found' });
        }
        // Get waypoints
        const waypoints = db_js_1.default
            .prepare(`
      SELECT location FROM waypoints 
      WHERE route_id = ? 
      ORDER BY position
    `)
            .all(id);
        // Get POIs with images and amenities
        const pois = db_js_1.default
            .prepare(`
      SELECT poi_id, name, description, location, type, best_time
      FROM pois WHERE route_id = ?
    `)
            .all(id);
        const poisWithDetails = pois.map((poi) => {
            const images = db_js_1.default
                .prepare('SELECT image_path FROM poi_images WHERE poi_id = ?')
                .all(poi.poi_id);
            const amenities = db_js_1.default
                .prepare('SELECT amenity FROM poi_amenities WHERE poi_id = ?')
                .all(poi.poi_id);
            return {
                ...poi,
                lngLat: JSON.parse(poi.location),
                images: images.map(img => img.image_path),
                amenities: amenities.map(a => a.amenity),
            };
        });
        res.json({
            success: true,
            route: {
                ...route,
                startPoint: JSON.parse(route.start_point),
                endPoint: JSON.parse(route.end_point),
                routeGeometry: route.route_geometry
                    ? JSON.parse(route.route_geometry)
                    : null,
                waypoints: waypoints.map((wp) => JSON.parse(wp.location)),
                pois: poisWithDetails,
                // Additional fields for compatibility
                highestPoint: route.highest_point,
                lowestPoint: route.lowest_point,
                totalAscent: route.total_ascent,
                totalDescent: route.total_descent,
            },
        });
    }
    catch (error) {
        console.error('Get route error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch route' });
    }
});
// POST /api/routes - Create new route (protected)
router.post('/', auth_js_1.requireAuth, (req, res) => {
    try {
        const { name, description, startPoint, endPoint, routeGeometry, waypoints, distance, duration, highestPoint, lowestPoint, totalAscent, totalDescent, pois, } = req.body;
        if (!name || !startPoint || !endPoint) {
            return res.status(400).json({
                success: false,
                error: 'Name, start point, and end point are required',
            });
        }
        // Insert route
        const result = db_js_1.default
            .prepare(`
      INSERT INTO routes (name, description, start_point, end_point, route_geometry, distance, duration,
                          highest_point, lowest_point, total_ascent, total_descent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
            .run(name, description || null, JSON.stringify(startPoint), JSON.stringify(endPoint), routeGeometry ? JSON.stringify(routeGeometry) : null, distance || null, duration || null, highestPoint || null, lowestPoint || null, totalAscent || null, totalDescent || null);
        const routeId = result.lastInsertRowid;
        // Insert waypoints
        if (waypoints && waypoints.length > 0) {
            const waypointStmt = db_js_1.default.prepare('INSERT INTO waypoints (route_id, position, location) VALUES (?, ?, ?)');
            waypoints.forEach((wp, index) => {
                waypointStmt.run(routeId, index, JSON.stringify(wp));
            });
        }
        // Insert POIs
        if (pois && pois.length > 0) {
            const poiStmt = db_js_1.default.prepare(`
        INSERT INTO pois (route_id, name, description, location, type, best_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            const imageStmt = db_js_1.default.prepare('INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)');
            const amenityStmt = db_js_1.default.prepare('INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)');
            pois.forEach((poi) => {
                const poiResult = poiStmt.run(routeId, poi.name, poi.description || null, JSON.stringify(poi.lngLat), poi.type || null, poi.best_time || null);
                const poiId = poiResult.lastInsertRowid;
                if (poi.images) {
                    poi.images.forEach((img) => imageStmt.run(poiId, img));
                }
                if (poi.amenities) {
                    poi.amenities.forEach((amenity) => amenityStmt.run(poiId, amenity));
                }
            });
        }
        res.json({ success: true, routeId });
    }
    catch (error) {
        console.error('Create route error:', error);
        res.status(500).json({ success: false, error: 'Failed to create route' });
    }
});
// PUT /api/routes/:id - Update route (protected)
router.put('/:id', auth_js_1.requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, startPoint, endPoint, routeGeometry, waypoints, distance, duration, highestPoint, lowestPoint, totalAscent, totalDescent, pois, } = req.body;
        // Check if route exists
        const existing = db_js_1.default
            .prepare('SELECT route_id FROM routes WHERE route_id = ?')
            .get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Route not found' });
        }
        // Update route
        db_js_1.default.prepare(`
      UPDATE routes SET 
        name = ?, description = ?, start_point = ?, end_point = ?, route_geometry = ?,
        distance = ?, duration = ?, highest_point = ?, lowest_point = ?,
        total_ascent = ?, total_descent = ?
      WHERE route_id = ?
    `).run(name, description, JSON.stringify(startPoint), JSON.stringify(endPoint), routeGeometry ? JSON.stringify(routeGeometry) : null, distance, duration, highestPoint, lowestPoint, totalAscent, totalDescent, id);
        // Delete and re-insert waypoints
        db_js_1.default.prepare('DELETE FROM waypoints WHERE route_id = ?').run(id);
        if (waypoints && waypoints.length > 0) {
            const waypointStmt = db_js_1.default.prepare('INSERT INTO waypoints (route_id, position, location) VALUES (?, ?, ?)');
            waypoints.forEach((wp, index) => {
                waypointStmt.run(id, index, JSON.stringify(wp));
            });
        }
        // Delete and re-insert POIs
        db_js_1.default.prepare('DELETE FROM poi_images WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)').run(id);
        db_js_1.default.prepare('DELETE FROM poi_amenities WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)').run(id);
        db_js_1.default.prepare('DELETE FROM pois WHERE route_id = ?').run(id);
        if (pois && pois.length > 0) {
            const poiStmt = db_js_1.default.prepare(`
        INSERT INTO pois (route_id, name, description, location, type, best_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            const imageStmt = db_js_1.default.prepare('INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)');
            const amenityStmt = db_js_1.default.prepare('INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)');
            pois.forEach((poi) => {
                const poiResult = poiStmt.run(id, poi.name, poi.description || null, JSON.stringify(poi.lngLat), poi.type || null, poi.best_time || null);
                const poiId = poiResult.lastInsertRowid;
                if (poi.images) {
                    poi.images.forEach((img) => imageStmt.run(poiId, img));
                }
                if (poi.amenities) {
                    poi.amenities.forEach((amenity) => amenityStmt.run(poiId, amenity));
                }
            });
        }
        res.json({ success: true, routeId: id });
    }
    catch (error) {
        console.error('Update route error:', error);
        res.status(500).json({ success: false, error: 'Failed to update route' });
    }
});
// DELETE /api/routes/:id - Delete route (protected)
router.delete('/:id', auth_js_1.requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        const result = db_js_1.default.prepare('DELETE FROM routes WHERE route_id = ?').run(id);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Route not found' });
        }
        res.json({ success: true, message: 'Route deleted successfully' });
    }
    catch (error) {
        console.error('Delete route error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete route' });
    }
});
exports.default = router;
//# sourceMappingURL=routes.js.map