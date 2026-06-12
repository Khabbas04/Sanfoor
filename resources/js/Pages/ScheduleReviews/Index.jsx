import React from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import AdminLayout from '@/Layouts/AdminLayout';
import { motion } from 'framer-motion';

export default function Index({ reviews, auth }) {
    const isAdminOrOwner = auth?.user?.role === 'admin' || auth?.user?.role === 'owner' || auth?.user?.is_admin_or_owner;
    const Layout = isAdminOrOwner ? AdminLayout : MainLayout;
    // تنسيق التاريخ محلياً بدون استخدام مكتبات خارجية
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <Layout>
            <Head title="مراجعة جداول الطلاب" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-[900] text-slate-900 dark:text-white mb-2">
                        مراجعة الجداول المقترحة
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-bold">
                        تصفح خطط الطلاب المرسلة للتقييم وقدم ملاحظاتك.
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {reviews.data.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-sm font-[900] text-slate-600 dark:text-slate-300">الطالب</th>
                                        <th className="px-6 py-4 text-sm font-[900] text-slate-600 dark:text-slate-300">التخصص</th>
                                        <th className="px-6 py-4 text-sm font-[900] text-slate-600 dark:text-slate-300">تاريخ الإرسال</th>
                                        <th className="px-6 py-4 text-sm font-[900] text-slate-600 dark:text-slate-300">الحالة</th>
                                        <th className="px-6 py-4 text-sm font-[900] text-slate-600 dark:text-slate-300">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {reviews.data.map((review) => (
                                        <motion.tr 
                                            key={review.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                                {review.user?.name || 'طالب محذوف'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm font-bold">
                                                {review.user?.major?.name || 'غير محدد'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm font-bold" dir="ltr">
                                                {formatDate(review.created_at)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {review.status === 'pending' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-xs font-[800]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                        قيد الانتظار
                                                    </span>
                                                ) : review.status === 'reviewed' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs font-[800]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                        تم التقييم
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 text-xs font-[800]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                        مرفوض
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={route('schedule_reviews.show', review.id)}
                                                    className="inline-flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 rounded-xl font-[800] text-xs transition-colors"
                                                >
                                                    عرض الخطة
                                                </Link>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="text-5xl mb-4 opacity-50">📂</div>
                            <h3 className="text-lg font-[800] text-slate-900 dark:text-white mb-1">لا يوجد طلبات</h3>
                            <p className="text-slate-500 dark:text-slate-400 font-bold">لم يقم أي طالب بإرسال خطته للمراجعة بعد.</p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
