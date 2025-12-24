import { Request, Response, Router } from 'express';
import { query, queryOne, run } from '../db.js';

const router = Router();

// Types
interface RouteSettings {
  id: number;
  main_color: string;
  line_width: number;
  shadow_color: string;
  shadow_opacity: number;
  updated_at: string;
}

interface StageColor {
  id: number;
  tour_type: 'bronze' | 'silver' | 'gold';
  stage_number: number;
  line_color: string;
  line_opacity: number;
  area_color: string | null;
  area_opacity: number;
}

// GET /api/settings/route - Get route settings
router.get('/route', async (_req: Request, res: Response) => {
  try {
    const settings = await queryOne<RouteSettings>(
      'SELECT * FROM route_settings WHERE id = 1'
    );

    if (!settings) {
      return res
        .status(404)
        .json({ success: false, message: 'Settings not found' });
    }

    res.json({
      success: true,
      settings: {
        mainColor: settings.main_color,
        lineWidth: Number(settings.line_width),
        shadowColor: settings.shadow_color,
        shadowOpacity: Number(settings.shadow_opacity),
      },
    });
  } catch (error) {
    console.error('Error fetching route settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/settings/route - Update route settings
router.put('/route', async (req: Request, res: Response) => {
  try {
    const { mainColor, lineWidth, shadowColor, shadowOpacity } = req.body;

    await run(
      `UPDATE route_settings 
       SET main_color = ?, line_width = ?, shadow_color = ?, shadow_opacity = ?
       WHERE id = 1`,
      [mainColor, lineWidth, shadowColor, shadowOpacity]
    );

    res.json({ success: true, message: 'Route settings updated' });
  } catch (error) {
    console.error('Error updating route settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/settings/stages - Get all stage colors
router.get('/stages', async (_req: Request, res: Response) => {
  try {
    const stages = await query<StageColor[]>(
      'SELECT * FROM stage_colors ORDER BY tour_type, stage_number'
    );

    // Group by tour type
    const grouped: Record<string, any[]> = {
      gold: [],
      silver: [],
      bronze: [],
    };

    stages.forEach((stage: StageColor) => {
      grouped[stage.tour_type].push({
        stageNumber: stage.stage_number,
        lineColor: stage.line_color,
        lineOpacity: Number(stage.line_opacity),
        areaColor: stage.area_color,
        areaOpacity: Number(stage.area_opacity),
      });
    });

    res.json({ success: true, stages: grouped });
  } catch (error) {
    console.error('Error fetching stage colors:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/settings/stages/:tourType/:stageNumber - Update a stage color
router.put(
  '/stages/:tourType/:stageNumber',
  async (req: Request, res: Response) => {
    try {
      const { tourType, stageNumber } = req.params;
      const { lineColor, lineOpacity, areaColor, areaOpacity } = req.body;

      // Validate tour type
      if (!['gold', 'silver', 'bronze'].includes(tourType)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid tour type' });
      }

      const result = await run(
        `UPDATE stage_colors 
       SET line_color = ?, line_opacity = ?, area_color = ?, area_opacity = ?
       WHERE tour_type = ? AND stage_number = ?`,
        [lineColor, lineOpacity, areaColor, areaOpacity, tourType, stageNumber]
      );

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Stage not found' });
      }

      res.json({ success: true, message: 'Stage color updated' });
    } catch (error) {
      console.error('Error updating stage color:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// GET /api/settings/all - Get all settings (route + stages) for frontend
router.get('/all', async (_req: Request, res: Response) => {
  try {
    const routeSettings = await queryOne<RouteSettings>(
      'SELECT * FROM route_settings WHERE id = 1'
    );
    const stages = await query<StageColor[]>(
      'SELECT * FROM stage_colors ORDER BY tour_type, stage_number'
    );

    // Group stages by tour type
    const groupedStages: Record<string, any[]> = {
      gold: [],
      silver: [],
      bronze: [],
    };

    stages.forEach((stage: StageColor) => {
      groupedStages[stage.tour_type].push({
        stageNumber: stage.stage_number,
        lineColor: stage.line_color,
        lineOpacity: Number(stage.line_opacity),
        areaColor: stage.area_color,
        areaOpacity: Number(stage.area_opacity),
      });
    });

    res.json({
      success: true,
      routeSettings: routeSettings
        ? {
            mainColor: routeSettings.main_color,
            lineWidth: Number(routeSettings.line_width),
            shadowColor: routeSettings.shadow_color,
            shadowOpacity: Number(routeSettings.shadow_opacity),
          }
        : null,
      stageColors: groupedStages,
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
