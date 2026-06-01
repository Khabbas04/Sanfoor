import React, { useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, router } from '@inertiajs/react';
import { 
    CheckCircle, 
    XCircle, 
    ShoppingCart, 
    Trash, 
    Pencil, 
    RefreshCw,
    AlertTriangle,
    User
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('ar');

export default function StudentLogs({ auth, logs, filters }) {
    const [search, setSearch] = useState(filters.search || '');
    const [actionFilter, setActionFilter] = useState(filters.action || '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('admin.student-logs'), { search, action: actionFilter }, { preserveState: true });
    };

    const handleActionFilter = (e) => {
        const action = e.target.value;
        setActionFilter(action);
        router.get(route('admin.student-logs'), { search, action }, { preserveState: true });
    };

    const getActionDetails = (action) => {
        switch (action) {
            case 'course_passed':
                return { label: 'إنجاز مادة', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle };
            case 'course_unpassed':
                return { label: 'إلغاء إنجاز', color: 'bg-red-500/10 text-red-600 border-red-200', icon: XCircle };
            case 'course_cart_added':
                return { label: 'إضافة للتجريبي', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: ShoppingCart };
            case 'course_cart_removed':
                return { label: 'إزالة من التجريبي', color: 'bg-gray-500/10 text-gray-600 border-gray-200', icon: Trash };
            case 'grade_updated':
                return { label: 'تعديل علامة', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Pencil };
            case 'course_retake_added':
                return { label: 'إعادة مادة', color: 'bg-purple-500/10 text-purple-600 border-purple-200', icon: RefreshCw };
            case 'plan_reset':
                return { label: 'إعادة تعيين الخطة', color: 'bg-slate-800 text-white border-slate-700', icon: AlertTriangle };
            default:
                return { label: action, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: CheckCircle };
        }
    };

    return (
        <AdminLayout user={auth.user}>
            <Head title="سجلات نشاط الطلاب" />

            <div className="py-8 w-full">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    
                    {/* Header & Filters */}
                    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">سجلات نشاط الطلاب</h2>
                            <p className="text-slate-500 mt-1 text-sm">تابع إنجازات الطلاب وحركاتهم في الخطة الأكاديمية والتسجيل التجريبي.</p>
                        </div>

                        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="بحث باسم الطالب أو الرقم الجامعي..."
                                className="border-slate-200 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:w-64"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <select
                                className="border-slate-200 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                value={actionFilter}
                                onChange={handleActionFilter}
                            >
                                <option value="">كل الحركات</option>
                                <option value="course_passed">إنجاز مادة</option>
                                <option value="course_unpassed">إلغاء إنجاز</option>
                                <option value="course_cart_added">إضافة للتجريبي</option>
                                <option value="course_cart_removed">إزالة من التجريبي</option>
                                <option value="grade_updated">تعديل علامة</option>
                                <option value="course_retake_added">إعادة مادة</option>
                                <option value="plan_reset">إعادة تعيين الخطة</option>
                            </select>
                            <button
                                type="submit"
                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl shadow-sm transition-colors text-sm font-medium"
                            >
                                بحث
                            </button>
                        </form>
                    </div>

                    {/* Timeline List */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        {logs.data.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                <User className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                                لا توجد سجلات مطابقة للبحث.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {logs.data.map((log) => {
                                    const { label, color, icon: Icon } = getActionDetails(log.action);
                                    
                                    return (
                                        <div key={log.id} className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                            
                                            {/* User Info */}
                                            <div className="flex items-center gap-3 min-w-[200px]">
                                                {log.user.avatar ? (
                                                    <img src={`/storage/${log.user.avatar}`} alt={log.user.name} className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-200" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-100 to-blue-50 flex items-center justify-center text-blue-600 font-bold shadow-sm border border-blue-100">
                                                        {log.user.name.charAt(0)}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-semibold text-slate-800 text-sm truncate w-40">{log.user.name}</div>
                                                    <div className="text-xs text-slate-500">{log.user.university_id || 'بدون رقم'}</div>
                                                </div>
                                            </div>

                                            {/* Action Badge */}
                                            <div className="flex-shrink-0">
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${color}`}>
                                                    <Icon className="w-4 h-4" />
                                                    {label}
                                                </div>
                                            </div>

                                            {/* Course Details */}
                                            <div className="flex-1">
                                                {log.course ? (
                                                    <div className="text-sm text-slate-700">
                                                        <span className="font-medium">{log.course.name}</span>
                                                        <span className="text-slate-400 mx-2">|</span>
                                                        <span className="text-xs text-slate-500">{log.course.code}</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-slate-400 italic">بدون مادة محددة</div>
                                                )}
                                                
                                                {/* Extra Details (Grade, etc.) */}
                                                {log.details && (
                                                    <div className="mt-1 text-xs text-slate-500">
                                                        {log.details.grade !== undefined && <span>العلامة: {log.details.grade ?? 'غير محددة'}</span>}
                                                        {log.details.attempt_number !== undefined && <span>المحاولة: {log.details.attempt_number}</span>}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Timestamp */}
                                            <div className="text-xs text-slate-400 sm:text-left flex-shrink-0 min-w-[100px]">
                                                {dayjs(log.created_at).fromNow()}
                                                <div className="text-[10px] text-slate-300 mt-0.5">{dayjs(log.created_at).format('YYYY-MM-DD HH:mm')}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        
                        {/* Pagination Component (Simple mapping for this demo, usually you'd use a shared Pagination component) */}
                        {logs.links && logs.links.length > 3 && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-1 justify-center">
                                {logs.links.map((link, k) => (
                                    <button
                                        key={k}
                                        onClick={() => link.url && router.get(link.url)}
                                        disabled={!link.url}
                                        className={`px-3 py-1 text-sm rounded-lg border transition-all ${
                                            link.active 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                                : link.url 
                                                    ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300' 
                                                    : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </AdminLayout>
    );
}
