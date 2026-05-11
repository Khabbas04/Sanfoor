import React, { useEffect, useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import axios from 'axios';

export default function OwnerLogs({ ownerLogs: initialLogs }) {
    const [logs, setLogs] = useState(initialLogs || []);
    const polling = useRef(null);
    const lastId = useRef(logs.length ? logs[0].id : 0);

    useEffect(() => {
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        // update lastId
        if (logs && logs.length) {
            lastId.current = Math.max(...logs.map(l => l.id));
        }
    }, [logs]);

    useEffect(() => {
        const fetchNew = async () => {
            try {
                const res = await axios.get('/admin/api/owner-logs', {
                    params: { since_id: lastId.current }
                });

                const newLogs = res.data.logs || [];
                if (newLogs.length) {
                    // prepend newest logs
                    setLogs(prev => [...newLogs.reverse(), ...prev].slice(0, 1000));

                    // show browser notifications for each new entry
                    newLogs.forEach(n => {
                        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                            const title = n.action || 'Owner Log';
                            const body = n.details || (n.meta ? JSON.stringify(n.meta) : '');
                            try {
                                new Notification(title, { body: body.slice(0, 200) });
                            } catch (e) {
                                // ignore
                            }
                        }
                    });

                    // update lastId
                    lastId.current = Math.max(...newLogs.map(l => l.id), lastId.current);
                }
            } catch (e) {
                // ignore network errors silently
            }
        };

        // initial immediate fetch then interval
        fetchNew();
        polling.current = setInterval(fetchNew, 3000);
        return () => clearInterval(polling.current);
    }, []);

    return (
        <div className="p-4">
            <Head title="سجل المالك — سنفور" />
            <h1 className="text-2xl font-semibold mb-4">سجل المالك (Owner Logs)</h1>

            <div className="mb-3 text-sm text-gray-500">هذا العرض مخصص للمالك فقط ويعرض كل الأحداث المسجلة كـ owner-only.</div>

            <div className="space-y-2">
                {logs.length === 0 && (
                    <div className="text-gray-500">لا توجد سجلات حتى الآن.</div>
                )}

                {logs.map(log => (
                    <div key={log.id} className="p-3 border rounded-md bg-white shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-medium">{log.action}</div>
                                <div className="text-sm text-gray-600">{log.details}</div>
                            </div>
                            <div className="text-xs text-gray-500">#{log.id} • {new Date(log.created_at).toLocaleString()}</div>
                        </div>
                        {log.user && (
                            <div className="mt-2 text-xs text-gray-500">من: {log.user.name} ({log.user.email})</div>
                        )}
                        {log.meta && (
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto" style={{maxHeight: 220}}>{JSON.stringify(log.meta, null, 2)}</pre>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
