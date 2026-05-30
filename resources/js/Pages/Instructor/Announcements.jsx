import MainLayout from '@/Layouts/MainLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import Swal from 'sweetalert2';

export default function InstructorAnnouncements({ auth, announcements = {}, taught_courses = [] }) {
    const [showForm, setShowForm] = useState(false);
    const { data, setData, post, processing, reset, errors } = useForm({
        title: '',
        body: '',
        course_id: '',
        expires_at: '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('instructor.announcements.store'), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowForm(false);
                Swal.fire({ icon: 'success', title: 'تم النشر', text: 'تم نشر الإعلان بنجاح.' });
            },
        });
    };

    const handleDelete = (id) => {
        Swal.fire({
            icon: 'warning', title: 'حذف الإعلان', text: 'هل أنت متأكد من حذف هذا الإعلان؟',
            showCancelButton: true, confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء', confirmButtonColor: '#e11d48',
        }).then(res => {
            if (!res.isConfirmed) return;
            router.delete(route('instructor.announcements.destroy', id), { preserveScroll: true });
        });
    };

    const items = announcements.data || [];
    const links = announcements.links || [];

    return (
        <MainLayout user={auth.user}>
            <Head>
                <title>إعلاناتي | الكادر التدريسي | سنفور</title>
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            <div className="py-6 sm:py-8 min-h-screen" dir="rtl">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-[900] text-slate-800">📢 إعلاناتي</h1>
                            <p className="text-slate-500 font-bold text-sm mt-1">أنشئ إعلانات تظهر لجميع الطلاب في صفحة الإعلانات</p>
                        </div>
                        <button onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-teal-500/30 hover:opacity-90 transition-all active:scale-95 shrink-0">
                            {showForm ? '✕ إلغاء' : '✨ إعلان جديد'}
                        </button>
                    </div>

                    {/* Create Form */}
                    {showForm && (
                        <div className="bg-white border border-slate-100 rounded-[1.6rem] p-6 shadow-sm mb-6" style={{ animation: 'fadeIn 0.3s ease' }}>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[12px] font-black text-slate-600 mb-1.5">عنوان الإعلان *</label>
                                    <input type="text" value={data.title} onChange={e => setData('title', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500" placeholder="مثال: تغيير موعد محاضرة..." required />
                                    {errors.title && <p className="text-rose-500 text-[11px] font-bold mt-1">{errors.title}</p>}
                                </div>
                                <div>
                                    <label className="block text-[12px] font-black text-slate-600 mb-1.5">تفاصيل الإعلان *</label>
                                    <textarea value={data.body} onChange={e => setData('body', e.target.value)} rows={4} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500 resize-none" placeholder="اكتب تفاصيل الإعلان هنا..." required />
                                    {errors.body && <p className="text-rose-500 text-[11px] font-bold mt-1">{errors.body}</p>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[12px] font-black text-slate-600 mb-1.5">ربط بمادة (اختياري)</label>
                                        <select value={data.course_id} onChange={e => setData('course_id', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500">
                                            <option value="">إعلان عام (بدون مادة)</option>
                                            {taught_courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[12px] font-black text-slate-600 mb-1.5">تاريخ الانتهاء (اختياري)</label>
                                        <input type="datetime-local" value={data.expires_at} onChange={e => setData('expires_at', e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-teal-500 focus:border-teal-500" />
                                    </div>
                                </div>
                                <button type="submit" disabled={processing} className="bg-gradient-to-r from-teal-500 to-emerald-600 text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg shadow-teal-500/30 hover:opacity-90 transition-all disabled:opacity-50">
                                    {processing ? 'جاري النشر...' : '📢 نشر الإعلان'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Announcements List */}
                    <div className="space-y-3">
                        {items.map(ann => (
                            <div key={ann.id} className="bg-white border border-slate-100 rounded-[1.4rem] p-5 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <h3 className="text-[14px] font-[900] text-slate-800">{ann.title}</h3>
                                            {ann.course && <span className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg text-[9px] font-bold text-blue-600">{ann.course.name}</span>}
                                            {ann.is_active ? (
                                                <span className="bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg text-[9px] font-bold text-emerald-600">نشط</span>
                                            ) : (
                                                <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[9px] font-bold text-slate-400">منتهي</span>
                                            )}
                                        </div>
                                        <p className="text-[12px] text-slate-500 leading-relaxed">{ann.body}</p>
                                        <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-400 font-bold">
                                            <span>📅 {new Date(ann.created_at).toLocaleDateString('ar-JO')}</span>
                                            {ann.expires_at && <span>⏰ ينتهي: {new Date(ann.expires_at).toLocaleDateString('ar-JO')}</span>}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(ann.id)} className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2 rounded-xl transition-all shrink-0" title="حذف">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="bg-white border border-slate-100 rounded-[1.6rem] p-12 text-center shadow-sm">
                                <p className="text-4xl mb-3">📭</p>
                                <p className="text-slate-400 font-bold text-sm">لم تقم بنشر أي إعلان بعد</p>
                                <button onClick={() => setShowForm(true)} className="mt-4 text-teal-600 font-black text-sm hover:underline">أنشئ إعلانك الأول ✨</button>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {links.length > 3 && (
                        <div className="mt-6 flex items-center justify-center gap-1 flex-wrap">
                            {links.map((link, i) => (
                                <button key={i} disabled={!link.url} onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${link.active ? 'bg-teal-600 text-white' : link.url ? 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100' : 'text-slate-300 cursor-not-allowed'}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
