import { Router } from 'express';
import { getDb, SOFT_DELETE_COLLECTIONS, serializeRow, deserializeRow, getAllRows } from '../db.js';
import { requireAuth } from '../auth.js';
import { broadcast } from '../sse.js';

const router = Router();

// Collections that support soft delete
// All others are hard deleted

function generateCode(prefix: string): string {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// Auto-generate codes for certain collections
function enrichNewDoc(collection: string, data: Record<string, any>): Record<string, any> {
    const enriched = { ...data };
    if (collection === 'suppliers' && !enriched.supplier_code) {
        enriched.supplier_code = generateCode('SUP');
    }
    if (collection === 'clients' && !enriched.client_code) {
        enriched.client_code = generateCode('CLI');
    }
    return enriched;
}

// GET /api/collections/:collection
router.get('/:collection', requireAuth, (req, res) => {
    const { collection } = req.params;
    try {
        const rows = getAllRows(collection);
        res.json(rows);
    } catch (e: any) {
        res.status(400).json({ error: `Unknown collection: ${collection}` });
    }
});

// GET /api/collections/:collection/:id
router.get('/:collection/:id', requireAuth, (req, res) => {
    const { collection, id } = req.params;
    const db = getDb();
    try {
        const row = db.prepare(`SELECT * FROM ${collection} WHERE id = ?`).get(id) as any;
        if (!row) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        res.json(deserializeRow(collection, row));
    } catch {
        res.status(400).json({ error: `Unknown collection: ${collection}` });
    }
});

// POST /api/collections/:collection
router.post('/:collection', requireAuth, (req, res) => {
    const { collection } = req.params;
    const db = getDb();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    let data = enrichNewDoc(collection, { ...req.body, id, created_at: now });

    if (SOFT_DELETE_COLLECTIONS.has(collection) && !data.status) {
        data.status = 'active';
    }

    data = serializeRow(collection, data);

    try {
        const cols = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        db.prepare(`INSERT INTO ${collection} (${cols}) VALUES (${placeholders})`).run(...Object.values(data));
        const created = deserializeRow(collection, db.prepare(`SELECT * FROM ${collection} WHERE id = ?`).get(id) as any);
        broadcast(collection, 'created', created);
        res.status(201).json(created);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// PUT /api/collections/:collection/:id
router.put('/:collection/:id', requireAuth, (req, res) => {
    const { collection, id } = req.params;
    const db = getDb();
    const now = new Date().toISOString();
    const data = serializeRow(collection, { ...req.body, last_modified: now });

    // Remove fields that should not be updated via this endpoint
    delete data.id;
    delete data.created_at;
    delete data.password_hash;

    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    try {
        db.prepare(`UPDATE ${collection} SET ${sets} WHERE id = ?`).run(...Object.values(data), id);
        const updated = deserializeRow(collection, db.prepare(`SELECT * FROM ${collection} WHERE id = ?`).get(id) as any);
        broadcast(collection, 'updated', updated);
        res.json(updated);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// DELETE /api/collections/:collection/:id
router.delete('/:collection/:id', requireAuth, (req, res) => {
    const { collection, id } = req.params;
    const db = getDb();
    try {
        if (SOFT_DELETE_COLLECTIONS.has(collection)) {
            db.prepare(`UPDATE ${collection} SET status = 'inactive' WHERE id = ?`).run(id);
        } else {
            db.prepare(`DELETE FROM ${collection} WHERE id = ?`).run(id);
        }
        broadcast(collection, 'deleted', { id });
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
