import { Request, Response, Router } from 'express';
import db from '../db.js';
import { requireAuth } from './auth.js';

const router = Router();

// GET /api/routes - List all routes
router.get('/', (req: Request, res: Response) => {
  try {
    const routes = db
      .prepare(
        `
      SELECT route_id as id, name, description, start_point, end_point, 
             distance, duration, highest_point, lowest_point, 
             total_ascent, total_descent, created_at
      FROM routes 
      ORDER BY created_at DESC
    `
      )
      .all();

    // Parse JSON coordinates and map to camelCase
    const parsedRoutes = routes.map((route: any) => ({
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
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch routes' });
  }
});

// GET /api/routes/:id - Get single route with waypoints and POIs
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const route = db
      .prepare(
        `
      SELECT route_id as id, name, description, start_point, end_point,
             route_geometry, distance, duration, highest_point, lowest_point,
             total_ascent, total_descent, created_at
      FROM routes WHERE route_id = ?
    `
      )
      .get(id) as any;

    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    // Get waypoints
    const waypoints = db
      .prepare(
        `
      SELECT location FROM waypoints 
      WHERE route_id = ? 
      ORDER BY position
    `
      )
      .all(id) as any[];

    // Get POIs with images and amenities
    const pois = db
      .prepare(
        `
      SELECT poi_id, name, description, location, type, best_time
      FROM pois WHERE route_id = ?
    `
      )
      .all(id) as any[];

    const poisWithDetails = pois.map((poi: any) => {
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

    res.json({
      success: true,
      route: {
        ...route,
        startPoint: JSON.parse(route.start_point),
        endPoint: JSON.parse(route.end_point),
        routeGeometry: route.route_geometry
          ? JSON.parse(route.route_geometry)
          : null,
        waypoints: waypoints.map((wp: any) => JSON.parse(wp.location)),
        pois: poisWithDetails,
        // Additional fields for compatibility
        highestPoint: route.highest_point,
        lowestPoint: route.lowest_point,
        totalAscent: route.total_ascent,
        totalDescent: route.total_descent,
      },
    });
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch route' });
  }
});

// POST /api/routes - Create new route (protected)
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      startPoint,
      endPoint,
      routeGeometry,
      waypoints,
      distance,
      duration,
      highestPoint,
      lowestPoint,
      totalAscent,
      totalDescent,
      pois,
    } = req.body;

    if (!name || !startPoint || !endPoint) {
      return res.status(400).json({
        success: false,
        error: 'Name, start point, and end point are required',
      });
    }

    // Insert route
    const result = db
      .prepare(
        `
      INSERT INTO routes (name, description, start_point, end_point, route_geometry, distance, duration,
                          highest_point, lowest_point, total_ascent, total_descent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        name,
        description || null,
        JSON.stringify(startPoint),
        JSON.stringify(endPoint),
        routeGeometry ? JSON.stringify(routeGeometry) : null,
        distance || null,
        duration || null,
        highestPoint || null,
        lowestPoint || null,
        totalAscent || null,
        totalDescent || null
      );

    const routeId = result.lastInsertRowid;

    // Insert waypoints
    if (waypoints && waypoints.length > 0) {
      const waypointStmt = db.prepare(
        'INSERT INTO waypoints (route_id, position, location) VALUES (?, ?, ?)'
      );
      waypoints.forEach((wp: number[], index: number) => {
        waypointStmt.run(routeId, index, JSON.stringify(wp));
      });
    }

    // Insert POIs
    if (pois && pois.length > 0) {
      const poiStmt = db.prepare(`
        INSERT INTO pois (route_id, name, description, location, type, best_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const imageStmt = db.prepare(
        'INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)'
      );
      const amenityStmt = db.prepare(
        'INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)'
      );

      pois.forEach((poi: any) => {
        const poiResult = poiStmt.run(
          routeId,
          poi.name,
          poi.description || null,
          JSON.stringify(poi.lngLat),
          poi.type || null,
          poi.best_time || null
        );
        const poiId = poiResult.lastInsertRowid;

        if (poi.images) {
          poi.images.forEach((img: string) => imageStmt.run(poiId, img));
        }
        if (poi.amenities) {
          poi.amenities.forEach((amenity: string) =>
            amenityStmt.run(poiId, amenity)
          );
        }
      });
    }

    res.json({ success: true, routeId });
  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({ success: false, error: 'Failed to create route' });
  }
});

// PUT /api/routes/:id - Update route (protected)
router.put('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      startPoint,
      endPoint,
      routeGeometry,
      waypoints,
      distance,
      duration,
      highestPoint,
      lowestPoint,
      totalAscent,
      totalDescent,
      pois,
    } = req.body;

    // Check if route exists
    const existing = db
      .prepare('SELECT route_id FROM routes WHERE route_id = ?')
      .get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    // Update route
    db.prepare(
      `
      UPDATE routes SET 
        name = ?, description = ?, start_point = ?, end_point = ?, route_geometry = ?,
        distance = ?, duration = ?, highest_point = ?, lowest_point = ?,
        total_ascent = ?, total_descent = ?
      WHERE route_id = ?
    `
    ).run(
      name,
      description,
      JSON.stringify(startPoint),
      JSON.stringify(endPoint),
      routeGeometry ? JSON.stringify(routeGeometry) : null,
      distance,
      duration,
      highestPoint,
      lowestPoint,
      totalAscent,
      totalDescent,
      id
    );

    // Delete and re-insert waypoints
    db.prepare('DELETE FROM waypoints WHERE route_id = ?').run(id);
    if (waypoints && waypoints.length > 0) {
      const waypointStmt = db.prepare(
        'INSERT INTO waypoints (route_id, position, location) VALUES (?, ?, ?)'
      );
      waypoints.forEach((wp: number[], index: number) => {
        waypointStmt.run(id, index, JSON.stringify(wp));
      });
    }

    // Delete and re-insert POIs
    db.prepare(
      'DELETE FROM poi_images WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)'
    ).run(id);
    db.prepare(
      'DELETE FROM poi_amenities WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)'
    ).run(id);
    db.prepare('DELETE FROM pois WHERE route_id = ?').run(id);

    if (pois && pois.length > 0) {
      const poiStmt = db.prepare(`
        INSERT INTO pois (route_id, name, description, location, type, best_time)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const imageStmt = db.prepare(
        'INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)'
      );
      const amenityStmt = db.prepare(
        'INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)'
      );

      pois.forEach((poi: any) => {
        const poiResult = poiStmt.run(
          id,
          poi.name,
          poi.description || null,
          JSON.stringify(poi.lngLat),
          poi.type || null,
          poi.best_time || null
        );
        const poiId = poiResult.lastInsertRowid;

        if (poi.images) {
          poi.images.forEach((img: string) => imageStmt.run(poiId, img));
        }
        if (poi.amenities) {
          poi.amenities.forEach((amenity: string) =>
            amenityStmt.run(poiId, amenity)
          );
        }
      });
    }

    res.json({ success: true, routeId: id });
  } catch (error) {
    console.error('Update route error:', error);
    res.status(500).json({ success: false, error: 'Failed to update route' });
  }
});

// DELETE /api/routes/:id - Delete route (protected)
router.delete('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM routes WHERE route_id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete route' });
  }
});

export default router;
