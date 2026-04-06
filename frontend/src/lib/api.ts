const BASE_URL = '/api';

function getToken(): string | null {
    return localStorage.getItem('ims-token');
}

async function request(method: string, path: string, body?: any): Promise<any> {
    const token = getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Request failed: ${res.status}`);
    }

    return res.json();
}

export const api = {
    get: (path: string) => request('GET', path),
    post: (path: string, body: any) => request('POST', path, body),
    put: (path: string, body: any) => request('PUT', path, body),
    delete: (path: string) => request('DELETE', path),

    // Collection helpers
    collection: {
        getAll: (name: string) => request('GET', `/collections/${name}`),
        getOne: (name: string, id: string) => request('GET', `/collections/${name}/${id}`),
        create: (name: string, data: any) => request('POST', `/collections/${name}`, data),
        update: (name: string, id: string, data: any) => request('PUT', `/collections/${name}/${id}`, data),
        remove: (name: string, id: string) => request('DELETE', `/collections/${name}/${id}`),
    },
};
