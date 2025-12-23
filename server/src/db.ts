import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

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
