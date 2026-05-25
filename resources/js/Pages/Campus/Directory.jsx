import React, { useMemo, useState } from 'react';
import MainLayout from '@/Layouts/MainLayout';
import { Head } from '@inertiajs/react';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

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

const OFFICIAL_BUILDING_GUIDE = [
    {
        symbol: 'أ.ب',
        building: 'مبنى الفاروق',
        colleges: ['كلية الشريعة', 'كلية الآداب', 'كلية تكنولوجيا المعلومات', 'كلية العلوم التربوية'],
    },
    {
        symbol: 'ت',
        building: 'كلية العلوم الطبية المساندة / الكلية الزرقاء التقنية',
        colleges: ['كلية العلوم الطبية المساندة', 'الكلية الزرقاء التقنية'],
    },
    {
        symbol: 'د.ه',
        building: 'الخوارزمي',
        colleges: ['كلية التمريض', 'كلية الصيدلة', 'كلية العلوم'],
    },
    {
        symbol: 'ل',
        building: 'مبنى الكليات التالية',
        colleges: ['كلية الهندسة التكنولوجية', 'كلية الفنون والتصميم'],
    },
    {
        symbol: 'ص',
        building: 'مبنى الكليات التالية',
        colleges: ['كلية الصحافة والإعلام', 'كلية الحقوق'],
    },
    {
        symbol: 'ق',
        building: 'مبنى الشهيد معاذ الكساسبة',
        colleges: ['كلية الاقتصاد والعلوم الإدارية', 'كلية الدراسات العليا'],
    },
    {
        symbol: 'ط',
        building: 'كلية طب الأسنان',
        colleges: [],
    },
];

const OFFICIAL_FLOOR_LEGEND = ['100 = الطابق الأول', '200 = الطابق الثاني', '300 = الطابق الثالث'];
const SHOW_COLLEGES_BY_BUILDING = false;
const SHOW_LANDMARKS_SECTION = false;

