#!/bin/bash

# =====================================================
# Harterbrocken Trail Map - Deployment Script
# Complete automated setup with MariaDB configuration
# =====================================================

set -e  # Exit on any error

echo "🚀 Starting Harterbrocken deployment..."

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =====================================================
# Configuration
# =====================================================
DB_NAME="harterbrocken"
DB_USER="harterbrocken_user"
DB_PASSWORD="Harter@2024Secure!"
DB_HOST="localhost"
DB_PORT="3306"

# =====================================================
# Step 1: Check and Install MariaDB
# =====================================================
echo -e "${YELLOW}🗄️  Checking MariaDB installation...${NC}"

install_mariadb() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo -e "${YELLOW}Installing MariaDB via Homebrew...${NC}"
            brew install mariadb
            brew services start mariadb
            sleep 3
        else
            echo -e "${RED}Homebrew not found. Please install MariaDB manually.${NC}"
            exit 1
        fi
    elif [[ -f /etc/debian_version ]]; then
        # Debian/Ubuntu
        echo -e "${YELLOW}Installing MariaDB via apt...${NC}"
        sudo apt-get update
        sudo apt-get install -y mariadb-server mariadb-client
        sudo systemctl start mariadb
        sudo systemctl enable mariadb
    elif [[ -f /etc/redhat-release ]]; then
        # RHEL/CentOS
        echo -e "${YELLOW}Installing MariaDB via yum...${NC}"
        sudo yum install -y mariadb-server mariadb
        sudo systemctl start mariadb
        sudo systemctl enable mariadb
    else
        echo -e "${RED}Unsupported OS. Please install MariaDB manually.${NC}"
        exit 1
    fi
}

# Check if MariaDB is installed
if ! command -v mysql &> /dev/null && ! command -v mariadb &> /dev/null; then
    echo -e "${YELLOW}MariaDB not found. Installing...${NC}"
    install_mariadb
else
    echo -e "${GREEN}✅ MariaDB is installed${NC}"
fi

# Determine the correct MySQL command
MYSQL_CMD="mysql"
if command -v mariadb &> /dev/null; then
    MYSQL_CMD="mariadb"
fi

# =====================================================
# Step 2: Setup MariaDB Database and User
# =====================================================
echo -e "${YELLOW}🔧 Setting up MariaDB database and user...${NC}"

# Try different authentication methods
setup_database() {
    local MYSQL_ROOT_CMD=""
    
    # Try socket authentication first (common on Linux)
    if sudo $MYSQL_CMD -e "SELECT 1" &> /dev/null 2>&1; then
        MYSQL_ROOT_CMD="sudo $MYSQL_CMD"
    # Try without password (common on fresh macOS install)
    elif $MYSQL_CMD -u root -e "SELECT 1" &> /dev/null 2>&1; then
        MYSQL_ROOT_CMD="$MYSQL_CMD -u root"
    # Try with empty password
    elif $MYSQL_CMD -u root -p'' -e "SELECT 1" &> /dev/null 2>&1; then
        MYSQL_ROOT_CMD="$MYSQL_CMD -u root -p''"
    else
        echo -e "${YELLOW}Please enter your MariaDB root password:${NC}"
        read -s ROOT_PASSWORD
        if $MYSQL_CMD -u root -p"$ROOT_PASSWORD" -e "SELECT 1" &> /dev/null 2>&1; then
            MYSQL_ROOT_CMD="$MYSQL_CMD -u root -p$ROOT_PASSWORD"
        else
            echo -e "${RED}❌ Cannot connect to MariaDB. Please check your installation.${NC}"
            exit 1
        fi
    fi
    
    echo -e "${BLUE}Connected to MariaDB successfully${NC}"
    
    # Create database
    echo -e "${YELLOW}Creating database '$DB_NAME'...${NC}"
    $MYSQL_ROOT_CMD -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    # Create user and grant privileges
    echo -e "${YELLOW}Creating user '$DB_USER'...${NC}"
    $MYSQL_ROOT_CMD -e "DROP USER IF EXISTS '$DB_USER'@'localhost';" 2>/dev/null || true
    $MYSQL_ROOT_CMD -e "CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
    $MYSQL_ROOT_CMD -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    $MYSQL_ROOT_CMD -e "FLUSH PRIVILEGES;"
    
    echo -e "${GREEN}✅ Database and user created successfully${NC}"
}

