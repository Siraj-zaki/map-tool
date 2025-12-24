import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';

// Load environment variables from server/.env explicitly
// This ensures the .env is found regardless of the current working directory (e.g., when run via PM2)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// MariaDB connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'harterbrocken',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Log connection info (without password)
console.log(
  `[DB] Connecting to MariaDB: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
);

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Helper function for queries
export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

// Get a single row
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T[]>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Run an insert/update/delete and return result
export async function run(
  sql: string,
  params?: any[]
): Promise<mysql.ResultSetHeader> {
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

// Initialize database schema
export async function initializeDatabase() {
  console.log('Initializing MariaDB database...');

  // Routes table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS routes (
      route_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      start_point TEXT NOT NULL,
      end_point TEXT NOT NULL,
      route_geometry LONGTEXT,
      elevation_data LONGTEXT,
      distance DECIMAL(10,2),
      duration INT,
      highest_point DECIMAL(10,2),
      lowest_point DECIMAL(10,2),
      total_ascent DECIMAL(10,2),
      total_descent DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Add elevation_data column if it doesn't exist (for existing databases)
  try {
    await pool.execute(`
      ALTER TABLE routes ADD COLUMN IF NOT EXISTS elevation_data LONGTEXT
    `);
  } catch (e) {
    // Column may already exist
  }

  // Waypoints table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS waypoints (
      waypoint_id INT AUTO_INCREMENT PRIMARY KEY,
      route_id INT,
      position INT NOT NULL,
      location TEXT NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // POIs table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS pois (
      poi_id INT AUTO_INCREMENT PRIMARY KEY,
      route_id INT,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      type VARCHAR(100),
      best_time VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // POI images table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS poi_images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      poi_id INT NOT NULL,
      image_path VARCHAR(500) NOT NULL,
      FOREIGN KEY (poi_id) REFERENCES pois(poi_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // POI amenities table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS poi_amenities (
      poi_id INT NOT NULL,
      amenity VARCHAR(100) NOT NULL,
      PRIMARY KEY (poi_id, amenity),
      FOREIGN KEY (poi_id) REFERENCES pois(poi_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Users table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      last_login TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Route groups table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS route_groups (
      group_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Route group members
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS route_group_members (
      group_id INT NOT NULL,
      route_id INT NOT NULL,
      position INT DEFAULT 0,
      PRIMARY KEY (group_id, route_id),
      FOREIGN KEY (group_id) REFERENCES route_groups(group_id) ON DELETE CASCADE,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // GPX files table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS gpx_files (
      id INT AUTO_INCREMENT PRIMARY KEY,
      route_id INT NOT NULL,
      tour_type VARCHAR(50) NOT NULL,
      stage_number INT DEFAULT 1,
      start_point_name VARCHAR(255),
      file_path VARCHAR(500) NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Route settings table (single row for global settings)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS route_settings (
      id INT PRIMARY KEY DEFAULT 1,
      main_color VARCHAR(9) DEFAULT '#088D95',
      line_width INT DEFAULT 5,
      shadow_color VARCHAR(9) DEFAULT '#000000',
      shadow_opacity DECIMAL(3,2) DEFAULT 0.15,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Stage colors table (per tour type/stage)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS stage_colors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tour_type ENUM('bronze', 'silver', 'gold') NOT NULL,
      stage_number INT NOT NULL DEFAULT 1,
      line_color VARCHAR(9) NOT NULL,
      line_opacity DECIMAL(3,2) DEFAULT 1.00,
      area_color VARCHAR(50) DEFAULT NULL,
      area_opacity DECIMAL(3,2) DEFAULT 0.25,
      UNIQUE KEY unique_tour_stage (tour_type, stage_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Seed default route settings if not exists
  const [routeSettingsRows] = await pool.execute(
    'SELECT id FROM route_settings WHERE id = 1'
  );
  if ((routeSettingsRows as any[]).length === 0) {
    await pool.execute(
      `INSERT INTO route_settings (id, main_color, line_width, shadow_color, shadow_opacity) 
       VALUES (1, '#088D95', 5, '#000000', 0.15)`
    );
    console.log('Default route settings created');
  }

  // Seed default stage colors if not exists
  const [stageColorRows] = await pool.execute(
    'SELECT id FROM stage_colors LIMIT 1'
  );
  if ((stageColorRows as any[]).length === 0) {
    const defaultStageColors = [
      // Gold (1 stage)
      ['gold', 1, '#088D95', 1.0, 'rgba(8, 141, 149, 0.30)', 0.3],
      // Silver (2 stages)
      ['silver', 1, '#088D95', 1.0, 'rgba(8, 141, 149, 0.30)', 0.3],
      ['silver', 2, '#076873', 1.0, 'rgba(7, 104, 115, 0.25)', 0.25],
      // Bronze (3 stages)
      ['bronze', 1, '#088D95', 1.0, 'rgba(8, 141, 149, 0.30)', 0.3],
      ['bronze', 2, '#076873', 1.0, 'rgba(7, 104, 115, 0.25)', 0.25],
      ['bronze', 3, '#5CB7BB', 1.0, 'rgba(92, 183, 187, 0.25)', 0.25],
    ];

    for (const [
      tourType,
      stageNum,
      lineColor,
      lineOpacity,
      areaColor,
      areaOpacity,
    ] of defaultStageColors) {
      await pool.execute(
        `INSERT INTO stage_colors (tour_type, stage_number, line_color, line_opacity, area_color, area_opacity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tourType, stageNum, lineColor, lineOpacity, areaColor, areaOpacity]
      );
    }
    console.log('Default stage colors created');
  }

  // Stage split points table (user-defined stage boundaries)
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS stage_split_points (
      id INT AUTO_INCREMENT PRIMARY KEY,
      route_id INT NOT NULL,
      tour_type ENUM('bronze', 'silver') NOT NULL,
      stage_number INT NOT NULL,
      location_name VARCHAR(255) NOT NULL,
      lng DECIMAL(11,8) NOT NULL,
      lat DECIMAL(10,8) NOT NULL,
      distance_km DECIMAL(8,3) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE,
      UNIQUE KEY unique_route_tour_stage (route_id, tour_type, stage_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Create default admin user if not exists
  const [adminRows] = await pool.execute(
    'SELECT id FROM users WHERE username = ?',
    ['admin']
  );
  if ((adminRows as any[]).length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await pool.execute(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      ['admin', hashedPassword, 'admin']
    );
    console.log('Default admin user created (admin/admin123)');
  }

  console.log('MariaDB database initialized successfully');
}

// Close pool (for graceful shutdown)
export async function closeDatabase() {
  await pool.end();
  console.log('Database connection pool closed');
}

// Export pool for direct access if needed
export { pool };

// Default export for backward compatibility
export default { query, queryOne, run, pool };
