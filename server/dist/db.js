"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.queryOne = queryOne;
exports.run = run;
exports.initializeDatabase = initializeDatabase;
exports.closeDatabase = closeDatabase;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
const promise_1 = __importDefault(require("mysql2/promise"));
const path_1 = __importDefault(require("path"));
// Load environment variables from server/.env explicitly
// This ensures the .env is found regardless of the current working directory (e.g., when run via PM2)
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '..', '.env') });
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
console.log(`[DB] Connecting to MariaDB: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
// Create connection pool
const pool = promise_1.default.createPool(dbConfig);
exports.pool = pool;
// Helper function for queries
async function query(sql, params) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}
// Get a single row
async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}
// Run an insert/update/delete and return result
async function run(sql, params) {
    const [result] = await pool.execute(sql, params);
    return result;
}
// Initialize database schema
async function initializeDatabase() {
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
      distance DECIMAL(10,2),
      duration INT,
      highest_point DECIMAL(10,2),
      lowest_point DECIMAL(10,2),
      total_ascent DECIMAL(10,2),
      total_descent DECIMAL(10,2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
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
      area_color VARCHAR(9) DEFAULT NULL,
      area_opacity DECIMAL(3,2) DEFAULT 0.25,
      UNIQUE KEY unique_tour_stage (tour_type, stage_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    // Seed default route settings if not exists
    const [routeSettingsRows] = await pool.execute('SELECT id FROM route_settings WHERE id = 1');
    if (routeSettingsRows.length === 0) {
        await pool.execute(`INSERT INTO route_settings (id, main_color, line_width, shadow_color, shadow_opacity) 
       VALUES (1, '#088D95', 5, '#000000', 0.15)`);
        console.log('Default route settings created');
    }
    // Seed default stage colors if not exists
    const [stageColorRows] = await pool.execute('SELECT id FROM stage_colors LIMIT 1');
    if (stageColorRows.length === 0) {
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
        for (const [tourType, stageNum, lineColor, lineOpacity, areaColor, areaOpacity,] of defaultStageColors) {
            await pool.execute(`INSERT INTO stage_colors (tour_type, stage_number, line_color, line_opacity, area_color, area_opacity)
         VALUES (?, ?, ?, ?, ?, ?)`, [tourType, stageNum, lineColor, lineOpacity, areaColor, areaOpacity]);
        }
        console.log('Default stage colors created');
    }
    // Create default admin user if not exists
    const [adminRows] = await pool.execute('SELECT id FROM users WHERE username = ?', ['admin']);
    if (adminRows.length === 0) {
        const hashedPassword = bcryptjs_1.default.hashSync('admin123', 10);
        await pool.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);
        console.log('Default admin user created (admin/admin123)');
    }
    console.log('MariaDB database initialized successfully');
}
// Close pool (for graceful shutdown)
async function closeDatabase() {
    await pool.end();
    console.log('Database connection pool closed');
}
// Default export for backward compatibility
exports.default = { query, queryOne, run, pool };
//# sourceMappingURL=db.js.map