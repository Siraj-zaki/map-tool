import { Request, Response, Router } from 'express';
import { query, queryOne, run } from '../db.js';
import { requireAuth } from './auth.js';

const router = Router();

// GET /api/routes - List all routes
router.get('/', async (req: Request, res: Response) => {
  try {
    const routes = await query(`
      SELECT route_id as id, name, description, start_point, end_point, 
             distance, duration, highest_point, lowest_point, 
             total_ascent, total_descent, created_at
      FROM routes 
      ORDER BY created_at DESC
    `);

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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const route = await queryOne(
      `
      SELECT route_id as id, name, description, start_point, end_point,
             route_geometry, elevation_data, distance, duration, highest_point, lowest_point,
             total_ascent, total_descent, created_at
      FROM routes WHERE route_id = ?
    `,
      [id]
    );

    if (!route) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    // Get waypoints
    const waypoints = await query(
      `
      SELECT location FROM waypoints 
      WHERE route_id = ? 
      ORDER BY position
    `,
      [id]
    );

    // Get POIs with images and amenities
    const pois = await query(
      `
      SELECT poi_id, name, description, location, type, best_time
      FROM pois WHERE route_id = ?
    `,
      [id]
    );

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

    res.json({
      success: true,
      route: {
        ...route,
        startPoint: JSON.parse(route.start_point),
        endPoint: JSON.parse(route.end_point),
        routeGeometry: route.route_geometry
          ? JSON.parse(route.route_geometry)
          : null,
        elevationData: route.elevation_data
          ? JSON.parse(route.elevation_data)
          : null,
        waypoints: waypoints.map((wp: any) => JSON.parse(wp.location)),
        pois: poisWithDetails,
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
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      startPoint,
      endPoint,
      routeGeometry,
      elevationData,
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
    const result = await run(
      `
      INSERT INTO routes (name, description, start_point, end_point, route_geometry, elevation_data, distance, duration,
                          highest_point, lowest_point, total_ascent, total_descent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        name,
        description || null,
        JSON.stringify(startPoint),
        JSON.stringify(endPoint),
        routeGeometry ? JSON.stringify(routeGeometry) : null,
        elevationData ? JSON.stringify(elevationData) : null,
        distance || null,
        duration || null,
        highestPoint || null,
        lowestPoint || null,
        totalAscent || null,
        totalDescent || null,
      ]
    );

    const routeId = result.insertId;

    // Insert waypoints
    if (waypoints && waypoints.length > 0) {
      for (let index = 0; index < waypoints.length; index++) {
        await run(
          'INSERT INTO waypoints (route_id, position, location) VALUES (?, ?, ?)',
          [routeId, index, JSON.stringify(waypoints[index])]
        );
      }
    }

    // Insert POIs
    if (pois && pois.length > 0) {
      for (const poi of pois) {
        const poiResult = await run(
          `
          INSERT INTO pois (route_id, name, description, location, type, best_time)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          [
            routeId,
            poi.name,
            poi.description || null,
            JSON.stringify(poi.lngLat),
            poi.type || null,
            poi.best_time || null,
          ]
        );
        const poiId = poiResult.insertId;

        if (poi.images) {
          for (const img of poi.images) {
            await run(
              'INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)',
              [poiId, img]
            );
          }
        }
        if (poi.amenities) {
          for (const amenity of poi.amenities) {
            await run(
              'INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)',
              [poiId, amenity]
            );
          }
        }
      }
    }

    res.json({ success: true, routeId });
  } catch (error) {
    console.error('Create route error:', error);
    res.status(500).json({ success: false, error: 'Failed to create route' });
  }
});

// PUT /api/routes/:id - Update route (protected)
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      startPoint,
      endPoint,
      routeGeometry,
      elevationData,
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
    const existing = await queryOne(
      'SELECT route_id FROM routes WHERE route_id = ?',
      [id]
    );
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    // Update route
    await run(
      `
      UPDATE routes SET 
        name = ?, description = ?, start_point = ?, end_point = ?, route_geometry = ?, elevation_data = ?,
        distance = ?, duration = ?, highest_point = ?, lowest_point = ?,
        total_ascent = ?, total_descent = ?
      WHERE route_id = ?
    `,
      [
        name,
        description,
        JSON.stringify(startPoint),
        JSON.stringify(endPoint),
        routeGeometry ? JSON.stringify(routeGeometry) : null,
        elevationData ? JSON.stringify(elevationData) : null,
        distance,
        duration,
        highestPoint,
        lowestPoint,
        totalAscent,
        totalDescent,
        id,
      ]
    );

    // Delete and re-insert waypoints
    await run('DELETE FROM waypoints WHERE route_id = ?', [id]);
    if (waypoints && waypoints.length > 0) {
      for (let index = 0; index < waypoints.length; index++) {
        await run(
          'INSERT INTO waypoints (route_id, position, location) VALUES (?, ?, ?)',
          [id, index, JSON.stringify(waypoints[index])]
        );
      }
    }

    // Delete and re-insert POIs
    await run(
      'DELETE FROM poi_images WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)',
      [id]
    );
    await run(
      'DELETE FROM poi_amenities WHERE poi_id IN (SELECT poi_id FROM pois WHERE route_id = ?)',
      [id]
    );
    await run('DELETE FROM pois WHERE route_id = ?', [id]);

    if (pois && pois.length > 0) {
      for (const poi of pois) {
        const poiResult = await run(
          `
          INSERT INTO pois (route_id, name, description, location, type, best_time)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            poi.name,
            poi.description || null,
            JSON.stringify(poi.lngLat),
            poi.type || null,
            poi.best_time || null,
          ]
        );
        const poiId = poiResult.insertId;

        if (poi.images) {
          for (const img of poi.images) {
            await run(
              'INSERT INTO poi_images (poi_id, image_path) VALUES (?, ?)',
              [poiId, img]
            );
          }
        }
        if (poi.amenities) {
          for (const amenity of poi.amenities) {
            await run(
              'INSERT INTO poi_amenities (poi_id, amenity) VALUES (?, ?)',
              [poiId, amenity]
            );
          }
        }
      }
    }

    res.json({ success: true, routeId: id });
  } catch (error) {
    console.error('Update route error:', error);
    res.status(500).json({ success: false, error: 'Failed to update route' });
  }
});

// DELETE /api/routes/:id - Delete route (protected)
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await run('DELETE FROM routes WHERE route_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Route not found' });
    }

    res.json({ success: true, message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete route' });
  }
});

// GET /api/routes/:id/split-points - Get split points for a route
router.get('/:id/split-points', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tourType } = req.query;

    let sql = `
      SELECT id, tour_type as tourType, stage_number as stageNumber, 
             location_name as locationName, lng, lat, distance_km as distanceKm
      FROM stage_split_points 
      WHERE route_id = ?
    `;
    const params: any[] = [id];

    if (tourType) {
      sql += ' AND tour_type = ?';
      params.push(tourType);
    }

    sql += ' ORDER BY tour_type, stage_number';

    const splitPoints = await query(sql, params);

    // Group by tour type
    const grouped: Record<string, any[]> = {
      silver: [],
      bronze: [],
    };

    splitPoints.forEach((sp: any) => {
      grouped[sp.tourType].push({
        stageNumber: sp.stageNumber,
        locationName: sp.locationName,
        lng: parseFloat(sp.lng),
        lat: parseFloat(sp.lat),
        distanceKm: parseFloat(sp.distanceKm),
      });
    });

    res.json({ success: true, splitPoints: grouped });
  } catch (error) {
    console.error('Get split points error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch split points' });
  }
});

// PUT /api/routes/:id/split-points - Save split points for a route (protected)
router.put(
  '/:id/split-points',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { tourType, splitPoints } = req.body;

      if (!tourType || !['silver', 'bronze'].includes(tourType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tour type. Must be silver or bronze.',
        });
      }

      // Delete existing split points for this tour type
      await run(
        'DELETE FROM stage_split_points WHERE route_id = ? AND tour_type = ?',
        [id, tourType]
      );

      // Insert new split points
      if (splitPoints && splitPoints.length > 0) {
        for (const sp of splitPoints) {
          await run(
            `INSERT INTO stage_split_points 
           (route_id, tour_type, stage_number, location_name, lng, lat, distance_km)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              tourType,
              sp.stageNumber,
              sp.locationName,
              sp.lng,
              sp.lat,
              sp.distanceKm,
            ]
          );
        }
      }

      res.json({ success: true, message: 'Split points saved' });
    } catch (error) {
      console.error('Save split points error:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to save split points' });
    }
  }
);

export default router;
