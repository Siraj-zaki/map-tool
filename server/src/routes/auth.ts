import bcrypt from 'bcryptjs';
import { Request, Response, Router } from 'express';
import db from '../db.js';

const router = Router();

// Extend session type
declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    role: string;
  }
}

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username) as any;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    db.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(user.id);

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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// GET /api/auth/profile
router.get('/profile', (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: 'Not authenticated' });
  }

  const user = db
    .prepare(
      'SELECT id, username, role, last_login, created_at FROM users WHERE id = ?'
    )
    .get(req.session.userId) as any;

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, user });
});

// Middleware for protected routes
export function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ success: false, message: 'Authentication required' });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: Function) {
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

export default router;
