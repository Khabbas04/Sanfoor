import React, { useState, useMemo, useEffect, useRef } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   SMART DATA (تم إضافة الخدمات ورابط الخرائط)
   ═══════════════════════════════════════════════════════════════ */
const BUILDINGS_DATA = [
    {
        id: 1, symbol: "أ، ب", name: "مبنى الفاروق",
        faculties: ["كلية الشريعة", "كلية الآداب", "كلية تكنولوجيا المعلومات", "كلية العلوم التربوية"],
        services: ["مختبرات حاسوب", "كافتيريا", "مصلى"], mapUrl: "https://maps.google.com"
    },
    {
        id: 2, symbol: "ت", name: "العلوم الطبية المساندة",
        faculties: ["كلية العلوم الطبية المساندة", "الكلية الزرقاء التقنية"],
        services: ["مختبرات طبية", "مصلى"], mapUrl: "https://maps.google.com"
    },
    {
        id: 3, symbol: "د، هـ", name: "مبنى الخوارزمي",
        faculties: ["التمريض", "الصيدلة", "العلوم"],
        services: ["كافتيريا", "مصلى", "مختبرات علمية"], mapUrl: "https://maps.google.com"
    },
    {
        id: 4, symbol: "ل", name: "مبنى (ل)",
        faculties: ["كلية الهندسة التكنولوجية", "كلية الفنون والتصميم"],
        services: ["مراسم", "مشاغل هندسية"], mapUrl: "https://maps.google.com"
    },
    {
        id: 5, symbol: "ص", name: "مبنى (ص)",
        faculties: ["كلية الصحافة والإعلام", "كلية الحقوق"],
        services: ["استوديوهات", "مكتبة فرعية"], mapUrl: "https://maps.google.com"
    },
    {
        id: 6, symbol: "ق", name: "الشهيد معاذ الكساسبة",
        faculties: ["كلية الاقتصاد والعلوم الإدارية", "كلية الدراسات العليا"],
        services: ["كافتيريا", "قاعات تدريب"], mapUrl: "https://maps.google.com"
    },
    {
        id: 7, symbol: "ط", name: "مبنى (ط)",
        faculties: ["كلية طب الأسنان"],
        services: ["عيادات أسنان", "مصلى"], mapUrl: "https://maps.google.com"
    }
];

const QUICK_FILTERS = ["الكل", "كافتيريا", "مصلى", "مختبرات", "عيادات"];

