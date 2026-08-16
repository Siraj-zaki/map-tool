import crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { query, queryOne, run } from '../db.js';
import { requireAuth } from './auth.js';

const router = Router();

type ExpiryType = 'week' | 'month' | 'never';

/**
 * Compute expires_at for a given expiry_type at row-creation time.
 * `never` → null (server treats null as no expiry). `week` / `month` are
 * measured from "now" in the DB's timezone (a whole-day precision is fine
 * for share links — no need to align to midnight).
 */
function computeExpiresAt(type: ExpiryType): Date | null {
  if (type === 'never') return null;
  const now = new Date();
  const days = type === 'week' ? 7 : 30;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Truthy when the row is expired or revoked. */
function isRowInactive(row: any): boolean {
  if (row.revoked_at) return true;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return true;
  }
  return false;
}

/**
 * Serialize a share_links row for the API response. Keeps the wire format
 * separate from the raw DB shape so we can rename columns later.
 */
function serializeShareLink(row: any) {
  return {
    id: row.id,
    routeId: row.route_id,
    token: row.token,
    name: row.name ?? null,
    expiryType: row.expiry_type as ExpiryType,
    expiresAt: row.expires_at ?? null,
    revokedAt: row.revoked_at ?? null,
    customLogoUrl: row.custom_logo_url ?? null,
    customPrimaryColor: row.custom_primary_color ?? null,
    customAccentColor: row.custom_accent_color ?? null,
    createdAt: row.created_at,
    // Convenience flags so the client doesn't recompute
    isExpired: !!(
      row.expires_at && new Date(row.expires_at).getTime() <= Date.now()
    ),
    isRevoked: !!row.revoked_at,
  };
}

// ---------------------------------------------------------------------------
// Auth-gated: list share links for a route
// ---------------------------------------------------------------------------

router.get(
  '/routes/:routeId/share-links',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { routeId } = req.params;
      const rows = await query(
        'SELECT * FROM share_links WHERE route_id = ? ORDER BY created_at DESC',
        [routeId]
      );
      res.json({ success: true, data: rows.map(serializeShareLink) });
    } catch (error) {
      console.error('List share links error:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to list share links' });
    }
  }
);

// ---------------------------------------------------------------------------
// Auth-gated: create a new share link
// ---------------------------------------------------------------------------