export default function Directory({ auth, colleges = [], landmarks = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const [collegeSearch, setCollegeSearch] = useState('');
    const [landmarkSearch, setLandmarkSearch] = useState('');
    const [landmarkType, setLandmarkType] = useState('all');

    const filteredColleges = useMemo(() => {
        const search = collegeSearch.toLowerCase().trim();

        return colleges.filter((college) => {
            if (!search) return true;

            return (
                college.name.toLowerCase().includes(search) ||
                college.description?.toLowerCase().includes(search) ||
                college.building_location?.toLowerCase().includes(search) ||
                college.building_symbol?.toLowerCase().includes(search)
            );
        });
    }, [colleges, collegeSearch]);

    const filteredLandmarks = useMemo(() => {
        const search = landmarkSearch.toLowerCase().trim();

        return landmarks.filter((landmark) => {
            const matchesType = landmarkType === 'all' || landmark.type === landmarkType;
            if (!matchesType) return false;
            if (!search) return true;

            return (
                landmark.name.toLowerCase().includes(search) ||
                landmark.description?.toLowerCase().includes(search) ||
                landmark.building_location?.toLowerCase().includes(search)
            );
        });
    }, [landmarks, landmarkSearch, landmarkType]);

    const myCollegeId = auth?.user?.major?.college_id;
    const groupedBuildings = useMemo(() => {
        const map = new Map();

        filteredColleges.forEach((college) => {
            const symbol = (college.building_symbol || 'غير محدد').trim() || 'غير محدد';
            const key = `${symbol}::${college.building_location || 'غير محدد'}`;

            if (!map.has(key)) {
                map.set(key, {
                    symbol,
                    location: college.building_location || 'غير محدد',
                    colleges: [],
                });
            }

            map.get(key).colleges.push(college);
        });

        return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol, 'ar'));
    }, [filteredColleges]);

    return (
        <MainLayout user={auth?.user}>
            <Head>
                <title>دليل المباني والكليات | سنفور</title>
                <meta
                    name="description"
                    content="دليل مبسط للكليات ومعالم الجامعة مع مواقعها وخدماتها وروابط الخرائط."
                />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <link rel="canonical" href={`${siteUrl}/campus-directory`} />
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes directoryFadeUp {
                        from { opacity: 0; transform: translateY(14px) scale(0.985); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .directory-card-reveal {
                        opacity: 0;
                        animation: directoryFadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }
                ` }} />
            </Head>

            <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_28%),radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_22%),linear-gradient(180deg,#f8fbff_0%,#ffffff_48%,#f4f7fb_100%)] py-8 sm:py-10" dir="rtl">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
                    <section className="relative py-10 sm:py-16 mb-10 overflow-hidden flex justify-center">
                        <div className="relative flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 w-fit mx-auto px-4">
                            <div className="relative z-10 text-center md:text-start shrink-0">
                                <h1 className={`text-4xl sm:text-5xl md:text-6xl font-[900] mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>دليل المباني والكليات</h1>
                                <p className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>دليل مبسط للكليات ومعالم الجامعة</p>
                            </div>
                            <div className={`hidden md:block w-1 h-20 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-200/80'}`}></div>
                            <div className="pointer-events-none select-none z-0 shrink-0 text-center md:text-end">
                                <span className={`text-[4.5rem] sm:text-[5.5rem] md:text-[7rem] font-black tracking-tighter whitespace-nowrap leading-none inline-block ${isDark ? 'text-white/[0.04]' : 'text-slate-900/[0.05]'}`}>
                                    CAMPUS
                                </span>
                            </div>
                        </div>
                    </section>

                    {OFFICIAL_BUILDING_GUIDE.length > 0 && (
                        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl space-y-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-950">المرجع الرسمي لرموز المباني</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                {OFFICIAL_BUILDING_GUIDE.map((entry, idx) => (
                                    <article
                                        key={entry.symbol}
                                        className="directory-card-reveal rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                                        style={{ animationDelay: `${idx * 70}ms` }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-[52px] h-[52px] rounded-2xl bg-gradient-to-br from-slate-950 to-slate-700 text-white flex items-center justify-center text-xl font-black shadow-sm">
                                                {entry.symbol}
                                            </div>
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <p className="text-sm font-black text-slate-900">{entry.building}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {entry.colleges.length > 0 ? (
                                                        entry.colleges.map((college) => (
                                                            <span
                                                                key={college}
                                                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                                                            >
                                                                {college}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                            كلية طب الأسنان
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div className="directory-card-reveal rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 sm:p-5" style={{ animationDelay: `${OFFICIAL_BUILDING_GUIDE.length * 70}ms` }}>
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <p className="text-sm font-black text-slate-900">ترميز الطوابق</p>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2.5">
                                    {OFFICIAL_FLOOR_LEGEND.map((floor) => (
                                        <span key={floor} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
                                            {floor}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </section>
                    )}

                    {SHOW_COLLEGES_BY_BUILDING && (
                        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl space-y-5">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-950">الكليات حسب المبنى</h2>
                            </div>

                            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-4">
                                <div className="relative">
                                    <span className="absolute inset-y-0 right-4 flex items-center text-lg opacity-60">🔍</span>
                                    <input
                                        type="text"
                                        value={collegeSearch}
                                        onChange={(e) => setCollegeSearch(e.target.value)}
                                        placeholder="ابحث عن كلية أو موقع"
                                        className="w-full rounded-2xl border border-transparent bg-white py-3.5 pr-11 pl-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                                    />
                                </div>

                                {groupedBuildings.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {groupedBuildings.map((group) => (
                                            <article
                                                key={`${group.symbol}-${group.location}`}
                                                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                            >
                                                <div className="h-1.5 bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500" />
                                                <div className="p-5 sm:p-6 space-y-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="min-w-[56px] h-[56px] rounded-2xl bg-slate-950 text-white flex items-center justify-center text-xl font-black shadow-sm">
                                                            {group.symbol}
                                                        </div>
                                                        <div className="min-w-0 flex-1 space-y-1">
                                                            <h3 className="text-lg font-black text-slate-950">{group.location}</h3>
                                                            <p className="text-sm text-slate-500 font-medium">{group.colleges.length} كلية داخل هذا المبنى</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {group.colleges.map((college) => {
                                                            const isMyCollege = myCollegeId === college.id;

                                                            return (
                                                                <span
                                                                    key={college.id}
                                                                    className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold ${
                                                                        isMyCollege
                                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                                                            : 'border-slate-200 bg-slate-50 text-slate-700'
                                                                    }`}
                                                                >
                                                                    {isMyCollege ? '🌟 ' : ''}
                                                                    {college.name}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>

                                                    {group.colleges.some((college) => college.maps_url) && (
                                                        <a
                                                            href={group.colleges.find((college) => college.maps_url)?.maps_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
                                                        >
                                                            🗺️ فتح على الخريطة
                                                        </a>
                                                    )}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-10 text-center">
                                        <p className="text-slate-500 font-medium">لا توجد كليات مطابقة للبحث.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {SHOW_LANDMARKS_SECTION && (
                        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl space-y-5">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-950">معالم الجامعة</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                                <div className="relative">
                                    <span className="absolute inset-y-0 right-4 flex items-center text-lg opacity-60">🔎</span>
                                    <input
                                        type="text"
                                        value={landmarkSearch}
                                        onChange={(e) => setLandmarkSearch(e.target.value)}
                                        placeholder="ابحث عن معلم أو موقع"
                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-11 pl-4 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                                    />
                                </div>

                                <select
                                    value={landmarkType}
                                    onChange={(e) => setLandmarkType(e.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100 lg:min-w-[220px]"
                                >
                                    {Object.entries(LANDMARK_TYPES).map(([key, value]) => (
                                        <option key={key} value={key}>
                                            {value.icon} {value.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {filteredLandmarks.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredLandmarks.map((landmark) => {
                                        const typeInfo = LANDMARK_TYPES[landmark.type] || LANDMARK_TYPES.other;

                                        return (
                                            <article
                                                key={landmark.id}
                                                className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                                            >
                                                <div className="relative h-40 bg-slate-950">
                                                    {landmark.image_url ? (
                                                        <img
                                                            src={landmark.image_url}
                                                            alt={landmark.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-5xl text-white/90">
                                                            {typeInfo.icon}
                                                        </div>
                                                    )}

                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                                                    <div className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-xs font-black text-white backdrop-blur">
                                                        {typeInfo.icon} {typeInfo.label}
                                                    </div>
                                                </div>

                                                <div className="p-5 space-y-3">
                                                    <h3 className="text-lg font-black text-slate-950">{landmark.name}</h3>

                                                    {landmark.description && (
                                                        <p className="text-sm leading-7 text-slate-600 line-clamp-2">
                                                            {landmark.description}
                                                        </p>
                                                    )}

                                                    {landmark.building_location && (
                                                        <p className="text-sm font-medium text-slate-700">📍 {landmark.building_location}</p>
                                                    )}

                                                    {landmark.maps_url && (
                                                        <a
                                                            href={landmark.maps_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-500"
                                                        >
                                                            🗺️ فتح على الخريطة
                                                        </a>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                                    <p className="text-slate-500 font-medium">لا يوجد معالم مطابقة للفلاتر الحالية.</p>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
