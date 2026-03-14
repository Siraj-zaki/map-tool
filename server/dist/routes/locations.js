"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const auth_js_1 = require("./auth.js");
const router = (0, express_1.Router)();
// GET /api/locations/:routeId - List all locations for a route
router.get('/:routeId', async (req, res) => {
    try {
        const { routeId } = req.params;
        const locations = await (0, db_js_1.query)('SELECT location_id as id, name, lng, lat, created_at FROM route_locations WHERE route_id = ? ORDER BY created_at ASC', [routeId]);
        res.json({ success: true, data: locations });
    }
    catch (error) {
        console.error('Get locations error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch locations' });
    }
});
// POST /api/locations - Add a new location (protected)
router.post('/', auth_js_1.requireAuth, async (req, res) => {
    try {
        const { route_id, name, lng, lat } = req.body;
        if (!route_id || !name || lng === undefined || lat === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Route ID, name, lng, and lat are required',
            });
        }
        // Check limit (max 10)
        const countResult = await (0, db_js_1.queryOne)('SELECT COUNT(*) as count FROM route_locations WHERE route_id = ?', [route_id]);
        if (countResult && countResult.count >= 10) {
            return res.status(400).json({
                success: false,
                error: 'A route can have a maximum of 10 locations',
            });
        }
        const result = await (0, db_js_1.run)('INSERT INTO route_locations (route_id, name, lng, lat) VALUES (?, ?, ?, ?)', [route_id, name, lng, lat]);
        res.json({ success: true, locationId: result.insertId });
    }
    catch (error) {
        console.error('Create location error:', error);
        res.status(500).json({ success: false, error: 'Failed to create location' });
    }
});
// DELETE /api/locations/:id - Delete a location (protected)
router.delete('/:id', auth_js_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, db_js_1.run)('DELETE FROM route_locations WHERE location_id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }
        res.json({ success: true, message: 'Location deleted successfully' });
    }
    catch (error) {
        console.error('Delete location error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete location' });
    }
});
exports.default = router;
//# sourceMappingURL=locations.js.map