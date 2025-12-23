"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const path_1 = __importDefault(require("path"));
const db_js_1 = require("./db.js");
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const gpx_js_1 = __importDefault(require("./routes/gpx.js"));
const pois_js_1 = __importDefault(require("./routes/pois.js"));
const routes_js_1 = __importDefault(require("./routes/routes.js"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://mountainsquad.com',
    ],
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Session middleware
app.use((0, express_session_1.default)({
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
}));
// Static files for uploads
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'uploads')));
// API Routes
app.use('/api/auth', auth_js_1.default);
app.use('/api/routes', routes_js_1.default);
app.use('/api/pois', pois_js_1.default);
app.use('/api/gpx', gpx_js_1.default);
// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// =====================================================
// Production: Serve static frontend files
// =====================================================
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the React build
    const clientDistPath = path_1.default.join(__dirname, '..', '..', 'client', 'dist');
    // Serve static assets
    app.use(express_1.default.static(clientDistPath));
    // Serve images from public folder
    app.use('/images', express_1.default.static(path_1.default.join(clientDistPath, 'images')));
    // SPA fallback - serve index.html for all non-API routes
    app.get('*', (req, res) => {
        // Only serve index.html for non-API routes
        if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
            res.sendFile(path_1.default.join(clientDistPath, 'index.html'));
        }
    });
}
// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: err.message });
});
// Initialize database and start server
async function startServer() {
    try {
        // Initialize database (creates tables if not exist)
        await (0, db_js_1.initializeDatabase)();
        // Start server
        const server = app.listen(PORT, () => {
            console.log(`🚀 Harterbrocken API server running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
            console.log(`🗄️  Database: MariaDB at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}`);
            if (process.env.NODE_ENV === 'production') {
                console.log(`🌐 Serving frontend from: client/dist`);
            }
        });
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully...');
            server.close(async () => {
                await (0, db_js_1.closeDatabase)();
                console.log('Server closed');
                process.exit(0);
            });
        });
        process.on('SIGINT', async () => {
            console.log('SIGINT received, shutting down gracefully...');
            server.close(async () => {
                await (0, db_js_1.closeDatabase)();
                console.log('Server closed');
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map