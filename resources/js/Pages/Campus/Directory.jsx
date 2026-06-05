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
        facilities: ['مختبرات الحاسوب (IT)', 'مدرج الفاروق', 'مصلى', 'مكتبة فرعية', 'كافتيريا قريبة'],
    },
    {
        symbol: 'ت',
        building: 'كلية العلوم الطبية المساندة / الكلية الزرقاء التقنية',
        colleges: ['كلية العلوم الطبية المساندة', 'الكلية الزرقاء التقنية'],
        facilities: ['مختبرات طبية متخصصة', 'كافتيريا الكلية', 'ساحات خارجية'],
    },
    {
        symbol: 'د.ه',
        building: 'الخوارزمي',
        colleges: ['كلية التمريض', 'كلية الصيدلة', 'كلية العلوم'],
        facilities: ['مختبرات الكيمياء والفيزياء', 'مختبرات التمريض والصيدلة', 'مدرج الخوارزمي', 'كافتيريا الخوارزمي'],
    },
    {
        symbol: 'ل',
        building: 'مبنى الهندسة والفنون',
        colleges: ['كلية الهندسة التكنولوجية', 'كلية الفنون والتصميم'],
        facilities: ['مشاغل ومختبرات هندسية', 'مراسم الفنون والتصميم', 'معرض فنون', 'كافتيريا'],
    },
    {
        symbol: 'ص',
        building: 'مبنى الإعلام والحقوق',
        colleges: ['كلية الصحافة والإعلام', 'كلية الحقوق'],
        facilities: ['استوديوهات الإذاعة والتلفزيون', 'المحكمة الصورية التدريبية', 'مختبرات الملتيميديا'],
    },
    {
        symbol: 'ق',
        building: 'مبنى الشهيد معاذ الكساسبة',
        colleges: ['كلية الاقتصاد والعلوم الإدارية', 'كلية الدراسات العليا'],
        facilities: ['مختبرات البورصة والمحاكاة', 'قاعات الدراسات العليا', 'كافتيريا الاقتصاد'],
    },
    {
        symbol: 'ط',
        building: 'كلية طب الأسنان',
        colleges: [],
        facilities: ['عيادات طب الأسنان التدريبية', 'مختبرات طبية متقدمة'],
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
    const [selectedCollegeInfo, setSelectedCollegeInfo] = useState(null); // For the smart modal

    // Smart Room Decoder State
    const [roomInput, setRoomInput] = useState('');
    const [decodedRoom, setDecodedRoom] = useState(null);

    React.useEffect(() => {
        if (!roomInput.trim()) {
            setDecodedRoom(null);
            return;
        }

        // Remove spaces, dashes, and Arabic tatweel (ـ)
        const normalized = roomInput.replace(/[\s\-\u0640]/g, '');

        // Match letters then numbers, OR numbers then letters (1 to 4 digits)
        let match = normalized.match(/^([أ-يa-zA-Z\.]+)(\d{1,4})$/);
        let symbol, numStr;

        if (match) {
            symbol = match[1];
            numStr = match[2];
        } else {
            match = normalized.match(/^(\d{1,4})([أ-يa-zA-Z\.]+)$/);
            if (match) {
                numStr = match[1];
                symbol = match[2];
            }
        }

        if (symbol && numStr) {
            // Normalize input symbol (e.g. removing dots)
            const cleanSymbol = symbol.replace('.', '');

            // Try to find the matching building
            const building = OFFICIAL_BUILDING_GUIDE.find(b => {
                const bSymbol = b.symbol.replace('.', '');
                return bSymbol === cleanSymbol || 
                       bSymbol.includes(cleanSymbol) || 
                       cleanSymbol.includes(bSymbol);
            });

            const num = parseInt(numStr, 10);
            let floorNum = 0;
            let roomNum = num;

            if (num >= 100) {
                floorNum = Math.floor(num / 100);
                roomNum = num % 100;
            }

            let floorName = '';
            if (floorNum === 0) floorName = 'الطابق الأرضي (التسوية)';
            else if (floorNum === 1) floorName = 'الطابق الأول';
            else if (floorNum === 2) floorName = 'الطابق الثاني';
            else if (floorNum === 3) floorName = 'الطابق الثالث';
            else if (floorNum === 4) floorName = 'الطابق الرابع';
            else if (floorNum === 5) floorName = 'الطابق الخامس';
            else floorName = `الطابق ${floorNum}`;

            setDecodedRoom({
                valid: true,
                building: building ? building.building : 'مبنى غير معروف',
                buildingObj: building,
                floor: floorName,
                room: roomNum,
            });
        } else {
            setDecodedRoom({ valid: false, message: 'الصيغة غير صحيحة. جرب مثلاً: 305د أو ب12' });
        }
    }, [roomInput]);

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
                    <section className="relative overflow-hidden py-10 sm:py-16 text-center mb-10">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none select-none z-0">
                            <span className={`text-[5rem] sm:text-[9rem] md:text-[12rem] font-black tracking-tighter whitespace-nowrap ${isDark ? 'text-white/[0.02]' : 'text-slate-900/[0.03]'}`}>
                                CAMPUS
                            </span>
                        </div>
                        <div className="relative z-10">
                            <h1 className={`text-4xl sm:text-5xl md:text-6xl font-[900] mb-3 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>دليل المباني والكليات</h1>
                            <p className={`text-base sm:text-lg font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>دليل مبسط للكليات ومعالم الجامعة</p>
                        </div>
                    </section>

                    {/* Smart Room Decoder Section */}
                    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 sm:p-8 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl relative overflow-hidden">
                        <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none"></div>
                        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-950 mb-3 flex items-center gap-3">
                                    <span className="text-indigo-500">✨</span> المستكشف الذكي للقاعات
                                </h2>
                                <p className="text-slate-600 font-medium mb-6">
                                    اكتب رمز قاعتك كما هو بالجدول وسنحدد لك المبنى والطابق فوراً.
                                </p>
                                
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={roomInput}
                                        onChange={(e) => setRoomInput(e.target.value)}
                                        placeholder="مثال: 305د أو 201أ"
                                        className="w-full text-xl sm:text-2xl font-black rounded-2xl border-2 border-slate-200 bg-slate-50 py-4 pr-4 pl-12 text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 placeholder:text-slate-300 placeholder:font-medium text-center tracking-widest uppercase"
                                        dir="ltr"
                                    />
                                    <span className="absolute inset-y-0 left-4 flex items-center text-2xl opacity-40">🔍</span>
                                </div>
                            </div>
                            
                            <div className="h-full">
                                {!decodedRoom ? (
                                    <div className="h-full min-h-[140px] rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center text-center p-6 text-slate-400 font-medium">
                                        <span className="text-4xl mb-2 opacity-50">🧭</span>
                                        <p>اكتب رمز القاعة لفك التشفير...</p>
                                    </div>
                                ) : decodedRoom.valid ? (
                                    <div className="directory-card-reveal h-full rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500"></div>
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center text-2xl font-black shadow-md shrink-0">
                                                    {decodedRoom.buildingObj ? decodedRoom.buildingObj.symbol : '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-indigo-500 mb-1">المبنى الكود</p>
                                                    <h3 className="text-lg font-black text-slate-900">{decodedRoom.building}</h3>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-3 pt-2">
                                                <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm text-center">
                                                    <p className="text-xs font-bold text-slate-400 mb-1">الطابق</p>
                                                    <p className="text-base font-black text-slate-800">{decodedRoom.floor}</p>
                                                </div>
                                                <div className="rounded-xl bg-white p-3 border border-slate-100 shadow-sm text-center">
                                                    <p className="text-xs font-bold text-slate-400 mb-1">القاعة</p>
                                                    <p className="text-base font-black text-slate-800">{decodedRoom.room}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="directory-card-reveal h-full min-h-[140px] rounded-2xl border border-rose-100 bg-rose-50/50 flex items-center justify-center text-center p-6 text-rose-500 font-bold">
                                        <div className="space-y-2">
                                            <span className="text-3xl block">⚠️</span>
                                            <p>{decodedRoom.message}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {OFFICIAL_BUILDING_GUIDE.length > 0 && (
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-950">المرجع الرسمي للمباني والكليات</h2>
                                <div className="h-px flex-1 bg-slate-200"></div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                {OFFICIAL_BUILDING_GUIDE.map((entry, idx) => (
                                    <article
                                        key={entry.symbol}
                                        className="directory-card-reveal group relative overflow-hidden rounded-[2rem] bg-white border border-slate-200 p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]"
                                        style={{ animationDelay: `${idx * 70}ms` }}
                                    >
                                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none"></div>
                                        
                                        <div className="relative z-10 flex flex-col h-full">
                                            <div className="flex items-center gap-4 mb-5">
                                                <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-slate-900/20 group-hover:scale-110 transition-transform duration-300">
                                                    {entry.symbol}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900 leading-tight">{entry.building}</h3>
                                                </div>
                                            </div>
                                            
                                            <div className="mt-auto">
                                                <div className="flex flex-wrap gap-2">
                                                    {entry.colleges.length > 0 ? (
                                                        entry.colleges.map((college) => (
                                                            <button
                                                                key={college}
                                                                onClick={() => setSelectedCollegeInfo({ college, building: entry })}
                                                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:scale-105 hover:shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                                            >
                                                                {college}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <button 
                                                            onClick={() => setSelectedCollegeInfo({ college: 'كلية طب الأسنان', building: entry })}
                                                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:scale-105 hover:shadow-sm hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                                        >
                                                            مبنى متخصص (طب الأسنان)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div className="directory-card-reveal rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between" style={{ animationDelay: `${OFFICIAL_BUILDING_GUIDE.length * 70}ms` }}>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl bg-indigo-100 text-indigo-600 p-2 rounded-xl">🔢</span>
                                    <div>
                                        <p className="text-base font-black text-slate-900">دليل ترميز الطوابق</p>
                                        <p className="text-xs font-medium text-slate-500">الرقم الأول من القاعة يمثل الطابق</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {OFFICIAL_FLOOR_LEGEND.map((floor) => {
                                        const [code, name] = floor.split(' = ');
                                        return (
                                            <div key={floor} className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                                <span className="bg-slate-800 text-white font-black text-xs px-3 py-2">{code}</span>
                                                <span className="text-xs font-bold text-slate-700 px-3 py-2">{name}</span>
                                            </div>
                                        );
                                    })}
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

            {/* Smart College Info Modal */}
            {selectedCollegeInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
                    <div 
                        className="absolute inset-0" 
                        onClick={() => setSelectedCollegeInfo(null)}
                    ></div>
                    <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden directory-card-reveal">
                        <div className="bg-gradient-to-l from-indigo-600 to-indigo-500 p-6 sm:p-8 text-white relative">
                            <button 
                                onClick={() => setSelectedCollegeInfo(null)}
                                className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
                            >
                                ✕
                            </button>
                            <h3 className="text-2xl font-black mb-1">{selectedCollegeInfo.college}</h3>
                            <p className="text-indigo-100 font-medium">معلومات المبنى والمرافق</p>
                        </div>
                        
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex items-start gap-4">
                                <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-100 text-slate-800 flex items-center justify-center text-2xl font-black border border-slate-200">
                                    {selectedCollegeInfo.building.symbol}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-400 mb-1">المبنى الرئيسي</p>
                                    <h4 className="text-xl font-black text-slate-900">{selectedCollegeInfo.building.building}</h4>
                                </div>
                            </div>

                            <div className="h-px w-full bg-slate-100"></div>

                            <div>
                                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                                    <span className="text-indigo-500">✨</span> أهم المرافق في المبنى:
                                </h4>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {selectedCollegeInfo.building.facilities.map((facility, index) => (
                                        <li key={index} className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <span className="text-emerald-500 text-lg">✓</span> {facility}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 sm:p-6 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={() => setSelectedCollegeInfo(null)}
                                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
                            >
                                حسناً، فهمت
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
