"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '..', 'data', 'harterbrocken.db');
// Ensure data directory exists
const fs_1 = __importDefault(require("fs"));
const dataDir = path_1.default.dirname(dbPath);
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const db = new better_sqlite3_1.default(dbPath);
// Enable foreign keys
db.pragma('foreign_keys = ON');
// Initialize schema
function initializeDatabase() {
    // Routes table
    db.exec(`
    CREATE TABLE IF NOT EXISTS routes (
      route_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      start_point TEXT NOT NULL,
      end_point TEXT NOT NULL,
      route_geometry TEXT,
      distance REAL,
      duration INTEGER,
      highest_point REAL,
      lowest_point REAL,
      total_ascent REAL,
      total_descent REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Add route_geometry column if missing (migration for existing databases)
    try {
        db.exec('ALTER TABLE routes ADD COLUMN route_geometry TEXT');
    }
    catch (e) {
        // Column already exists, ignore
    }
    // Waypoints table
    db.exec(`
    CREATE TABLE IF NOT EXISTS waypoints (
      waypoint_id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER,
      position INTEGER NOT NULL,
      location TEXT NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    )
  `);
    // POIs table
    db.exec(`
    CREATE TABLE IF NOT EXISTS pois (
      poi_id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      type TEXT,
      best_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    )
  `);
    // POI images table
    db.exec(`
    CREATE TABLE IF NOT EXISTS poi_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poi_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      FOREIGN KEY (poi_id) REFERENCES pois(poi_id) ON DELETE CASCADE
    )
  `);
    // POI amenities table
    db.exec(`
    CREATE TABLE IF NOT EXISTS poi_amenities (
      poi_id INTEGER NOT NULL,
      amenity TEXT NOT NULL,
      PRIMARY KEY (poi_id, amenity),
      FOREIGN KEY (poi_id) REFERENCES pois(poi_id) ON DELETE CASCADE
    )
  `);
    // Users table
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Route groups table (for Feature 3)
    db.exec(`
    CREATE TABLE IF NOT EXISTS route_groups (
      group_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Route group members
    db.exec(`
    CREATE TABLE IF NOT EXISTS route_group_members (
      group_id INTEGER NOT NULL,
      route_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      PRIMARY KEY (group_id, route_id),
      FOREIGN KEY (group_id) REFERENCES route_groups(group_id) ON DELETE CASCADE,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    )
  `);
    // GPX files table (for Feature 5)
    db.exec(`
    CREATE TABLE IF NOT EXISTS gpx_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      route_id INTEGER NOT NULL,
      tour_type TEXT NOT NULL,
      stage_number INTEGER DEFAULT 1,
      start_point_name TEXT,
      file_path TEXT NOT NULL,
      FOREIGN KEY (route_id) REFERENCES routes(route_id) ON DELETE CASCADE
    )
  `);
    // Create default admin user if not exists
    const adminExists = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get('admin');
    if (!adminExists) {
        const hashedPassword = bcryptjs_1.default.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
        console.log('Default admin user created (admin/admin123)');
    }
    console.log('Database initialized successfully');
}
exports.default = db;
//# sourceMappingURL=db.js.map