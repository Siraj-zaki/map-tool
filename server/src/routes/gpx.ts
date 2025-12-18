import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { requireAuth } from './auth.js';

const router = Router();

// GPX file storage directory
const gpxDir = path.join(__dirname, '..', '..', 'uploads', 'gpx');
if (!fs.existsSync(gpxDir)) {
  fs.mkdirSync(gpxDir, { recursive: true });
}

// Tour types: Gold (1 day), Silver (2 days), Bronze (3 days)
type TourType = 'gold' | 'silver' | 'bronze';

interface GpxFile {
  id: number;
  route_id: number;
  tour_type: TourType;
  stage_number: number;
  start_point_name: string;
  file_path: string;
}

// GET /api/gpx/:routeId - Get available GPX files for a route
router.get('/:routeId', (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const { tour_type, start_point } = req.query;

    let query = 'SELECT * FROM gpx_files WHERE route_id = ?';
    const params: any[] = [routeId];

    if (tour_type) {
      query += ' AND tour_type = ?';
      params.push(tour_type);
    }

    if (start_point) {
      query += ' AND start_point_name = ?';
      params.push(start_point);
    }

    query += ' ORDER BY stage_number';

    const gpxFiles = db.prepare(query).all(...params) as GpxFile[];

    // Group by tour type
    const grouped = gpxFiles.reduce((acc, file) => {
      if (!acc[file.tour_type]) {
        acc[file.tour_type] = [];
      }
      acc[file.tour_type].push(file);
      return acc;
    }, {} as Record<TourType, GpxFile[]>);

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
  } catch (error) {
    console.error('Get GPX files error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch GPX files' });
  }
});

// GET /api/gpx/download/:fileId - Download a specific GPX file
router.get('/download/:fileId', (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const gpxFile = db
      .prepare('SELECT * FROM gpx_files WHERE id = ?')
      .get(fileId) as GpxFile | undefined;

    if (!gpxFile) {
      return res
        .status(404)
        .json({ success: false, error: 'GPX file not found' });
    }

    const filePath = path.join(gpxDir, gpxFile.file_path);

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ success: false, error: 'GPX file not found on disk' });
    }

    // Get route name for filename
    const route = db
      .prepare('SELECT name FROM routes WHERE route_id = ?')
      .get(gpxFile.route_id) as any;
    const routeName = route?.name || 'route';

    const downloadName = `${routeName}-${gpxFile.tour_type}-stage${gpxFile.stage_number}.gpx`;

    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadName}"`
    );
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download GPX error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to download GPX file' });
  }
});

// POST /api/gpx - Upload GPX file (protected)
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const { route_id, tour_type, stage_number, start_point_name, gpx_content } =
      req.body;

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
    const maxStages: Record<TourType, number> = {
      gold: 1,
      silver: 2,
      bronze: 3,
    };
    const stageNum = stage_number || 1;

    if (stageNum > maxStages[tour_type as TourType]) {
      return res.status(400).json({
        success: false,
        error: `${tour_type} tour can only have ${
          maxStages[tour_type as TourType]
        } stage(s)`,
      });
    }

    // Generate filename
    const filename = `route-${route_id}-${tour_type}-stage${stageNum}-${Date.now()}.gpx`;
    const filePath = path.join(gpxDir, filename);

    // Save GPX content to file
    fs.writeFileSync(filePath, gpx_content);

    // Insert to database
    const result = db
      .prepare(
        `
      INSERT INTO gpx_files (route_id, tour_type, stage_number, start_point_name, file_path)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(route_id, tour_type, stageNum, start_point_name || null, filename);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    console.error('Upload GPX error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to upload GPX file' });
  }
});

// DELETE /api/gpx/:fileId - Delete GPX file (protected)
router.delete('/:fileId', requireAuth, (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;

    const gpxFile = db
      .prepare('SELECT file_path FROM gpx_files WHERE id = ?')
      .get(fileId) as any;

    if (!gpxFile) {
      return res
        .status(404)
        .json({ success: false, error: 'GPX file not found' });
    }

    // Delete from database
    db.prepare('DELETE FROM gpx_files WHERE id = ?').run(fileId);

    // Delete file from disk
    const filePath = path.join(gpxDir, gpxFile.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, message: 'GPX file deleted successfully' });
  } catch (error) {
    console.error('Delete GPX error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to delete GPX file' });
  }
});

// GET /api/gpx/start-points/:routeId - Get available start points for a route
router.get('/start-points/:routeId', (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;

    const startPoints = db
      .prepare(
        `
      SELECT DISTINCT start_point_name 
      FROM gpx_files 
      WHERE route_id = ? AND start_point_name IS NOT NULL
    `
      )
      .all(routeId) as any[];

    res.json({
      success: true,
      data: startPoints.map(sp => sp.start_point_name),
    });
  } catch (error) {
    console.error('Get start points error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch start points' });
  }
});

export default router;
