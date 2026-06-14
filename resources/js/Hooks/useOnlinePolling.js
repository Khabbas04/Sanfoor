import { useState, useEffect } from 'react';
import { csrfHeaders } from '@/utils/csrf';

/**
 * 🔥 useOnlinePolling Hook
 * Handles live polling of online users, heartbeat, and browser close detection
 * for the admin dashboard.
 */
export function useOnlinePolling(initialOnlineUsers, initialStats, options = {}) {
    const [liveOnlineUsers, setLiveOnlineUsers] = useState(initialOnlineUsers || []);
    const [liveStats, setLiveStats] = useState({
        active_students_now: initialStats?.active_students_now || 0,
        active_admins_now: initialStats?.active_admins_now || 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

    const intervalMs = options.intervalMs ?? 60000; // default 60s to prevent DDoS
    const minutes = options.minutes ?? 30; // look-back window

    const fetchOnlineUsers = async () => {
        // Do not hit the server if the user is in another tab
        if (document.hidden) return;

        try {
            const url = route('admin.api.online_users', { minutes });
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`Request failed with status ${response.status}`);
            }

            const data = await response.json();
            setLiveOnlineUsers(data.online_users || []);
            setLiveStats({
                active_students_now: data.active_students_now || 0,
                active_admins_now: data.active_admins_now || 0,
            });
            setLastUpdatedAt(new Date());
            setError('');
        } catch (err) {
            setError(err?.message || 'Polling failed');
            console.warn('Polling online users failed:', err?.message || err);
        } finally {
            setIsLoading(false);
        }
    };

    // 🔥 Polling for online users (configurable interval)
    useEffect(() => {
        // Initial poll
        if (!document.hidden) fetchOnlineUsers();

        // Set up interval
        const pollInterval = setInterval(fetchOnlineUsers, intervalMs);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchOnlineUsers();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(pollInterval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [intervalMs, minutes]);

    // 🔥 Heartbeat: send activity every 60 seconds to keep session alive
    useEffect(() => {
        const sendHeartbeat = async () => {
            try {
                await fetch(route('admin.api.heartbeat'), {
                    method: 'POST',
                    headers: csrfHeaders({
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    }),
                    credentials: 'same-origin',
                });
            } catch (err) {
                console.warn('Heartbeat failed:', err?.message || err);
            }
        };

        const heartbeatInterval = setInterval(sendHeartbeat, 60000);

        return () => clearInterval(heartbeatInterval);
    }, []);

    // 🔥 Handle browser close: notify backend when user closes tab/window
    useEffect(() => {
        const handleBeforeUnload = () => {
            const routePath = route('admin.api.browser_close');
            try {
                fetch(routePath, {
                    method: 'POST',
                    headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
                    keepalive: true,
                });
            } catch (e) {
                // ignore
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    return {
        onlineUsers: liveOnlineUsers,
        stats: liveStats,
        isLoading,
        error,
        lastUpdatedAt,
        refreshNow: fetchOnlineUsers,
    };
}
