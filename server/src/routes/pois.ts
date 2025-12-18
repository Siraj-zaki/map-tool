import { Request, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import db from '../db.js';
import { requireAuth } from './auth.js';

const router = Router();

// Configure multer for image uploads
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'poi');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `poi-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// GET /api/pois - Get all POIs (optionally filtered by route)
router.get('/', (req: Request, res: Response) => {
  try {
    const { route_id } = req.query;

    let query = `
      SELECT p.poi_id, p.route_id, p.name, p.description, p.location, 
             p.type, p.best_time, p.created_at
      FROM pois p
    `;
    const params: any[] = [];

    if (route_id) {
      query += ' WHERE p.route_id = ?';
      params.push(route_id);
    }

    const pois = db.prepare(query).all(...params) as any[];

    const poisWithDetails = pois.map(poi => {
      const images = db
        .prepare('SELECT image_path FROM poi_images WHERE poi_id = ?')
        .all(poi.poi_id) as any[];
      const amenities = db
        .prepare('SELECT amenity FROM poi_amenities WHERE poi_id = ?')
        .all(poi.poi_id) as any[];

      return {
        ...poi,
        lngLat: JSON.parse(poi.location),
        images: images.map(img => img.image_path),
        amenities: amenities.map(a => a.amenity),
      };
    });

    res.json({ success: true, data: poisWithDetails });
  } catch (error) {
    console.error('Get POIs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch POIs' });
  }
});

// POST /api/pois - Create POI with images (protected)
router.post(
  '/',
  requireAuth,
  upload.array('images', 10),
  (req: Request, res: Response) => {
    try {
      const {
        route_id,
        name,
        description,
        lngLat,
        type,
        best_time,
        amenities,
      } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!route_id || !name || !lngLat) {
        return res.status(400).json({
          success: false,
          error: 'Route ID, name, and location are required',
        });
      }

      // Parse lngLat if it's a string
      const location = typeof lngLat === 'string' ? JSON.parse(lngLat) : lngLat;

      // Insert POI
      const result = db
        .prepare(
          `
      INSERT INTO pois (route_id, name, description, location, type, best_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `
        )
        .run(
          route_id,
          name,
          description || null,
          JSON.stringify(location),
          type || null,
          best_time || null
        );

      const poiId = result.lastInsertRowid;

      // Insert images
      if (files && files.length > 0) {
        const imageStmt = db.prepare(
          'INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)'
        );
        files.forEach(file => {
          const imagePath = `/uploads/poi/${file.filename}`;
          imageStmt.run(poiId, imagePath);
        });
      }

      // Insert amenities
      if (amenities) {
        const amenityList =
          typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        const amenityStmt = db.prepare(
          'INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)'
        );
        amenityList.forEach((amenity: string) => {
          amenityStmt.run(poiId, amenity);
        });
      }

      res.json({ success: true, poiId });
    } catch (error) {
      console.error('Create POI error:', error);
      res.status(500).json({ success: false, error: 'Failed to create POI' });
    }
  }
);

// DELETE /api/pois/:id - Delete POI (protected)
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get images to delete files
    const images = db
      .prepare('SELECT image_path FROM poi_images WHERE poi_id = ?')
      .all(id) as any[];

    // Delete from database (cascades to images and amenities)
    const result = db.prepare('DELETE FROM pois WHERE poi_id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'POI not found' });
    }

    // Delete image files
    images.forEach(img => {
      const filePath = path.join(__dirname, '..', '..', img.image_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    res.json({ success: true, message: 'POI deleted successfully' });
  } catch (error) {
    console.error('Delete POI error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete POI' });
  }
});

export default router;
