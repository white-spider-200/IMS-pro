import type { Request, Response } from 'express';
import { requireAuth } from './auth.js';

type SSEClient = { res: Response; userId: string };

const clients: Set<SSEClient> = new Set();

export function sseHandler(req: Request, res: Response) {
    // Inline auth for SSE (can't set headers after EventSource connects)
    const token = req.query.token as string;
    if (!token) {
        res.status(401).end();
        return;
    }
    const { verifyToken } = require('./auth.js');
    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).end();
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const client: SSEClient = { res, userId: payload.userId };
    clients.add(client);

    // Send initial heartbeat
    res.write('event: connected\ndata: {}\n\n');

    // Heartbeat every 25s to keep connection alive
    const heartbeat = setInterval(() => {
        res.write('event: heartbeat\ndata: {}\n\n');
    }, 25000);

    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(client);
    });
}

export function broadcast(collection: string, eventType: 'created' | 'updated' | 'deleted', data: any) {
    const payload = JSON.stringify({ collection, event: eventType, data });
    for (const client of clients) {
        try {
            client.res.write(`event: db_change\ndata: ${payload}\n\n`);
        } catch {
            clients.delete(client);
        }
    }
}

export function broadcastCollection(collection: string, rows: any[]) {
    const payload = JSON.stringify({ collection, event: 'snapshot', data: rows });
    for (const client of clients) {
        try {
            client.res.write(`event: db_change\ndata: ${payload}\n\n`);
        } catch {
            clients.delete(client);
        }
    }
}
