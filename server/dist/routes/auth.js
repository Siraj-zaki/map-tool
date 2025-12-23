"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const express_1 = require("express");
const db_js_1 = require("../db.js");
const router = (0, express_1.Router)();
// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required',
            });
        }
        const user = await (0, db_js_1.queryOne)('SELECT * FROM users WHERE username = ?', [
            username,
        ]);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        const isValidPassword = bcryptjs_1.default.compareSync(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        // Update last login
        await (0, db_js_1.run)('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [
            user.id,
        ]);
        // Set session
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});
// GET /api/auth/profile
router.get('/profile', async (req, res) => {
    if (!req.session.userId) {
        return res
            .status(401)
            .json({ success: false, message: 'Not authenticated' });
    }
    const user = await (0, db_js_1.queryOne)('SELECT id, username, role, last_login, created_at FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
});
// Middleware for protected routes
function requireAuth(req, res, next) {
    if (!req.session.userId) {
        return res
            .status(401)
            .json({ success: false, message: 'Authentication required' });
    }
    next();
}
function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res
            .status(401)
            .json({ success: false, message: 'Authentication required' });
    }
    if (req.session.role !== 'admin') {
        return res
            .status(403)
            .json({ success: false, message: 'Admin access required' });
    }
    next();
}
exports.default = router;
//# sourceMappingURL=auth.js.map