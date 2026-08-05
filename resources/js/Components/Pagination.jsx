import React from 'react';
import { router } from '@inertiajs/react';

export default function Pagination({ links }) {
    if (!links || links.length <= 3) {
        return null;
    }

    return (
        <div className="flex flex-wrap gap-1 justify-center">
            {links.map((link, k) => (
                <button
                    key={k}
                    onClick={() => link.url && router.get(link.url, {}, { preserveScroll: true })}
                    disabled={!link.url}
                    className={`px-3 py-1 text-sm rounded-lg border transition-all ${
                        link.active 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                            : link.url 
                                ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700' 
                                : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed dark:bg-gray-900 dark:border-gray-800'
                    }`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                />
            ))}
        </div>
    );
}
