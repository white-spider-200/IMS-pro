import { Router } from 'express';
import { SOFT_DELETE_COLLECTIONS, serializeRow, deserializeRow, getAllRows, assertCollection, modelForCollection } from '../../db.js';
import { requireAuth } from '../../auth.js';
import { broadcast } from '../../sse.js';

const router = Router();

// Collections that support soft delete
// All others are hard deleted
const COLLECTIONS_WITH_LAST_MODIFIED = new Set([
    'clients',
    'inventory_balances',
]);

function stripUnsupportedFields(collection: string, data: Record<string, any>): Record<string, any> {
    const next = { ...data };
    if (!COLLECTIONS_WITH_LAST_MODIFIED.has(collection)) {
        delete next.last_modified;
    }
    return next;
}

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
router.get('/:collection', requireAuth, async (req, res) => {
    const { collection } = req.params;
    try {
        assertCollection(collection);
        const rows = await getAllRows(collection);
        res.json(rows);
    } catch (e: any) {
        res.status(400).json({ error: `Unknown collection: ${collection}` });
    }
});

// GET /api/collections/:collection/:id
router.get('/:collection/:id', requireAuth, async (req, res) => {
    const { collection, id } = req.params;
    try {
        assertCollection(collection);
        const model = modelForCollection(collection);
        const row = await model.findUnique({ where: { id } });
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
router.post('/:collection', requireAuth, async (req, res) => {
    const { collection } = req.params;
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    let data = enrichNewDoc(collection, { ...req.body, id, created_at: now });

    if (SOFT_DELETE_COLLECTIONS.has(collection) && !data.status) {
        data.status = 'active';
    }

    data = stripUnsupportedFields(collection, serializeRow(collection, data));

    try {
        assertCollection(collection);
        if (!COLLECTIONS_WITH_LAST_MODIFIED.has(collection)) {
            delete (data as any).last_modified;
        }
        const model = modelForCollection(collection);
        const createdRaw = await model.create({ data });
        const created = deserializeRow(collection, createdRaw as any);
        broadcast(collection, 'created', created);
        res.status(201).json(created);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// PUT /api/collections/:collection/:id
router.put('/:collection/:id', requireAuth, async (req, res) => {
    const { collection, id } = req.params;
    const now = new Date().toISOString();
    const data = stripUnsupportedFields(collection, serializeRow(collection, { ...req.body, last_modified: now }));

    // Remove fields that should not be updated via this endpoint
    delete data.id;
    delete data.created_at;
    delete data.password_hash;
    if (!COLLECTIONS_WITH_LAST_MODIFIED.has(collection)) {
        delete (data as any).last_modified;
    }

    const keys = Object.keys(data);
    try {
        assertCollection(collection);
        const model = modelForCollection(collection);
        const updatedRaw = await model.update({
            where: { id },
            data: keys.reduce((acc, key) => {
                (acc as any)[key] = (data as any)[key];
                return acc;
            }, {} as Record<string, any>),
        });
        const updated = deserializeRow(collection, updatedRaw as any);
        broadcast(collection, 'updated', updated);
        res.json(updated);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// DELETE /api/collections/:collection/:id
router.delete('/:collection/:id', requireAuth, async (req, res) => {
    const { collection, id } = req.params;
    try {
        assertCollection(collection);
        const model = modelForCollection(collection);
        if (SOFT_DELETE_COLLECTIONS.has(collection)) {
            await model.update({ where: { id }, data: { status: 'inactive' } });
        } else {
            await model.delete({ where: { id } });
        }
        broadcast(collection, 'deleted', { id });
        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
