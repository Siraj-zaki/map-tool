import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import path from 'path';

import { initializeDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import gpxRoutes from './routes/gpx.js';
import poisRoutes from './routes/pois.js';
import routesRoutes from './routes/routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://mountainsquad.com',
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'harterbrocken-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Only use secure cookies if running behind HTTPS proxy
      secure: process.env.SECURE_COOKIES === 'true',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax', // Helps with CSRF protection
    },
  })
);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/pois', poisRoutes);
app.use('/api/gpx', gpxRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =====================================================
// Production: Serve static frontend files
// =====================================================
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React build
  const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');

  // Serve static assets
  app.use(express.static(clientDistPath));

  // Serve images from public folder
  app.use('/images', express.static(path.join(clientDistPath, 'images')));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
);

app.listen(PORT, () => {
  console.log(
    `🚀 Harterbrocken API server running on http://localhost:${PORT}`
  );
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🌐 Serving frontend from: client/dist`);
  }
});

export default app;
