import React, { useState, useMemo, useEffect, useRef } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');
const LANDMARK_TYPES = {
    all: { label: 'الكل', icon: '🧭' },
    restaurant: { label: 'مطاعم', icon: '🍽️' },
    prayer_room: { label: 'مصليات', icon: '🕌' },
    library: { label: 'مكتبات', icon: '📚' },
    clinic: { label: 'عيادات', icon: '🏥' },
    parking: { label: 'مواقف', icon: '🅿️' },
    sports: { label: 'رياضة', icon: '⚽' },
    shop: { label: 'محلات', icon: '🏪' },
    other: { label: 'أخرى', icon: '📍' },
};

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

export default function Directory({ auth, colleges = [], landmarks = [] }) {
    const [collegeSearch, setCollegeSearch] = useState('');
    const [landmarkSearch, setLandmarkSearch] = useState('');
    const [activeTab, setActiveTab] = useState(null);
    const [landmarkType, setLandmarkType] = useState('all');

    const [headerRef, headerVis] = useReveal(0.1);
    const [gridRef, gridVis] = useReveal(0.1);
    const spring = 'cubic-bezier(0.16,1,0.3,1)';

    // 🧠 Smart filtering for colleges
    const filteredColleges = useMemo(() => {
        return colleges.filter(college => {
            const searchLower = collegeSearch.toLowerCase().trim();
            if (!searchLower) return true;
            return (
                college.name.toLowerCase().includes(searchLower) ||
                college.building_location?.toLowerCase().includes(searchLower) ||
                college.description?.toLowerCase().includes(searchLower) ||
                college.building_symbol?.toLowerCase().includes(searchLower)
            );
        });
    }, [collegeSearch, colleges]);

    // Set first college as active on load
    useEffect(() => {
        if (activeTab === null && filteredColleges.length > 0) {
            setActiveTab(filteredColleges[0].id);
        }
    }, [filteredColleges, activeTab]);

    const activeCollege = filteredColleges.find(c => c.id === activeTab);

    const filteredLandmarks = useMemo(() => {
        const searchLower = landmarkSearch.toLowerCase().trim();
        return landmarks.filter((landmark) => {
            const matchesType = landmarkType === 'all' || landmark.type === landmarkType;
            if (!searchLower) return matchesType;

            const matchesSearch =
                landmark.name.toLowerCase().includes(searchLower) ||
                landmark.building_location?.toLowerCase().includes(searchLower) ||
                landmark.description?.toLowerCase().includes(searchLower);

            return matchesType && matchesSearch;
        });
    }, [landmarks, landmarkType, landmarkSearch]);

    // Helper to check if college belongs to student's major
    const isStudentCollege = (collegeId) => {
        if (!auth?.user?.major?.college_id) return false;
        return auth.user.major.college_id === collegeId;
    };

    return (
        <MainLayout user={auth?.user}>
            <Head>
                <title>دليل الكليات | سنفور</title>
                <meta name="description" content="تعرف على كليات الجامعة وتفاصيلها الكاملة وأماكن تواجدها والخدمات المتاحة بها." />
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

                    {/* 1. Hero Section with Search */}
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
                                🏛️
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mb-2">دليل الكليات الشامل</h1>
                            <p className="text-sm font-bold text-slate-400 mb-8 max-w-lg">تصفح جميع كليات الجامعة واطلع على تفاصيلها الكاملة والخدمات المتاحة بكل كلية.</p>

                            <div className="w-full max-w-xl relative mb-5">
                                <span className="absolute inset-y-0 right-4 flex items-center text-xl opacity-50">🔍</span>
                                <input
                                    type="text"
                                    placeholder="ابحث عن كلية (مثال: هندسة، تكنولوجيا)..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pr-12 pl-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-slate-400 shadow-sm"
                                    value={collegeSearch}
                                    onChange={(e) => setCollegeSearch(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <p className="text-[11px] text-slate-500 font-black">عدد الكليات</p>
                                    <p className="text-xl text-slate-900 font-black mt-1">{colleges.length}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <p className="text-[11px] text-slate-500 font-black">المعالم النشطة</p>
                                    <p className="text-xl text-slate-900 font-black mt-1">{landmarks.length}</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                    <p className="text-[11px] text-slate-500 font-black">نتائج بحث الكليات</p>
                                    <p className="text-xl text-slate-900 font-black mt-1">{filteredColleges.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Tabs for Colleges */}
                    <div
                        className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-5 overflow-hidden"
                        style={{ opacity: headerVis ? 1 : 0, transform: headerVis ? 'translateY(0)' : 'translateY(20px)', transition: `all 800ms ${spring} 150ms` }}
                    >
                        <div className="overflow-x-auto hide-scrollbar">
                            <div className="flex gap-2 flex-nowrap pb-2">
                                {filteredColleges.map(college => {
                                    const isMine = isStudentCollege(college.id);
                                    const isActive = activeTab === college.id;
                                    return (
                                        <button
                                            key={college.id}
                                            onClick={() => setActiveTab(college.id)}
                                            className={`px-5 py-3 rounded-xl text-sm font-black whitespace-nowrap transition-all duration-300 flex items-center gap-2 flex-shrink-0 ${
                                                isActive
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:border-indigo-300'
                                            }`}
                                        >
                                            {isMine && <span style={{ animation: 'pulse-glow 2s infinite' }}>🌟</span>}
                                            {college.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 3. College Details Card */}
                    {activeCollege ? (
                        <div
                            ref={gridRef}
                            className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden"
                            style={{
                                opacity: gridVis ? 1 : 0,
                                animation: gridVis ? `sn-up 0.5s ${spring} 200ms both` : 'none'
                            }}
                        >
                            {/* Header with Image */}
                            {activeCollege.image_url && (
                                <div className="h-48 sm:h-64 bg-slate-200 overflow-hidden relative">
                                    <img
                                        src={activeCollege.image_url}
                                        alt={activeCollege.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            )}

                            <div className="p-8 sm:p-10 space-y-8">
                                {/* Title and Basic Info */}
                                <div>
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800">{activeCollege.name}</h2>
                                        {activeCollege.building_symbol && (
                                            <span className="bg-indigo-600 text-white font-black text-lg px-4 py-2 rounded-xl shadow-md flex-shrink-0">
                                                {activeCollege.building_symbol}
                                            </span>
                                        )}
                                    </div>

                                    {activeCollege.university?.name && (
                                        <p className="text-sm font-bold text-slate-400 flex items-center gap-1">
                                            <span>🏢</span> تابعة لـ: {activeCollege.university.name}
                                        </p>
                                    )}
                                </div>

                                {/* Description */}
                                {activeCollege.description && (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                                        <p className="text-slate-700 font-bold leading-relaxed">{activeCollege.description}</p>
                                    </div>
                                )}

                                {/* Location Info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {activeCollege.building_location && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                            <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                📍 مكان المبنى
                                            </h3>
                                            <p className="text-slate-800 font-bold">{activeCollege.building_location}</p>
                                            {activeCollege.maps_url && (
                                                <a
                                                    href={activeCollege.maps_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-3 text-indigo-600 text-sm font-black hover:underline flex items-center gap-1"
                                                >
                                                    🗺️ فتح على الخريطة
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {(activeCollege.location_latitude || activeCollege.location_longitude) && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                            <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                🧭 الإحداثيات
                                            </h3>
                                            <p className="text-slate-800 font-bold text-sm">
                                                {activeCollege.location_latitude && `العرض: ${activeCollege.location_latitude}`}
                                                {activeCollege.location_latitude && activeCollege.location_longitude && <br />}
                                                {activeCollege.location_longitude && `الطول: ${activeCollege.location_longitude}`}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Services */}
                                {activeCollege.services && Array.isArray(activeCollege.services) && activeCollege.services.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-black text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            ✨ الخدمات المتاحة
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {activeCollege.services.map((service, index) => (
                                                <span key={index} className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold px-4 py-2 rounded-lg text-sm">
                                                    {service}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="col-span-full bg-white rounded-[2rem] border border-slate-100 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                            <span className="text-5xl mb-4 opacity-50">🏛️</span>
                            <h3 className="text-lg font-black text-slate-700 mb-2">لم نجد ما تبحث عنه</h3>
                            <p className="text-slate-400 text-sm">ليس هناك كليات في الداتابيس حاليًا.</p>
                            <button onClick={() => setCollegeSearch('')} className="mt-4 text-indigo-600 text-sm font-black bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-colors">
                                إعادة تعيين البحث
                            </button>
                        </div>
                    )}

                    {/* 4. Campus Landmarks */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 sm:p-8 space-y-5">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <h3 className="text-xl sm:text-2xl font-black text-slate-800">معالم الجامعة</h3>
                            <span className="text-xs font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                                {filteredLandmarks.length} معلم
                            </span>
                        </div>

                        <div className="w-full relative">
                            <span className="absolute inset-y-0 right-4 flex items-center text-xl opacity-50">🔎</span>
                            <input
                                type="text"
                                placeholder="ابحث عن معلم (مطعم، مصلى، مكتبة...)"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pr-12 pl-4 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all placeholder:text-slate-400"
                                value={landmarkSearch}
                                onChange={(e) => setLandmarkSearch(e.target.value)}
                            />
                        </div>

                        <div className="overflow-x-auto hide-scrollbar">
                            <div className="flex gap-2 flex-nowrap pb-2">
                                {Object.entries(LANDMARK_TYPES).map(([key, info]) => {
                                    const isActive = landmarkType === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setLandmarkType(key)}
                                            className={`px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap transition-all duration-300 flex items-center gap-2 border ${
                                                isActive
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{info.icon}</span>
                                            <span>{info.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {filteredLandmarks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredLandmarks.map((landmark) => {
                                    const typeInfo = LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other;
                                    return (
                                        <div
                                            key={landmark.id}
                                            className="rounded-2xl border border-slate-200 bg-slate-50/70 overflow-hidden hover:shadow-md transition-shadow"
                                        >
                                            {landmark.image_url && (
                                                <img
                                                    src={landmark.image_url}
                                                    alt={landmark.name}
                                                    className="w-full h-32 object-cover"
                                                />
                                            )}
                                            <div className="p-5 space-y-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <h4 className="text-base font-black text-slate-800">{landmark.name}</h4>
                                                    <span className="text-xs font-black bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg">
                                                        {typeInfo.icon} {typeInfo.label}
                                                    </span>
                                                </div>

                                                {landmark.description && (
                                                    <p className="text-sm text-slate-600 font-bold leading-relaxed line-clamp-3">
                                                        {landmark.description}
                                                    </p>
                                                )}

                                                {landmark.building_location && (
                                                    <p className="text-sm font-bold text-slate-700">📍 {landmark.building_location}</p>
                                                )}

                                                {(landmark.location_latitude || landmark.location_longitude) && (
                                                    <p className="text-xs text-slate-500 font-bold">
                                                        {landmark.location_latitude && `العرض: ${landmark.location_latitude}`}
                                                        {landmark.location_latitude && landmark.location_longitude ? ' | ' : ''}
                                                        {landmark.location_longitude && `الطول: ${landmark.location_longitude}`}
                                                    </p>
                                                )}

                                                {landmark.maps_url && (
                                                    <a
                                                        href={landmark.maps_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm font-black text-emerald-700 hover:underline"
                                                    >
                                                        🗺️ فتح على الخريطة
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                                <p className="text-slate-500 font-bold">لا يوجد معالم مطابقة للفلاتر الحالية.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </MainLayout>
    );
}