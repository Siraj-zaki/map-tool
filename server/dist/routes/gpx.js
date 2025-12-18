"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_js_1 = __importDefault(require("../db.js"));
const auth_js_1 = require("./auth.js");
const router = (0, express_1.Router)();
// GPX file storage directory
const gpxDir = path_1.default.join(__dirname, '..', '..', 'uploads', 'gpx');
if (!fs_1.default.existsSync(gpxDir)) {
    fs_1.default.mkdirSync(gpxDir, { recursive: true });
}
// GET /api/gpx/:routeId - Get available GPX files for a route
router.get('/:routeId', (req, res) => {
    try {
        const { routeId } = req.params;
        const { tour_type, start_point } = req.query;
        let query = 'SELECT * FROM gpx_files WHERE route_id = ?';
        const params = [routeId];
        if (tour_type) {
            query += ' AND tour_type = ?';
            params.push(tour_type);
        }
        if (start_point) {
            query += ' AND start_point_name = ?';
            params.push(start_point);
        }
        query += ' ORDER BY stage_number';
        const gpxFiles = db_js_1.default.prepare(query).all(...params);
        // Group by tour type
        const grouped = gpxFiles.reduce((acc, file) => {
            if (!acc[file.tour_type]) {
                acc[file.tour_type] = [];
            }
            acc[file.tour_type].push(file);
            return acc;
        }, {});
        res.json({
            success: true,
            data: grouped,
            // Info about stages per tour type
            stageInfo: {
                gold: { stages: 1, description: '1 Tag (komplette Route)' },
                silver: { stages: 2, description: '2 Tage (2 Etappen)' },
                bronze: { stages: 3, description: '3 Tage (3 Etappen)' },
            },
        });
    }
    catch (error) {
        console.error('Get GPX files error:', error);
        res
            .status(500)
            .json({ success: false, error: 'Failed to fetch GPX files' });
    }
});
// GET /api/gpx/download/:fileId - Download a specific GPX file
router.get('/download/:fileId', (req, res) => {
    try {
        const { fileId } = req.params;
        const gpxFile = db_js_1.default
            .prepare('SELECT * FROM gpx_files WHERE id = ?')
            .get(fileId);
        if (!gpxFile) {
            return res
                .status(404)
                .json({ success: false, error: 'GPX file not found' });
        }
        const filePath = path_1.default.join(gpxDir, gpxFile.file_path);
        if (!fs_1.default.existsSync(filePath)) {
            return res
                .status(404)
                .json({ success: false, error: 'GPX file not found on disk' });
        }
        // Get route name for filename
        const route = db_js_1.default
            .prepare('SELECT name FROM routes WHERE route_id = ?')
            .get(gpxFile.route_id);
        const routeName = route?.name || 'route';
        const downloadName = `${routeName}-${gpxFile.tour_type}-stage${gpxFile.stage_number}.gpx`;
        res.setHeader('Content-Type', 'application/gpx+xml');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.sendFile(filePath);
    }
    catch (error) {
        console.error('Download GPX error:', error);
        res
            .status(500)
            .json({ success: false, error: 'Failed to download GPX file' });
    }
});
// POST /api/gpx - Upload GPX file (protected)
router.post('/', auth_js_1.requireAuth, (req, res) => {
    try {
        const { route_id, tour_type, stage_number, start_point_name, gpx_content } = req.body;
        if (!route_id || !tour_type || !gpx_content) {
            return res.status(400).json({
                success: false,
                error: 'Route ID, tour type, and GPX content are required',
            });
        }
        // Validate tour type
        if (!['gold', 'silver', 'bronze'].includes(tour_type)) {
            return res.status(400).json({
                success: false,
                error: 'Tour type must be gold, silver, or bronze',
            });
        }
        // Validate stage number based on tour type
        const maxStages = {
            gold: 1,
            silver: 2,
            bronze: 3,
        };
        const stageNum = stage_number || 1;
        if (stageNum > maxStages[tour_type]) {
            return res.status(400).json({
                success: false,
                error: `${tour_type} tour can only have ${maxStages[tour_type]} stage(s)`,
            });
        }
        // Generate filename
        const filename = `route-${route_id}-${tour_type}-stage${stageNum}-${Date.now()}.gpx`;
        const filePath = path_1.default.join(gpxDir, filename);
        // Save GPX content to file
        fs_1.default.writeFileSync(filePath, gpx_content);
        // Insert to database
        const result = db_js_1.default
            .prepare(`
      INSERT INTO gpx_files (route_id, tour_type, stage_number, start_point_name, file_path)
      VALUES (?, ?, ?, ?, ?)
    `)
            .run(route_id, tour_type, stageNum, start_point_name || null, filename);
        res.json({ success: true, id: result.lastInsertRowid });
    }
    catch (error) {
        console.error('Upload GPX error:', error);
        res
            .status(500)
            .json({ success: false, error: 'Failed to upload GPX file' });
    }
});
// DELETE /api/gpx/:fileId - Delete GPX file (protected)
router.delete('/:fileId', auth_js_1.requireAuth, (req, res) => {
    try {
        const { fileId } = req.params;
        const gpxFile = db_js_1.default
            .prepare('SELECT file_path FROM gpx_files WHERE id = ?')
            .get(fileId);
        if (!gpxFile) {
            return res
                .status(404)
                .json({ success: false, error: 'GPX file not found' });
        }
        // Delete from database
        db_js_1.default.prepare('DELETE FROM gpx_files WHERE id = ?').run(fileId);
        // Delete file from disk
        const filePath = path_1.default.join(gpxDir, gpxFile.file_path);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        res.json({ success: true, message: 'GPX file deleted successfully' });
    }
    catch (error) {
        console.error('Delete GPX error:', error);
        res
            .status(500)
            .json({ success: false, error: 'Failed to delete GPX file' });
    }
});
// GET /api/gpx/start-points/:routeId - Get available start points for a route
router.get('/start-points/:routeId', (req, res) => {
    try {
        const { routeId } = req.params;
        const startPoints = db_js_1.default
            .prepare(`
      SELECT DISTINCT start_point_name 
      FROM gpx_files 
      WHERE route_id = ? AND start_point_name IS NOT NULL
    `)
            .all(routeId);
        res.json({
            success: true,
            data: startPoints.map(sp => sp.start_point_name),
        });
    }
    catch (error) {
        console.error('Get start points error:', error);
        res
            .status(500)
            .json({ success: false, error: 'Failed to fetch start points' });
    }
});
exports.default = router;
//# sourceMappingURL=gpx.js.map