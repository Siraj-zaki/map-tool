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
  brand_logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  updated_at: string;
}

/**
 * Serialize DB row → API response. Keeps camelCase on the wire.
 * Branding fields are always emitted (null when unset) so the client can
 * distinguish "not customized" from "not-yet-loaded".
 */
function serializeRouteSettings(s: RouteSettings) {
  return {
    mainColor: s.main_color,
    lineWidth: Number(s.line_width),
    shadowColor: s.shadow_color,
    shadowOpacity: Number(s.shadow_opacity),
    brandLogoUrl: s.brand_logo_url,
    primaryColor: s.primary_color,
    accentColor: s.accent_color,
  };
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

    res.json({ success: true, settings: serializeRouteSettings(settings) });
  } catch (error) {
    console.error('Error fetching route settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/settings/route - Update route settings. Partial: only fields
// present in the body are touched, so callers can update route styling and
// branding independently without stomping the other.
router.put('/route', async (req: Request, res: Response) => {
  try {
    const {
      mainColor,
      lineWidth,
      shadowColor,
      shadowOpacity,
      brandLogoUrl,
      primaryColor,
      accentColor,
    } = req.body as {
      mainColor?: string;
      lineWidth?: number;
      shadowColor?: string;
      shadowOpacity?: number;
      brandLogoUrl?: string | null;
      primaryColor?: string | null;
      accentColor?: string | null;
    };

    const sets: string[] = [];
    const params: any[] = [];

    if (mainColor !== undefined) { sets.push('main_color = ?'); params.push(mainColor); }
    if (lineWidth !== undefined) { sets.push('line_width = ?'); params.push(lineWidth); }
    if (shadowColor !== undefined) { sets.push('shadow_color = ?'); params.push(shadowColor); }
    if (shadowOpacity !== undefined) { sets.push('shadow_opacity = ?'); params.push(shadowOpacity); }
    if (brandLogoUrl !== undefined) { sets.push('brand_logo_url = ?'); params.push(brandLogoUrl || null); }
    if (primaryColor !== undefined) { sets.push('primary_color = ?'); params.push(primaryColor || null); }
    if (accentColor !== undefined) { sets.push('accent_color = ?'); params.push(accentColor || null); }

    if (sets.length > 0) {
      await run(
        `UPDATE route_settings SET ${sets.join(', ')} WHERE id = 1`,
        params
      );
    }

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

// PUT /api/settings/stages/:tourType/:stageNumber - Update or create a stage color
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

      // Validate stage number (1-10)
      const stageNum = parseInt(stageNumber, 10);
      if (isNaN(stageNum) || stageNum < 1 || stageNum > 10) {
        return res
          .status(400)
          .json({ success: false, message: 'Stage number must be between 1 and 10' });
      }

      // Use INSERT ... ON DUPLICATE KEY UPDATE to create or update
      await run(
        `INSERT INTO stage_colors (tour_type, stage_number, line_color, line_opacity, area_color, area_opacity)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           line_color = VALUES(line_color),
           line_opacity = VALUES(line_opacity),
           area_color = VALUES(area_color),
           area_opacity = VALUES(area_opacity)`,
        [tourType, stageNum, lineColor, lineOpacity, areaColor || null, areaOpacity || 0.3]
      );

      res.json({ success: true, message: 'Stage color saved' });
    } catch (error) {
      console.error('Error saving stage color:', error);
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
      routeSettings: routeSettings ? serializeRouteSettings(routeSettings) : null,
      stageColors: groupedStages,
    });
  } catch (error) {
    console.error('Error fetching all settings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
