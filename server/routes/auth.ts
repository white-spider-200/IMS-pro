import { Router } from 'express';
import { getDb } from '../db.js';
import { checkPassword, hashPassword, signToken, requireAuth } from '../auth.js';

const router = Router();

router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user || !checkPassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
    }

    // Update last_login
    db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(new Date().toISOString(), user.id);

    const token = signToken(user.id, user.email, user.role);
    const { password_hash: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
});

router.get('/me', requireAuth, (req, res) => {
    const { userId } = (req as any).user;
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const { password_hash: _, ...safeUser } = user;
    res.json(safeUser);
});

router.put('/me', requireAuth, (req, res) => {
    const { userId } = (req as any).user;
    const { displayName, phone, location, photoURL } = req.body ?? {};
    const db = getDb();
    db.prepare(`
    UPDATE users SET displayName = ?, phone = ?, location = ?, photoURL = ?
    WHERE id = ?
  `).run(displayName, phone, location, photoURL, userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const { password_hash: _, ...safeUser } = user;
    res.json(safeUser);
});

router.put('/me/password', requireAuth, (req, res) => {
    const { userId } = (req as any).user;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current and new password are required' });
        return;
    }
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!checkPassword(currentPassword, user.password_hash)) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId);
    res.json({ success: true });
});

export default router;
