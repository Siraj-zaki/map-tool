import { Request, Response, Router } from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { query, run } from '../db.js';
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const { route_id } = req.query;

    let sql = `
      SELECT p.poi_id, p.route_id, p.name, p.description, p.location, 
             p.type, p.best_time, p.created_at
      FROM pois p
    `;
    const params: any[] = [];

    if (route_id) {
      sql += ' WHERE p.route_id = ?';
      params.push(route_id);
    }

    const pois = await query(sql, params);

    const poisWithDetails = await Promise.all(
      pois.map(async (poi: any) => {
        const images = await query(
          'SELECT image_path FROM poi_images WHERE poi_id = ?',
          [poi.poi_id]
        );
        const amenities = await query(
          'SELECT amenity FROM poi_amenities WHERE poi_id = ?',
          [poi.poi_id]
        );

        return {
          ...poi,
          lngLat: JSON.parse(poi.location),
          images: images.map((img: any) => img.image_path),
          amenities: amenities.map((a: any) => a.amenity),
        };
      })
    );

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
  async (req: Request, res: Response) => {
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
      const result = await run(
        `
        INSERT INTO pois (route_id, name, description, location, type, best_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [
          route_id,
          name,
          description || null,
          JSON.stringify(location),
          type || null,
          best_time || null,
        ]
      );

      const poiId = result.insertId;

      // Insert images
      if (files && files.length > 0) {
        for (const file of files) {
          const imagePath = `/uploads/poi/${file.filename}`;
          await run(
            'INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)',
            [poiId, imagePath]
          );
        }
      }

      // Insert amenities
      if (amenities) {
        const amenityList =
          typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        for (const amenity of amenityList) {
          await run(
            'INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)',
            [poiId, amenity]
          );
        }
      }

      res.json({ success: true, poiId });
    } catch (error) {
      console.error('Create POI error:', error);
      res.status(500).json({ success: false, error: 'Failed to create POI' });
    }
  }
);

// DELETE /api/pois/:id - Delete POI (protected)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get images to delete files
    const images = await query(
      'SELECT image_path FROM poi_images WHERE poi_id = ?',
      [id]
    );

    // Delete from database (cascades to images and amenities)
    const result = await run('DELETE FROM pois WHERE poi_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'POI not found' });
    }

    // Delete image files
    images.forEach((img: any) => {
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