router.post(
  '/routes/:routeId/share-links',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { routeId } = req.params;
      const {
        name,
        expiryType,
        customLogoUrl,
        customPrimaryColor,
        customAccentColor,
      } = req.body as {
        name?: string;
        expiryType?: ExpiryType;
        customLogoUrl?: string;
        customPrimaryColor?: string;
        customAccentColor?: string;
      };

      // Confirm the route exists before minting a token
      const route = await queryOne(
        'SELECT route_id FROM routes WHERE route_id = ?',
        [routeId]
      );
      if (!route) {
        return res
          .status(404)
          .json({ success: false, error: 'Route not found' });
      }

      const finalExpiryType: ExpiryType =
        expiryType === 'week' || expiryType === 'month' || expiryType === 'never'
          ? expiryType
          : 'never';
      const expiresAt = computeExpiresAt(finalExpiryType);

      // 24-hex-char token — 12 bytes of randomness is enough to make guessing
      // infeasible while keeping URLs short. Retry on the vanishingly small
      // chance of a collision.
      let token = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = crypto.randomBytes(12).toString('hex');
        const existing = await queryOne(
          'SELECT id FROM share_links WHERE token = ?',
          [candidate]
        );
        if (!existing) {
          token = candidate;
          break;
        }
      }
      if (!token) {
        return res.status(500).json({
          success: false,
          error: 'Could not allocate a unique share token',
        });
      }

      const result = await run(
        `INSERT INTO share_links
           (route_id, token, name, expiry_type, expires_at,
            custom_logo_url, custom_primary_color, custom_accent_color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routeId,
          token,
          name?.trim() || null,
          finalExpiryType,
          expiresAt,
          customLogoUrl?.trim() || null,
          customPrimaryColor?.trim() || null,
          customAccentColor?.trim() || null,
        ]
      );

      const row = await queryOne('SELECT * FROM share_links WHERE id = ?', [
        result.insertId,
      ]);
      res.json({ success: true, data: serializeShareLink(row) });
    } catch (error) {
      console.error('Create share link error:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to create share link' });
    }
  }
);

// ---------------------------------------------------------------------------
// Auth-gated: update a share link (customization, name, revoke/unrevoke)
// ---------------------------------------------------------------------------

router.patch(
  '/share-links/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const row = await queryOne('SELECT * FROM share_links WHERE id = ?', [id]);
      if (!row) {
        return res
          .status(404)
          .json({ success: false, error: 'Share link not found' });
      }

      const {
        name,
        customLogoUrl,
        customPrimaryColor,
        customAccentColor,
        revoked,
      } = req.body as {
        name?: string | null;
        customLogoUrl?: string | null;
        customPrimaryColor?: string | null;
        customAccentColor?: string | null;
        revoked?: boolean;
      };

      // Build a partial UPDATE — only touch columns the caller mentioned.
      const sets: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        sets.push('name = ?');
        params.push(name?.trim() || null);
      }
      if (customLogoUrl !== undefined) {
        sets.push('custom_logo_url = ?');
        params.push(customLogoUrl?.trim() || null);
      }
      if (customPrimaryColor !== undefined) {
        sets.push('custom_primary_color = ?');
        params.push(customPrimaryColor?.trim() || null);
      }
      if (customAccentColor !== undefined) {
        sets.push('custom_accent_color = ?');
        params.push(customAccentColor?.trim() || null);
      }
      if (revoked !== undefined) {
        sets.push('revoked_at = ?');
        params.push(revoked ? new Date() : null);
      }

      if (sets.length === 0) {
        return res.json({ success: true, data: serializeShareLink(row) });
      }

      params.push(id);
      await run(
        `UPDATE share_links SET ${sets.join(', ')} WHERE id = ?`,
        params
      );

      const updated = await queryOne(
        'SELECT * FROM share_links WHERE id = ?',
        [id]
      );
      res.json({ success: true, data: serializeShareLink(updated) });
    } catch (error) {
      console.error('Update share link error:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to update share link' });
    }
  }
);

// ---------------------------------------------------------------------------
// Auth-gated: delete
// ---------------------------------------------------------------------------

router.delete(
  '/share-links/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await run('DELETE FROM share_links WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, error: 'Share link not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete share link error:', error);
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete share link' });
    }
  }
);

// ---------------------------------------------------------------------------
// PUBLIC: resolve a token → full route + share metadata (with expiry check)
// ---------------------------------------------------------------------------

router.get('/share/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const link = await queryOne(
      'SELECT * FROM share_links WHERE token = ?',
      [token]
    );
    if (!link) {
      return res
        .status(404)
        .json({ success: false, error: 'Share link not found' });
    }
    if (isRowInactive(link)) {
      // 410 Gone — semantic for "existed but no longer available".
      return res.status(410).json({
        success: false,
        error: link.revoked_at ? 'REVOKED' : 'EXPIRED',
      });
    }

    // Fetch the full route + POIs. Mirrors the GET /api/routes/:id assembly
    // in routes.ts so token viewers see identical data.
    const route = await queryOne(
      `SELECT route_id as id, name, description, start_point, end_point,
              route_geometry, elevation_data, distance, duration, highest_point,
              lowest_point, total_ascent, total_descent, created_at
       FROM routes WHERE route_id = ?`,
      [link.route_id]
    );
    if (!route) {
      // Route was deleted after the link was minted — treat as gone.
      return res
        .status(410)
        .json({ success: false, error: 'Route no longer exists' });
    }

    const waypoints = await query(
      `SELECT location FROM waypoints WHERE route_id = ? ORDER BY position ASC`,
      [link.route_id]
    );

    const pois = await query(
      `SELECT poi_id, name, description, location, type, best_time, metadata
       FROM pois WHERE route_id = ?`,
      [link.route_id]
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
        let metadata: Record<string, unknown> | null = null;
        if (poi.metadata) {
          try { metadata = JSON.parse(poi.metadata); } catch { metadata = null; }
        }
        return {
          ...poi,
          lngLat: JSON.parse(poi.location),
          images: images.map((img: any) => img.image_path),
          amenities: amenities.map((a: any) => a.amenity),
          metadata,
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
      share: {
        name: link.name ?? null,
        customLogoUrl: link.custom_logo_url ?? null,
        customPrimaryColor: link.custom_primary_color ?? null,
        customAccentColor: link.custom_accent_color ?? null,
        expiresAt: link.expires_at ?? null,
      },
    });
  } catch (error) {
    console.error('Resolve share link error:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to resolve share link' });
  }
});

export default router;
