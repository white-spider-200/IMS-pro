import { useEffect, useRef, useCallback } from 'react';
import { getToken } from './localAuth';

type SSECallback = (collection: string, event: string, data: any) => void;

export function useSSE(onMessage: SSECallback, enabled = true) {
    const esRef = useRef<EventSource | null>(null);
    const onMessageRef = useRef(onMessage);
    onMessageRef.current = onMessage;

    const connect = useCallback(() => {
        if (!enabled) return;
        const token = getToken();
        if (!token) return;

        const es = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
        esRef.current = es;

        es.addEventListener('db_change', (e: MessageEvent) => {
            try {
                const { collection, event, data } = JSON.parse(e.data);
                onMessageRef.current(collection, event, data);
            } catch { /* ignore parse errors */ }
        });

        es.addEventListener('connected', () => {
            console.log('[SSE] Connected to real-time updates');
        });

        es.onerror = () => {
            es.close();
            esRef.current = null;
            // Reconnect after 3 seconds
            setTimeout(connect, 3000);
        };
    }, [enabled]);

    useEffect(() => {
        connect();
        return () => {
            esRef.current?.close();
            esRef.current = null;
        };
    }, [connect]);
}
