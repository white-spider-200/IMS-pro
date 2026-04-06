import { api } from './api';

const TOKEN_KEY = 'ims-token';
const USER_KEY = 'ims-user';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): any | null {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function login(email: string, password: string): Promise<any> {
    const { token, user } = await api.post('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
}

export async function logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}

export async function fetchCurrentUser(): Promise<any | null> {
    if (!getToken()) return null;
    try {
        const user = await api.get('/auth/me');
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return user;
    } catch {
        logout();
        return null;
    }
}

export async function updateProfile(data: { displayName?: string; phone?: string; location?: string; photoURL?: string }): Promise<any> {
    const user = await api.put('/auth/me', data);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
}