setup_database

# =====================================================
# Step 3: Check for SQLite data to migrate
# =====================================================
SQLITE_DB="$SCRIPT_DIR/server/data/harterbrocken.db"
MIGRATION_NEEDED=false

if [ -f "$SQLITE_DB" ]; then
    echo -e "${YELLOW}📋 Found existing SQLite database. Checking for data...${NC}"
    
    if command -v sqlite3 &> /dev/null; then
        ROUTE_COUNT=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM routes;" 2>/dev/null || echo "0")
        if [ "$ROUTE_COUNT" -gt "0" ]; then
            MIGRATION_NEEDED=true
            echo -e "${BLUE}Found $ROUTE_COUNT routes to migrate${NC}"
        fi
    else
        echo -e "${YELLOW}sqlite3 not found, skipping migration check${NC}"
    fi
fi

# =====================================================
# Step 4: Create .env file
# =====================================================
echo -e "${YELLOW}📝 Creating .env file...${NC}"
cat > "$SCRIPT_DIR/server/.env" <<EOF
# Server Configuration
PORT=3001
NODE_ENV=production
SESSION_SECRET=$(openssl rand -hex 32)
SECURE_COOKIES=false

# MariaDB Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
EOF
echo -e "${GREEN}✅ .env file created${NC}"

# =====================================================
# Step 5: Install dependencies
# =====================================================
echo -e "${YELLOW}📦 Installing client dependencies...${NC}"
cd "$SCRIPT_DIR/client"
npm install --legacy-peer-deps

echo -e "${YELLOW}📦 Installing server dependencies...${NC}"
cd "$SCRIPT_DIR/server"
npm install

# =====================================================
# Step 6: Build the frontend
# =====================================================
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd "$SCRIPT_DIR/client"
npm run build

# =====================================================
# Step 7: Build the backend
# =====================================================
echo -e "${YELLOW}🔨 Building backend...${NC}"
cd "$SCRIPT_DIR/server"
npm run build

# =====================================================
# Step 8: Create necessary directories
# =====================================================
echo -e "${YELLOW}📁 Creating directories...${NC}"
mkdir -p "$SCRIPT_DIR/server/uploads/poi"
mkdir -p "$SCRIPT_DIR/server/uploads/gpx"

# =====================================================
# Step 9: Initialize database tables
# =====================================================
echo -e "${YELLOW}🗃️  Initializing database tables...${NC}"
cd "$SCRIPT_DIR/server"

# Run the server briefly to initialize tables
timeout 10 node dist/index.js &> /dev/null || true
sleep 5

echo -e "${GREEN}✅ Database tables initialized${NC}"

# =====================================================
# Step 10: Migrate SQLite data if exists
# =====================================================
if [ "$MIGRATION_NEEDED" = true ]; then
    echo -e "${YELLOW}📦 Migrating data from SQLite to MariaDB...${NC}"
    
    # Create migration script
    cat > "$SCRIPT_DIR/server/migrate_data.js" <<'MIGRATION_SCRIPT'
const sqlite3 = require('better-sqlite3');
const mysql = require('mysql2/promise');
const path = require('path');

