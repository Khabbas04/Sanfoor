import MainLayout from '@/Layouts/MainLayout';
import { Head, router } from '@inertiajs/react';

export default function PublicAnnouncements({ auth, announcements = {} }) {
    const items = announcements.data || [];
    const links = announcements.links || [];

    return (
        <MainLayout user={auth?.user}>
            <Head>
                <title>إعلانات الكادر التدريسي | سنفور</title>
                <meta name="description" content="إعلانات وتنبيهات هامة من الكادر التدريسي لطلاب منصة سنفور." />
            </Head>

            <div className="py-6 sm:py-10 min-h-screen selection:bg-teal-100 selection:text-teal-900" dir="rtl">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-8 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-400 to-emerald-500 text-white text-3xl shadow-lg shadow-teal-500/30 mb-4" style={{ animation: 'sn-float 3s ease-in-out infinite' }}>
                            📢
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-[900] text-slate-800">إعلانات الكادر التدريسي</h1>
                        <p className="text-slate-500 font-bold text-sm mt-2 max-w-md mx-auto">تابع أحدث الإعلانات والتوجيهات من دكاترة الجامعة بخصوص المواد والمحاضرات.</p>
                    </div>

                    <div className="space-y-4">
                        {items.map(ann => (
                            <div key={ann.id} className="bg-white border border-slate-100 rounded-[1.6rem] p-5 sm:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-teal-400 to-emerald-500 rounded-r-[1.6rem] opacity-70 group-hover:opacity-100 transition-opacity"></div>
                                
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <h3 className="text-base sm:text-lg font-[900] text-slate-800 leading-snug">{ann.title}</h3>
                                            {ann.course && (
                                                <span className="bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg text-[10px] font-bold text-blue-600">
                                                    {ann.course.name} ({ann.course.code})
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.body}</p>
                                    </div>
                                    <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 shrink-0 text-[11px] font-bold text-slate-400 border-t sm:border-t-0 sm:border-r border-slate-100 pt-3 sm:pt-0 sm:pr-4">
                                        <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                                            <span>👨‍🏫</span> {ann.user?.name}
                                        </div>
                                        <span>نُشر: {new Date(ann.created_at).toLocaleDateString('ar-JO')}</span>
                                        {ann.expires_at && <span className="text-rose-400">ينتهي: {new Date(ann.expires_at).toLocaleDateString('ar-JO')}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {items.length === 0 && (
                            <div className="bg-white border border-slate-100 rounded-[2rem] p-12 text-center shadow-sm">
                                <p className="text-5xl mb-4">📭</p>
                                <h3 className="text-lg font-[900] text-slate-800">لا توجد إعلانات حالياً</h3>
                                <p className="text-slate-500 font-bold text-sm mt-1">لم يقم الكادر التدريسي بنشر أي إعلانات نشطة في الوقت الحالي.</p>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {links.length > 3 && (
                        <div className="mt-8 flex items-center justify-center gap-1.5 flex-wrap">
                            {links.map((link, i) => (
                                <button key={i} disabled={!link.url} onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${link.active ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md' : link.url ? 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200' : 'text-slate-300 cursor-not-allowed border border-slate-100 bg-slate-50'}`}
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
