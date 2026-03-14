"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const router = (0, express_1.Router)();
// GET /api/settings/route - Get route settings
router.get('/route', async (_req, res) => {
    try {
        const settings = await (0, db_js_1.queryOne)('SELECT * FROM route_settings WHERE id = 1');
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
    }
    catch (error) {
        console.error('Error fetching route settings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// PUT /api/settings/route - Update route settings
router.put('/route', async (req, res) => {
    try {
        const { mainColor, lineWidth, shadowColor, shadowOpacity } = req.body;
        await (0, db_js_1.run)(`UPDATE route_settings 
       SET main_color = ?, line_width = ?, shadow_color = ?, shadow_opacity = ?
       WHERE id = 1`, [mainColor, lineWidth, shadowColor, shadowOpacity]);
        res.json({ success: true, message: 'Route settings updated' });
    }
    catch (error) {
        console.error('Error updating route settings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// GET /api/settings/stages - Get all stage colors
router.get('/stages', async (_req, res) => {
    try {
        const stages = await (0, db_js_1.query)('SELECT * FROM stage_colors ORDER BY tour_type, stage_number');
        // Group by tour type
        const grouped = {
            gold: [],
            silver: [],
            bronze: [],
        };
        stages.forEach((stage) => {
            grouped[stage.tour_type].push({
                stageNumber: stage.stage_number,
                lineColor: stage.line_color,
                lineOpacity: Number(stage.line_opacity),
                areaColor: stage.area_color,
                areaOpacity: Number(stage.area_opacity),
            });
        });
        res.json({ success: true, stages: grouped });
    }
    catch (error) {
        console.error('Error fetching stage colors:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// PUT /api/settings/stages/:tourType/:stageNumber - Update or create a stage color
router.put('/stages/:tourType/:stageNumber', async (req, res) => {
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
        await (0, db_js_1.run)(`INSERT INTO stage_colors (tour_type, stage_number, line_color, line_opacity, area_color, area_opacity)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           line_color = VALUES(line_color),
           line_opacity = VALUES(line_opacity),
           area_color = VALUES(area_color),
           area_opacity = VALUES(area_opacity)`, [tourType, stageNum, lineColor, lineOpacity, areaColor || null, areaOpacity || 0.3]);
        res.json({ success: true, message: 'Stage color saved' });
    }
    catch (error) {
        console.error('Error saving stage color:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// GET /api/settings/all - Get all settings (route + stages) for frontend
router.get('/all', async (_req, res) => {
    try {
        const routeSettings = await (0, db_js_1.queryOne)('SELECT * FROM route_settings WHERE id = 1');
        const stages = await (0, db_js_1.query)('SELECT * FROM stage_colors ORDER BY tour_type, stage_number');
        // Group stages by tour type
        const groupedStages = {
            gold: [],
            silver: [],
            bronze: [],
        };
        stages.forEach((stage) => {
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
    }
    catch (error) {
        console.error('Error fetching all settings:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map