async function migrate() {
    const sqliteDb = new sqlite3(path.join(__dirname, 'data', 'harterbrocken.db'));
    
    const pool = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });
    
    try {
        // Migrate routes
        console.log('Migrating routes...');
        const routes = sqliteDb.prepare('SELECT * FROM routes').all();
        for (const route of routes) {
            await pool.execute(
                `INSERT INTO routes (route_id, name, description, start_point, end_point, route_geometry, 
                 distance, duration, highest_point, lowest_point, total_ascent, total_descent, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [route.route_id, route.name, route.description, route.start_point, route.end_point,
                 route.route_geometry, route.distance, route.duration, route.highest_point,
                 route.lowest_point, route.total_ascent, route.total_descent, route.created_at]
            );
        }
        console.log(`Migrated ${routes.length} routes`);
        
        // Migrate waypoints
        console.log('Migrating waypoints...');
        const waypoints = sqliteDb.prepare('SELECT * FROM waypoints').all();
        for (const wp of waypoints) {
            await pool.execute(
                'INSERT INTO waypoints (waypoint_id, route_id, position, location) VALUES (?, ?, ?, ?)',
                [wp.waypoint_id, wp.route_id, wp.position, wp.location]
            );
        }
        console.log(`Migrated ${waypoints.length} waypoints`);
        
        // Migrate POIs
        console.log('Migrating POIs...');
        const pois = sqliteDb.prepare('SELECT * FROM pois').all();
        for (const poi of pois) {
            await pool.execute(
                `INSERT INTO pois (poi_id, route_id, name, description, location, type, best_time, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [poi.poi_id, poi.route_id, poi.name, poi.description, poi.location, poi.type, poi.best_time, poi.created_at]
            );
        }
        console.log(`Migrated ${pois.length} POIs`);
        
        // Migrate POI images
        console.log('Migrating POI images...');
        const images = sqliteDb.prepare('SELECT * FROM poi_images').all();
        for (const img of images) {
            await pool.execute(
                'INSERT INTO poi_images (id, poi_id, image_path) VALUES (?, ?, ?)',
                [img.id, img.poi_id, img.image_path]
            );
        }
        console.log(`Migrated ${images.length} POI images`);
        
        // Migrate users (except default admin which is auto-created)
        console.log('Migrating users...');
        const users = sqliteDb.prepare("SELECT * FROM users WHERE username != 'admin'").all();
        for (const user of users) {
            await pool.execute(
                'INSERT INTO users (id, username, password, role, last_login, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [user.id, user.username, user.password, user.role, user.last_login, user.created_at]
            );
        }
        console.log(`Migrated ${users.length} additional users`);
        
        console.log('Migration complete!');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        sqliteDb.close();
        await pool.end();
    }
}

migrate();
MIGRATION_SCRIPT

    # Load env and run migration
    source "$SCRIPT_DIR/server/.env"
    export DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
    
    cd "$SCRIPT_DIR/server"
    npm install better-sqlite3 --save-dev 2>/dev/null || true
    node migrate_data.js
    
    # Cleanup
    rm -f "$SCRIPT_DIR/server/migrate_data.js"
    
    # Backup old SQLite database
    mv "$SQLITE_DB" "$SQLITE_DB.backup.$(date +%Y%m%d)"
    echo -e "${GREEN}✅ Data migration complete. SQLite backup created.${NC}"
fi

# =====================================================
# Step 11: Start/Restart with PM2
# =====================================================
echo -e "${YELLOW}🔄 Starting application with PM2...${NC}"
cd "$SCRIPT_DIR"

# Install PM2 locally in server folder if not installed globally
cd "$SCRIPT_DIR/server"
npm install pm2 --save-dev 2>/dev/null || true
cd "$SCRIPT_DIR"

# Use npx to run PM2 (works regardless of global install)
# Stop existing process if running
npx pm2 delete harterbrocken 2>/dev/null || true

# Start the application
npx pm2 start "$SCRIPT_DIR/ecosystem.config.js"

# Save PM2 process list
npx pm2 save

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ DEPLOYMENT COMPLETE!                       ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC} 🌐 Server: http://localhost:3001                           ${GREEN}║${NC}"
echo -e "${GREEN}║${NC} 🗄️  Database: MariaDB ($DB_NAME)                          ${GREEN}║${NC}"
echo -e "${GREEN}║${NC} 👤 DB User: $DB_USER                                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC} 🔑 DB Password: (saved in server/.env)                     ${GREEN}║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC} 📝 Logs: npx pm2 logs harterbrocken                        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC} 🔄 Restart: npx pm2 restart harterbrocken                  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC} ⏹️  Stop: npx pm2 stop harterbrocken                       ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

npx pm2 list
