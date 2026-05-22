import { useState, useEffect } from 'react';

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

    const csrfToken = typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        : null;

    const intervalMs = options.intervalMs ?? 15000; // default 15s
    const minutes = options.minutes ?? 30; // look-back window

    const fetchOnlineUsers = async () => {
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
        fetchOnlineUsers();

        // Set up interval
        const pollInterval = setInterval(fetchOnlineUsers, intervalMs);

        return () => clearInterval(pollInterval);
    }, [intervalMs, minutes]);

    // 🔥 Heartbeat: send activity every 60 seconds to keep session alive
    useEffect(() => {
        const sendHeartbeat = async () => {
            try {
                await fetch(route('admin.api.heartbeat'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
                    },
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
            if (navigator.sendBeacon && csrfToken) {
                const payload = new FormData();
                payload.append('_token', csrfToken);
                navigator.sendBeacon(routePath, payload);
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
