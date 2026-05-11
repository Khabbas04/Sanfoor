import React, { useEffect, useState, useRef } from 'react';
import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import axios from 'axios';

export default function OwnerLogs({ ownerLogs: initialOwnerLogs, logs: initialLogs }) {
    const [tab, setTab] = useState('owner'); // 'owner' or 'all'
    const [ownerLogs, setOwnerLogs] = useState(initialOwnerLogs || []);
    const [logs, setLogs] = useState(initialLogs || []);
    const polling = useRef(null);
    const lastId = useRef(ownerLogs.length ? ownerLogs[0].id : 0);

    useEffect(() => {
        // update lastId from ownerLogs
        if (ownerLogs && ownerLogs.length) {
            lastId.current = Math.max(...ownerLogs.map(l => l.id));
        }
    }, [ownerLogs]);

    useEffect(() => {
        const fetchNew = async () => {
            try {
                const res = await axios.get('/admin/api/owner-logs', {
                    params: { since_id: lastId.current }
                });

                const newLogs = res.data.logs || [];
                if (newLogs.length) {
                    // prepend newest owner logs
                    setOwnerLogs(prev => [...newLogs.reverse(), ...prev].slice(0, 2000));
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
        <AdminLayout>
            <Head title="سجل المالك — سنفور" />
            <div className="p-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold">سجل المالك / Owner Logs</h1>
                        <p className="text-sm text-gray-500">عرض السجلات العادية والـ owner-only مع إشعارات مباشرة.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setTab('owner')} className={`px-4 py-2 rounded-xl font-black ${tab === 'owner' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-200'}`}>سجلات المالك</button>
                        <button onClick={() => setTab('all')} className={`px-4 py-2 rounded-xl font-black ${tab === 'all' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-200'}`}>السجل العام</button>
                    </div>
                </div>

                <div className="space-y-3">
                    {tab === 'owner' && ownerLogs.length === 0 && (
                        <div className="text-gray-500">لا توجد سجلات خاصة بالمالك حتى الآن.</div>
                    )}

                    {tab === 'owner' && ownerLogs.map(log => (
                        <div key={log.id} className="p-4 border rounded-lg bg-white shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-indigo-700">{log.action}</div>
                                    <div className="text-sm text-gray-600 mt-1">{log.details}</div>
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

                    {tab === 'all' && logs.length === 0 && (
                        <div className="text-gray-500">لا توجد سجلات عامة حتى الآن.</div>
                    )}

                    {tab === 'all' && logs.map(log => (
                        <div key={log.id} className="p-3 border rounded-md bg-white/5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-medium">{log.action}</div>
                                    <div className="text-sm text-gray-400">{log.details}</div>
                                </div>
                                <div className="text-xs text-gray-500">#{log.id} • {new Date(log.created_at).toLocaleString()}</div>
                            </div>
                            {log.user && (
                                <div className="mt-2 text-xs text-gray-400">من: {log.user.name} ({log.user.email})</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}
