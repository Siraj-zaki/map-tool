# Harterbrocken Trail Map - Deployment Guide

## Architecture Overview

- **Frontend**: React/Vite static files served by the Node.js server
- **Backend**: Express.js API with SQLite database
- **Both run on a single Node.js process for simplicity**

## Prerequisites on IONOS Server

```bash
# Install Node.js 18+ (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 for process management
sudo npm install -g pm2
```

## Deployment Steps

### 1. Upload the project to server

Upload the entire `Harterbrocken Map Data` folder to your server.

### 2. Run the deployment script

```bash
cd /path/to/harterbrocken
chmod +x deploy.sh
./deploy.sh
```

### 3. Configure Nginx (if using)

Add this to your nginx config:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

Create a `.env` file in the `server` folder:

```
PORT=3001
NODE_ENV=production
SESSION_SECRET=your-secure-random-secret-key-here
```

## PM2 Commands

```bash
# View running processes
pm2 list

# View logs
pm2 logs harterbrocken

# Restart application
pm2 restart harterbrocken

# Stop application
pm2 stop harterbrocken

# Start on boot
pm2 startup
pm2 save
```

## Folder Structure After Deployment

```
harterbrocken/
├── client/
│   ├── dist/           # Built frontend files
│   └── ...
├── server/
│   ├── dist/           # Compiled TypeScript
│   ├── data/           # SQLite database
│   ├── uploads/        # Uploaded files
│   └── ...
├── deploy.sh           # Deployment script
└── ecosystem.config.js # PM2 configuration
```
