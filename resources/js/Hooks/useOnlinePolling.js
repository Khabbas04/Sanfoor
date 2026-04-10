import { useState, useEffect } from 'react';

/**
 * 🔥 useOnlinePolling Hook
 * Handles live polling of online users, heartbeat, and browser close detection
 * for the admin dashboard.
 */
export function useOnlinePolling(initialOnlineUsers, initialStats) {
    const [liveOnlineUsers, setLiveOnlineUsers] = useState(initialOnlineUsers || []);
    const [liveStats, setLiveStats] = useState({
        active_students_now: initialStats?.active_students_now || 0,
        active_admins_now: initialStats?.active_admins_now || 0,
    });

    // 🔥 Polling for online users every 5 seconds
    useEffect(() => {
        const pollOnlineUsers = async () => {
            try {
                const response = await fetch(route('admin.api.online_users'));
                if (response.ok) {
                    const data = await response.json();
                    setLiveOnlineUsers(data.online_users || []);
                    setLiveStats({
                        active_students_now: data.active_students_now || 0,
                        active_admins_now: data.active_admins_now || 0,
                    });
                }
            } catch (err) {
                console.warn('Polling online users failed:', err.message);
            }
        };

        // Initial poll
        pollOnlineUsers();

        // Set up interval
        const pollInterval = setInterval(pollOnlineUsers, 5000);

        return () => clearInterval(pollInterval);
    }, []);

    // 🔥 Heartbeat: send activity every 60 seconds to keep session alive
    useEffect(() => {
        const sendHeartbeat = async () => {
            try {
                await fetch(route('heartbeat'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                });
            } catch (err) {
                console.warn('Heartbeat failed:', err.message);
            }
        };

        const heartbeatInterval = setInterval(sendHeartbeat, 60000);

        return () => clearInterval(heartbeatInterval);
    }, []);

    // 🔥 Handle browser close: notify backend when user closes tab/window
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Use sendBeacon to ensure request is sent even if page is being closed
            const routePath = route('browser_close');
            navigator.sendBeacon(routePath, JSON.stringify({}));
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    return {
        onlineUsers: liveOnlineUsers,
        stats: liveStats,
    };
}
