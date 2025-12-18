"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const db_js_1 = __importDefault(require("../db.js"));
const auth_js_1 = require("./auth.js");
const router = (0, express_1.Router)();
// Configure multer for image uploads
const uploadsDir = path_1.default.join(__dirname, '..', '..', 'uploads', 'poi');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, `poi-${uniqueSuffix}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    },
});
// GET /api/pois - Get all POIs (optionally filtered by route)
router.get('/', (req, res) => {
    try {
        const { route_id } = req.query;
        let query = `
      SELECT p.poi_id, p.route_id, p.name, p.description, p.location, 
             p.type, p.best_time, p.created_at
      FROM pois p
    `;
        const params = [];
        if (route_id) {
            query += ' WHERE p.route_id = ?';
            params.push(route_id);
        }
        const pois = db_js_1.default.prepare(query).all(...params);
        const poisWithDetails = pois.map(poi => {
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
        res.json({ success: true, data: poisWithDetails });
    }
    catch (error) {
        console.error('Get POIs error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch POIs' });
    }
});
// POST /api/pois - Create POI with images (protected)
router.post('/', auth_js_1.requireAuth, upload.array('images', 10), (req, res) => {
    try {
        const { route_id, name, description, lngLat, type, best_time, amenities, } = req.body;
        const files = req.files;
        if (!route_id || !name || !lngLat) {
            return res.status(400).json({
                success: false,
                error: 'Route ID, name, and location are required',
            });
        }
        // Parse lngLat if it's a string
        const location = typeof lngLat === 'string' ? JSON.parse(lngLat) : lngLat;
        // Insert POI
        const result = db_js_1.default
            .prepare(`
      INSERT INTO pois (route_id, name, description, location, type, best_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
            .run(route_id, name, description || null, JSON.stringify(location), type || null, best_time || null);
        const poiId = result.lastInsertRowid;
        // Insert images
        if (files && files.length > 0) {
            const imageStmt = db_js_1.default.prepare('INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)');
            files.forEach(file => {
                const imagePath = `/uploads/poi/${file.filename}`;
                imageStmt.run(poiId, imagePath);
            });
        }
        // Insert amenities
        if (amenities) {
            const amenityList = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
            const amenityStmt = db_js_1.default.prepare('INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)');
            amenityList.forEach((amenity) => {
                amenityStmt.run(poiId, amenity);
            });
        }
        res.json({ success: true, poiId });
    }
    catch (error) {
        console.error('Create POI error:', error);
        res.status(500).json({ success: false, error: 'Failed to create POI' });
    }
});
// DELETE /api/pois/:id - Delete POI (protected)
router.delete('/:id', auth_js_1.requireAuth, (req, res) => {
    try {
        const { id } = req.params;
        // Get images to delete files
        const images = db_js_1.default
            .prepare('SELECT image_path FROM poi_images WHERE poi_id = ?')
            .all(id);
        // Delete from database (cascades to images and amenities)
        const result = db_js_1.default.prepare('DELETE FROM pois WHERE poi_id = ?').run(id);
        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'POI not found' });
        }
        // Delete image files
        images.forEach(img => {
            const filePath = path_1.default.join(__dirname, '..', '..', img.image_path);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        });
        res.json({ success: true, message: 'POI deleted successfully' });
    }
    catch (error) {
        console.error('Delete POI error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete POI' });
    }
});
exports.default = router;
//# sourceMappingURL=pois.js.map