export default function Directory({ auth }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState("الكل");

    const [headerRef, headerVis] = useReveal(0.1);
    const [gridRef, gridVis] = useReveal(0.1);
    const spring = 'cubic-bezier(0.16,1,0.3,1)';

    // 🧠 فلترة ذكية: تجمع بين البحث النصي وأزرار الفلترة السريعة
    const filteredBuildings = useMemo(() => {
        return BUILDINGS_DATA.filter(b => {
            const searchLower = searchTerm.toLowerCase().trim();
            const matchesSearch = !searchLower ||
                b.symbol.toLowerCase().includes(searchLower) ||
                b.name.toLowerCase().includes(searchLower) ||
                b.faculties.some(f => f.toLowerCase().includes(searchLower));

            const matchesFilter = activeFilter === "الكل" ||
                b.services.some(s => s.includes(activeFilter)) ||
                b.faculties.some(f => f.includes(activeFilter));

            return matchesSearch && matchesFilter;
        });
    }, [searchTerm, activeFilter]);

    // دالة مساعدة للتحقق إذا كان المبنى يخص تخصص الطالب
    const isStudentBuilding = (buildingFaculties) => {
        if (!auth?.user?.major?.name) return false;
        // افتراض أن اسم التخصص يحتوي على كلمة مفتاحية تشبه اسم الكلية
        return buildingFaculties.some(faculty =>
            faculty.includes(auth.user.major.name.split(' ')[0]) ||
            auth.user.major.name.includes(faculty.replace('كلية ', ''))
        );
    };

    return (
        <MainLayout user={auth?.user}>
            <Head>
                <title>دليل المباني الذكي | سنفور</title>
                <meta name="description" content="دليل مباني الجامعة داخل سنفور للبحث عن الكليات والخدمات الأكاديمية بسرعة وسهولة." />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/campus-directory`} />
            </Head>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes sn-up { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes sn-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
                @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); } 50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); } }
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />

            <div className="py-6 sm:py-8 min-h-screen selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-7">

                    {/* 1. الترويسة والبحث (Hero Section) */}
                    <div
                        ref={headerRef}
                        className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden relative"
                        style={{
                            opacity: headerVis ? 1 : 0,
                            transform: headerVis ? 'translateY(0)' : 'translateY(20px)',
                            transition: `all 800ms ${spring}`
                        }}
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-50/80 to-transparent rounded-bl-[6rem] -z-0 pointer-events-none" />

                        <div className="relative z-10 p-8 sm:p-10 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm border border-indigo-100" style={{ animation: headerVis ? `sn-pop 0.6s ${spring} 200ms both` : 'none' }}>
                                🧭
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">المرشد المكاني الذكي</h1>
                            <p className="text-sm font-bold text-slate-400 mb-8 max-w-lg">ابحث عن كليتك، اسم المبنى، أو ابحث عن الخدمات مثل "مصلى" أو "كافتيريا".</p>

                            <div className="w-full max-w-xl relative mb-5">
                                <span className="absolute inset-y-0 right-4 flex items-center text-xl opacity-50">🔍</span>
                                <input
                                    type="text"
                                    placeholder="ما الذي تبحث عنه؟ (مثال: هندسة، ل، مصلى)..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pr-12 pl-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-slate-400 shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setActiveFilter("الكل"); }}
                                />
                            </div>

                            {/* أزرار الفلترة السريعة */}
                            <div className="flex flex-wrap justify-center gap-2">
                                {QUICK_FILTERS.map(filter => (
                                    <button
                                        key={filter}
                                        onClick={() => { setActiveFilter(filter); setSearchTerm(''); }}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all duration-300 ${activeFilter === filter ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200'}`}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. صندوق معلومات القاعات */}
                    <div
                        className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-[1.5rem] border border-blue-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                        style={{ opacity: headerVis ? 1 : 0, transform: headerVis ? 'translateY(0)' : 'translateY(20px)', transition: `all 800ms ${spring} 150ms` }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">💡</span>
                            <div>
                                <h3 className="text-sm font-black text-blue-900">كيف تقرأ أرقام القاعات؟</h3>
                                <p className="text-[11px] font-bold text-blue-700/70 mt-0.5">الرقم الأول يدل على الطابق داخل المبنى (مثال: قاعة 204 في الطابق الثاني)</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="bg-white/80 text-blue-800 text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm border border-blue-100/50">100 (طابق 1)</span>
                            <span className="bg-white/80 text-blue-800 text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm border border-blue-100/50">200 (طابق 2)</span>
                            <span className="bg-white/80 text-blue-800 text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm border border-blue-100/50">300 (طابق 3)</span>
                        </div>
                    </div>

                    {/* 3. شبكة المباني الذكية */}
                    <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredBuildings.length > 0 ? filteredBuildings.map((building, idx) => {
                            const isMine = isStudentBuilding(building.faculties);
                            return (
                                <div
                                    key={building.id}
                                    className={`bg-white p-6 rounded-[2rem] border shadow-sm transition-all duration-300 group flex flex-col h-full relative overflow-hidden ${isMine ? 'border-indigo-400 shadow-indigo-100 hover:shadow-lg hover:-translate-y-1' : 'border-slate-100 hover:shadow-md hover:border-indigo-200 hover:-translate-y-1'}`}
                                    style={{
                                        opacity: gridVis ? 1 : 0,
                                        animation: gridVis ? `sn-up 0.5s ${spring} ${idx * 60 + 200}ms both` : 'none'
                                    }}
                                >
                                    {/* تأثير الإضاءة لمبنى التخصص */}
                                    {isMine && <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none" />}

                                    <div className="flex justify-between items-start mb-5 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className={`text-white font-black text-lg px-4 py-2 rounded-xl shadow-md ${isMine ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-slate-800'}`}>
                                                {building.symbol}
                                            </div>
                                            {isMine && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100" style={{ animation: 'pulse-glow 2s infinite' }}>🌟 مبنى كليتك</span>}
                                        </div>
                                    </div>

                                    <h2 className="text-lg font-black text-slate-800 mb-4 group-hover:text-indigo-900 transition-colors relative z-10">{building.name}</h2>

                                    <div className="flex-1 space-y-4 relative z-10">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><span>🎓</span> الكليات المتواجدة:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {building.faculties.map((faculty, index) => (
                                                    <span key={index} className="bg-slate-50 text-slate-600 border border-slate-200/60 text-[11px] font-bold px-2.5 py-1.5 rounded-lg group-hover:border-indigo-100 transition-colors">
                                                        {faculty}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {building.services && (
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><span>✨</span> الخدمات المتاحة:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {building.services.map((service, index) => (
                                                        <span key={index} className="text-indigo-600/70 text-[10px] font-bold px-2 py-1 rounded bg-indigo-50/50">
                                                            {service}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* زر الاتجاهات (Action Button) */}
                                    <a
                                        href={building.mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-5 w-full bg-slate-50 hover:bg-indigo-600 text-slate-600 hover:text-white border border-slate-100 hover:border-indigo-600 text-sm font-black py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group/btn relative z-10 active:scale-[0.98]"
                                    >
                                        <span>📍</span> أين يقع المبنى؟
                                        <svg className="w-4 h-4 opacity-0 -ml-4 group-hover/btn:opacity-100 group-hover/btn:ml-0 transition-all duration-300 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                                    </a>
                                </div>
                            );
                        }) : (
                            <div className="col-span-full bg-white rounded-[2rem] border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                                <span className="text-5xl mb-4 opacity-50">🧭</span>
                                <h3 className="text-lg font-black text-slate-700 mb-2">لم نجد ما تبحث عنه</h3>
                                <p className="text-slate-400 text-sm">جرب البحث بكلمات أخرى أو استخدم أزرار الفلترة السريعة بالأعلى.</p>
                                <button onClick={() => { setSearchTerm(''); setActiveFilter('الكل'); }} className="mt-4 text-indigo-600 text-sm font-black bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">عرض جميع المباني</button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}