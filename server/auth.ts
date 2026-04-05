import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'ims-pro-local-secret-change-in-production';
const JWT_EXPIRY = '7d';

export function hashPassword(plain: string): string {
    return bcrypt.hashSync(plain, 10);
}

export function checkPassword(plain: string, hash: string): boolean {
    return bcrypt.compareSync(plain, hash);
}

export function signToken(userId: string, email: string, role: string): string {
    return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): { userId: string; email: string; role: string } | null {
    try {
        return jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
    } catch {
        return null;
    }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const token = header.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    (req as any).user = payload;
    next();
}

export function requireRole(role: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as any).user;
        if (!user || user.role !== role) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        next();
    };
}
