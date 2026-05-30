import MainLayout from '@/Layouts/MainLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Swal from 'sweetalert2';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

function useReveal(threshold = 0.12) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); }
        }, { threshold });
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);
    return [ref, visible];
}

function AnimatedCounter({ target, duration = 1400 }) {
    const [value, setValue] = useState(0);
    const [ref, isVisible] = useReveal(0.3);
    const num = typeof target === 'string' ? parseInt(target) : target;
    useEffect(() => {
        if (!isVisible || isNaN(num) || num === 0) return;
        let current = 0;
        const step = num / (duration / 16);
        const timer = setInterval(() => {
            current += step;
            if (current >= num) { setValue(num); clearInterval(timer); }
            else { setValue(Math.floor(current)); }
        }, 16);
        return () => clearInterval(timer);
    }, [isVisible, num, duration]);
    return <span ref={ref}>{value}</span>;
}

export default function InstructorDashboard({
    auth,
    stats = {},
    taught_courses = [],
    recent_announcements = [],
    all_courses = [],
}) {
    const [mounted, setMounted] = useState(false);
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [selectedCourseIds, setSelectedCourseIds] = useState(taught_courses.map(c => c.id));
    const [courseSearch, setCourseSearch] = useState('');
    const [saving, setSaving] = useState(false);
    const spring = 'cubic-bezier(0.16,1,0.3,1)';

    useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, []);

    const [statsRef, statsVis] = useReveal(0.08);
    const [quickRef, quickVis] = useReveal(0.1);
    const [coursesRef, coursesVis] = useReveal(0.1);
    const [annRef, annVis] = useReveal(0.1);

    const heroRef = useRef(null);
    const [mx, setMx] = useState(0);
    const [my, setMy] = useState(0);
    const onHeroMouse = useCallback((e) => {
        if (!heroRef.current) return;
        const rect = heroRef.current.getBoundingClientRect();
        setMx((e.clientX - rect.left - rect.width / 2) / rect.width);
        setMy((e.clientY - rect.top - rect.height / 2) / rect.height);
    }, []);
    const onHeroLeave = useCallback(() => { setMx(0); setMy(0); }, []);

    const filteredCourses = useMemo(() => {
        if (!courseSearch) return all_courses;
        const q = courseSearch.toLowerCase();
        return all_courses.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
    }, [all_courses, courseSearch]);

    const toggleCourseSelection = (id) => {
        setSelectedCourseIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const saveCourses = () => {
        setSaving(true);
        router.put(route('instructor.courses.update'), { course_ids: selectedCourseIds }, {
            preserveScroll: true,
            onSuccess: () => { setSaving(false); setShowCourseModal(false); Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تم تحديث المواد التي تدرّسها بنجاح.' }); },
            onError: () => { setSaving(false); },
        });
    };

    const statCards = [
        { label: 'إجمالي الطلاب', value: stats.total_students, icon: '👥', gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
        { label: 'المواد المتاحة', value: stats.total_courses, icon: '📚', gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
        { label: 'الشابترز', value: stats.total_chapters, icon: '📖', gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
        { label: 'بنك الأسئلة', value: stats.total_questions, icon: '❓', gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
    ];

    const quickLinks = [
        { label: 'عرض الطلاب', href: route('instructor.students'), icon: '👥', desc: 'تصفح جميع الطلاب وبياناتهم', color: 'from-blue-500 to-indigo-600' },
        { label: 'الإعلانات', href: route('instructor.announcements'), icon: '📢', desc: 'أنشئ إعلانات للطلاب', color: 'from-emerald-500 to-teal-600' },
        { label: 'المسار الشجري', href: route('tree.index'), icon: '🌳', desc: 'استعرض الشجرة الأكاديمية', color: 'from-violet-500 to-purple-600' },
        { label: 'الشابترز', href: '/chapters', icon: '📖', desc: 'تصفح جميع الملخصات', color: 'from-sky-500 to-cyan-600' },
        { label: 'بنك الأسئلة', href: '/quiz', icon: '❓', desc: 'استعرض أسئلة الكويزات', color: 'from-amber-500 to-orange-600' },
        { label: 'تحليل الطلب', href: route('instructor.reports.demand'), icon: '🔥', desc: 'توقعات وتسجيل المواد', color: 'from-rose-500 to-orange-600' },
        { label: 'AI Sanfoor', href: route('ai.advisor'), icon: '🤖', desc: 'المرشد الذكي بدون حدود', color: 'from-indigo-500 to-violet-600' },
    ];

    return (
        <MainLayout user={auth.user}>
            <Head>
                <title>لوحة الكادر التدريسي | سنفور</title>
                <meta name="description" content="لوحة تحكم الكادر التدريسي في منصة سنفور الأكاديمية." />
                <meta name="robots" content="noindex,nofollow" />
            </Head>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sn-up { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes sn-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes sn-shimmer { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
                @keyframes sn-glow { 0%, 100% { opacity: 0.12; transform: scale(1); } 50% { opacity: 0.28; transform: scale(1.06); } }
                @keyframes sn-rotate-border { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes sn-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
            ` }} />

            <div className="py-6 sm:py-8 min-h-screen selection:bg-teal-100 selection:text-teal-900" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">

                    {/* HERO CARD */}
                    <div
                        ref={heroRef}
                        onMouseMove={onHeroMouse}
                        onMouseLeave={onHeroLeave}
                        className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] text-white shadow-2xl border border-white/[0.06]"
                        style={{
                            background: 'linear-gradient(to bottom left, #064e3b, #0f172a, #1e1b4b)',
                            opacity: mounted ? 1 : 0,
                            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.985)',
                            transition: `all 1000ms ${spring}`,
                        }}
                    >
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <div className="absolute top-0 right-0 w-[70%] h-full bg-gradient-to-l from-teal-600/25 via-teal-600/8 to-transparent" />
                            <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full" style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.35) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * -22}px, ${my * -22}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)', filter: 'blur(40px)', transform: `translate(${mx * 18}px, ${my * 18}px)`, transition: `transform 800ms ${spring}` }} />
                            <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #fff 0.8px, transparent 0.8px)', backgroundSize: '18px 18px' }} />
                            <div className="absolute top-0 left-0 w-full h-[1px] overflow-hidden"><div className="w-1/3 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{ animation: 'sn-shimmer 4.5s ease-in-out infinite' }} /></div>
                        </div>

                        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                                <div className="relative group shrink-0">
                                    <div className="absolute -inset-2 rounded-[1.4rem] opacity-0 group-hover:opacity-100" style={{ background: 'linear-gradient(135deg, #14b8a6, #06b6d4)', filter: 'blur(18px)', animation: 'sn-glow 3s ease-in-out infinite', transition: 'opacity 700ms ease' }} />
                                    <div className="relative w-[78px] h-[78px] sm:w-[90px] sm:h-[90px] rounded-[1.3rem] p-[3px] overflow-hidden">
                                        <div className="absolute inset-0" style={{ background: 'conic-gradient(from 0deg, #14b8a6, #06b6d4, #2dd4bf, #14b8a6)', animation: 'sn-rotate-border 5s linear infinite' }} />
                                        <div className="relative w-full h-full bg-[#064e3b] rounded-[calc(1.3rem-3px)] flex items-center justify-center text-2xl sm:text-3xl font-[900] z-10 select-none overflow-hidden">
                                            {auth.user?.avatar ? (
                                                <img src={auth.user.avatar} alt={auth.user.name} className="w-full h-full object-cover" />
                                            ) : (
                                                auth.user?.name?.charAt(0) || 'D'
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3 flex-1 min-w-0 text-center sm:text-right">
                                    <div>
                                        <h1 className="text-[1.55rem] sm:text-[1.9rem] font-[900] tracking-tight truncate leading-tight">{auth.user?.name || 'عضو هيئة تدريس'}</h1>
                                        <p className="text-teal-300/50 text-sm mt-1 truncate">{auth.user?.email}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        <span className="bg-teal-500/20 backdrop-blur-md border border-teal-400/30 px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5" style={{ animation: mounted ? `sn-pop 0.55s ${spring} 200ms both` : 'none' }}>
                                            🎓 كادر تدريسي
                                        </span>
                                        <span className="bg-white/[0.07] backdrop-blur-md border border-white/[0.1] px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5" style={{ animation: mounted ? `sn-pop 0.55s ${spring} 320ms both` : 'none' }}>
                                            🏛️ جامعة الزرقاء
                                        </span>
                                        <span className="bg-white/[0.07] backdrop-blur-md border border-white/[0.1] px-3.5 py-[6px] rounded-[10px] text-[11px] font-bold flex items-center gap-1.5" style={{ animation: mounted ? `sn-pop 0.55s ${spring} 440ms both` : 'none' }}>
                                            📚 {stats.taught_courses_count || 0} مواد مسجلة
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* STATS GRID */}
                    <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {statCards.map((card, i) => (
                            <div key={i} className={`bg-white p-5 rounded-[1.6rem] border ${card.border} relative overflow-hidden group cursor-default hover:-translate-y-1.5 transition-all duration-500 shadow-sm`} style={{ opacity: statsVis ? 1 : 0, transform: statsVis ? undefined : 'translateY(20px)', transition: `opacity 650ms ${spring}, transform 650ms ${spring}`, transitionDelay: `${i * 100}ms` }}>
                                <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${card.bg} to-transparent rounded-bl-[3rem] -z-0 transition-transform group-hover:scale-[3] duration-[800ms] ease-out`} />
                                <div className="relative z-10">
                                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2">{card.label}</p>
                                    <h3 className="text-[1.8rem] font-[900] text-slate-800 leading-none"><AnimatedCounter target={card.value} /></h3>
                                </div>
                                <div className={`absolute top-4 left-4 w-10 h-10 rounded-xl ${card.bg} ${card.text} flex items-center justify-center text-lg ${card.border} border shrink-0`}>{card.icon}</div>
                            </div>
                        ))}
                    </div>

                    {/* QUICK LINKS */}
                    <div ref={quickRef} style={{ opacity: quickVis ? 1 : 0, transform: quickVis ? 'translateY(0)' : 'translateY(14px)', transition: `all 700ms ${spring}` }}>
                        <h2 className="text-lg font-[900] text-slate-800 mb-4 flex items-center gap-2">⚡ الوصول السريع</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            {quickLinks.map((link, i) => (
                                <Link key={i} href={link.href} className="group bg-white border border-slate-100 rounded-[1.4rem] p-4 hover:-translate-y-1.5 transition-all duration-500 shadow-sm hover:shadow-md text-center">
                                    <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-tr ${link.color} text-white flex items-center justify-center text-xl shadow-lg mb-3 group-hover:scale-110 transition-transform`} style={{ animation: 'sn-float 3.5s ease-in-out infinite' }}>
                                        {link.icon}
                                    </div>
                                    <h4 className="text-[12px] font-[800] text-slate-800 mb-0.5">{link.label}</h4>
                                    <p className="text-[10px] text-slate-400 leading-relaxed">{link.desc}</p>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* MY COURSES + ANNOUNCEMENTS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Taught Courses */}
                        <div ref={coursesRef} className="bg-white border border-slate-100 rounded-[1.6rem] shadow-sm overflow-hidden" style={{ opacity: coursesVis ? 1 : 0, transform: coursesVis ? 'translateY(0)' : 'translateY(14px)', transition: `all 700ms ${spring}` }}>
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-sm font-[900] text-slate-800 flex items-center gap-2">📚 المواد التي أدرّسها</h3>
                                <button onClick={() => setShowCourseModal(true)} className="bg-teal-50 hover:bg-teal-100 text-teal-700 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all">
                                    ✏️ تعديل
                                </button>
                            </div>
                            <div className="p-5">
                                {taught_courses.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-3xl mb-2">📭</p>
                                        <p className="text-sm text-slate-400 font-bold">لم تقم باختيار أي مادة بعد</p>
                                        <button onClick={() => setShowCourseModal(true)} className="mt-3 text-teal-600 text-xs font-black hover:underline">اختر موادك الآن</button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {taught_courses.map(c => (
                                            <div key={c.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                <div>
                                                    <p className="text-[12px] font-bold text-slate-700 line-clamp-1">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">{c.code}</p>
                                                </div>
                                                <span className="bg-teal-50 border border-teal-100 px-2 py-0.5 rounded text-[10px] font-bold text-teal-600 shrink-0">{c.credit_hours} س</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Announcements */}
                        <div ref={annRef} className="bg-white border border-slate-100 rounded-[1.6rem] shadow-sm overflow-hidden" style={{ opacity: annVis ? 1 : 0, transform: annVis ? 'translateY(0)' : 'translateY(14px)', transition: `all 700ms ${spring} 100ms` }}>
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-sm font-[900] text-slate-800 flex items-center gap-2">📢 آخر إعلاناتي</h3>
                                <Link href={route('instructor.announcements')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all">
                                    عرض الكل
                                </Link>
                            </div>
                            <div className="p-5">
                                {recent_announcements.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-3xl mb-2">📭</p>
                                        <p className="text-sm text-slate-400 font-bold">لا توجد إعلانات بعد</p>
                                        <Link href={route('instructor.announcements')} className="mt-3 inline-block text-emerald-600 text-xs font-black hover:underline">أنشئ إعلانك الأول</Link>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {recent_announcements.map(ann => (
                                            <div key={ann.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-bold text-slate-700 line-clamp-1">{ann.title}</p>
                                                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{ann.body}</p>
                                                    </div>
                                                    {ann.course && <span className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded text-[9px] font-bold text-blue-600 shrink-0">{ann.course.code}</span>}
                                                </div>
                                                <p className="text-[9px] text-slate-300 mt-2 font-bold">{new Date(ann.created_at).toLocaleDateString('ar-JO')}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Course Selection Modal */}
            {showCourseModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCourseModal(false)} />
                    <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden border border-slate-100">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-base font-[900] text-slate-800">📚 اختر المواد التي تدرّسها</h3>
                            <input
                                type="text"
                                value={courseSearch}
                                onChange={e => setCourseSearch(e.target.value)}
                                placeholder="ابحث بالاسم أو الرمز..."
                                className="mt-3 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-teal-500 focus:border-teal-500"
                            />
                            <p className="text-[10px] text-slate-400 font-bold mt-2">{selectedCourseIds.length} مادة مختارة</p>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-1.5" dir="rtl">
                            {filteredCourses.map(c => {
                                const isSelected = selectedCourseIds.includes(c.id);
                                return (
                                    <button key={c.id} onClick={() => toggleCourseSelection(c.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all text-sm ${isSelected ? 'bg-teal-50 border-2 border-teal-400 font-bold' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}>
                                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300'}`}>
                                            {isSelected && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-700 line-clamp-1">{c.name}</p>
                                            <p className="text-[10px] text-slate-400">{c.code}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-4 border-t border-slate-100 flex items-center gap-3">
                            <button onClick={saveCourses} disabled={saving} className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-600 text-white py-3 rounded-xl font-black text-sm shadow-lg shadow-teal-500/30 hover:opacity-90 transition-all disabled:opacity-50">
                                {saving ? 'جاري الحفظ...' : '💾 حفظ التغييرات'}
                            </button>
                            <button onClick={() => setShowCourseModal(false)} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
