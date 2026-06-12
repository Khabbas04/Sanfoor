import React, { useState } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import AdminLayout from '@/Layouts/AdminLayout';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

export default function Show({ schedule_review, student_stats, passed_courses, auth }) {
    const isAdminOrOwner = auth?.user?.role === 'admin' || auth?.user?.role === 'owner' || auth?.user?.is_admin_or_owner;
    const Layout = isAdminOrOwner ? AdminLayout : MainLayout;

    const { data, setData, post, processing, errors } = useForm({
        feedback: schedule_review.feedback || '',
        status: schedule_review.status !== 'pending' ? schedule_review.status : 'reviewed'
    });

    const submitFeedback = (e) => {
        e.preventDefault();
        post(route('schedule_reviews.feedback', schedule_review.id), {
            preserveScroll: true,
            onSuccess: () => {
                Swal.fire({
                    icon: 'success',
                    title: 'تم التقييم!',
                    text: 'تم إرسال التقييم للطالب بنجاح.',
                    confirmButtonColor: '#4f46e5'
                });
            }
        });
    };

    const planData = Array.isArray(schedule_review.plan_data) ? schedule_review.plan_data : [];
    const totalProposedHours = planData.reduce((sum, c) => sum + (Number(c.credit_hours) || 0), 0);

    return (
        <Layout>
            <Head title={`مراجعة خطة | ${schedule_review.user?.name}`} />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link href={route('schedule_reviews.index')} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-colors">
                                ➔
                            </Link>
                            <h1 className="text-3xl font-[900] text-slate-900 dark:text-white">
                                تقييم خطة الطالب
                            </h1>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-bold pr-11">
                            مراجعة الجدول المقترح وتقييم مدى ملاءمته.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Right Column: Student Info & Passed Courses */}
                    <div className="space-y-6">
                        {/* Student Card */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-[900] text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                👤 بيانات الطالب
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[11px] font-[800] text-slate-400 uppercase">اسم الطالب</p>
                                    <p className="font-[800] text-slate-800 dark:text-slate-200">{schedule_review.user?.name}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-[800] text-slate-400 uppercase">التخصص</p>
                                    <p className="font-[800] text-slate-800 dark:text-slate-200">{student_stats.major_name}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                        <p className="text-[10px] font-[800] text-slate-400">المعدل التراكمي</p>
                                        <p className="text-xl font-[900] text-indigo-600 dark:text-indigo-400">{student_stats.gpa}%</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                        <p className="text-[10px] font-[800] text-slate-400">الساعات المقطوعة</p>
                                        <p className="text-xl font-[900] text-emerald-600 dark:text-emerald-400">{student_stats.passed_hours} <span className="text-xs">س</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Passed Courses Summary */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-[900] text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                ✅ سجل الإنجاز
                            </h2>
                            <div className="h-64 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                {passed_courses.length > 0 ? passed_courses.map(course => (
                                    <div key={course.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700">
                                        <div>
                                            <p className="font-[800] text-[12px] text-slate-800 dark:text-slate-200">{course.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold font-mono">{course.code}</p>
                                        </div>
                                        <div className="text-left">
                                            {course.pivot?.grade && <p className="text-[12px] font-[900] text-indigo-600 dark:text-indigo-400">{course.pivot.grade}</p>}
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-sm font-bold text-slate-400 text-center py-4">لا يوجد مواد منجزة.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Left Column: Proposed Plan & Feedback */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Proposed Schedule */}
                        <div className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-slate-900 dark:to-indigo-950/20 rounded-3xl p-6 shadow-sm border border-indigo-100 dark:border-indigo-500/20">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-[900] text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                                    🗓️ الجدول المقترح
                                </h2>
                                <div className="bg-white/60 dark:bg-slate-800 p-2 px-4 rounded-xl shadow-sm border border-white dark:border-slate-700">
                                    <span className="text-[11px] font-[800] text-slate-500 dark:text-slate-400">العبء الدراسي: </span>
                                    <span className="font-[900] text-indigo-600 dark:text-indigo-400 text-lg">{totalProposedHours} <span className="text-xs">ساعات</span></span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {planData.map((course, index) => (
                                    <motion.div 
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200/60 dark:border-slate-700 relative overflow-hidden group"
                                    >
                                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
                                        <div className="pr-4">
                                            <p className="font-[900] text-[14px] text-slate-800 dark:text-slate-100 mb-1">{course.name}</p>
                                            <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">{course.code}</span>
                                                <span>{course.credit_hours} ساعات</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                                {planData.length === 0 && (
                                    <div className="col-span-full py-8 text-center text-slate-500 font-bold">لا يوجد مواد مقترحة.</div>
                                )}
                            </div>
                        </div>

                        {/* Feedback Form */}
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h2 className="text-lg font-[900] text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                ✍️ التقييم والملاحظات
                            </h2>
                            <form onSubmit={submitFeedback} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-[800] text-slate-700 dark:text-slate-300 mb-2">رأيك في الجدول (سيظهر للطالب)</label>
                                    <textarea
                                        value={data.feedback}
                                        onChange={e => setData('feedback', e.target.value)}
                                        rows="4"
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 font-bold text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none"
                                        placeholder="اكتب نصيحتك للطالب هنا... (مثال: الجدول متوازن، أو ينصح بتأجيل هذه المادة...)"
                                    ></textarea>
                                    {errors.feedback && <p className="text-rose-500 text-xs font-bold mt-1">{errors.feedback}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-[800] text-slate-700 dark:text-slate-300 mb-2">القرار</label>
                                    <div className="flex gap-4">
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${data.status === 'reviewed' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-[900]' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-500 dark:text-slate-400'}`}>
                                            <input type="radio" name="status" value="reviewed" checked={data.status === 'reviewed'} onChange={e => setData('status', e.target.value)} className="hidden" />
                                            ✅ اعتماد وتقييم
                                        </label>
                                        <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${data.status === 'rejected' ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 font-[900]' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-slate-500 dark:text-slate-400'}`}>
                                            <input type="radio" name="status" value="rejected" checked={data.status === 'rejected'} onChange={e => setData('status', e.target.value)} className="hidden" />
                                            ❌ مرفوض
                                        </label>
                                    </div>
                                    {errors.status && <p className="text-rose-500 text-xs font-bold mt-1">{errors.status}</p>}
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className={`w-full py-4 rounded-xl font-[900] text-white transition-all ${processing ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 active:scale-[0.98]'}`}
                                >
                                    {processing ? 'جاري الحفظ...' : 'حفظ وإرسال التقييم للطالب'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
