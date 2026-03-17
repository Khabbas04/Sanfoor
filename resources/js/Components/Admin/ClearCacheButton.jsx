import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function ClearCacheButton() {
    const [isLoading, setIsLoading] = useState(false);

    const handleClearCache = async () => {
        const result = await Swal.fire({
            title: 'Are you sure you want to clear system cache?',
            text: 'This will rebuild application caches and may take a few seconds.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, clear cache',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#94a3b8',
            customClass: {
                popup: 'rounded-3xl',
                confirmButton: 'rounded-xl',
                cancelButton: 'rounded-xl',
            },
        });

        if (!result.isConfirmed) {
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post(route('admin.clear-cache'));
            const warning = response?.data?.warning;

            await Swal.fire({
                icon: warning ? 'info' : 'success',
                title: 'تم بنجاح',
                text: warning || response?.data?.message || 'System cache cleared successfully',
                timer: warning ? 2600 : 1800,
                showConfirmButton: false,
                toast: true,
                position: 'top-end',
            });
        } catch (error) {
            const message = error?.response?.data?.message || 'فشل تنفيذ تفريغ الكاش. حاول مرة أخرى.';
            await Swal.fire({
                icon: 'error',
                title: 'خطأ',
                text: message,
                timer: 2600,
                showConfirmButton: false,
                toast: true,
                position: 'top-end',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleClearCache}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
        >
            <div className="flex items-center gap-3">
                <span className="text-lg group-hover:scale-110 transition-transform">🧹</span>
                <span className="text-xs font-black text-slate-700">تفريغ كاش النظام</span>
            </div>

            {isLoading ? (
                <span className="inline-flex items-center gap-2 text-[11px] font-black text-indigo-600">
                    <span className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></span>
                    جاري التنفيذ...
                </span>
            ) : (
                <span className="text-slate-300 group-hover:text-indigo-500 transition-colors text-lg">←</span>
            )}
        </button>
    );
}
