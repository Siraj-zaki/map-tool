#!/bin/bash

# =====================================================
# Harterbrocken Trail Map - Deployment Script
# Run this script on the IONOS server to deploy
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
NC='\033[0m' # No Color

# =====================================================
# Step 1: Install dependencies
# =====================================================
echo -e "${YELLOW}📦 Installing client dependencies...${NC}"
cd "$SCRIPT_DIR/client"
npm install --legacy-peer-deps

echo -e "${YELLOW}📦 Installing server dependencies...${NC}"
cd "$SCRIPT_DIR/server"
npm install

# =====================================================
# Step 2: Build the frontend
# =====================================================
echo -e "${YELLOW}🔨 Building frontend...${NC}"
cd "$SCRIPT_DIR/client"
npm run build

# =====================================================
# Step 3: Build the backend
# =====================================================
echo -e "${YELLOW}🔨 Building backend...${NC}"
cd "$SCRIPT_DIR/server"
npm run build

# =====================================================
# Step 4: Create necessary directories
# =====================================================
echo -e "${YELLOW}📁 Creating directories...${NC}"
mkdir -p "$SCRIPT_DIR/server/data"
mkdir -p "$SCRIPT_DIR/server/uploads"

# =====================================================
# Step 5: Create .env file if not exists
# =====================================================
if [ ! -f "$SCRIPT_DIR/server/.env" ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    cat > "$SCRIPT_DIR/server/.env" << EOF
PORT=3001
NODE_ENV=production
SESSION_SECRET=$(openssl rand -hex 32)
EOF
    echo -e "${GREEN}✅ .env file created with secure session secret${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# =====================================================
# Step 6: Start/Restart with PM2
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
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "📊 Application Status:"
npx pm2 list
echo ""
echo -e "🌐 Server running at: http://localhost:3001"
echo -e "📝 View logs with: npx pm2 logs harterbrocken"
echo -e "🔄 Restart with: npx pm2 restart harterbrocken"
echo ""
