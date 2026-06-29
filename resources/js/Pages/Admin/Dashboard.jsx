import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';
import { UAParser } from 'ua-parser-js';

const siteUrl = (import.meta.env.VITE_APP_URL || 'https://sanfoor.me').replace(/\/$/, '');

const translations = {
    ar: {
        title: 'لوحة الإدارة المركزية', subtitle: 'لوحة متابعة تشغيلية: الإحصائيات، البلاغات، السجل، والتحكم السريع.',
        liveOps: 'Live Ops', infrastructure: 'بنية تحتية نشطة', greeting: 'أهلاً بك،',
        manageStudents: 'إدارة الطلاب', liveReports: 'التقارير الحية',
        totalStudents: 'إجمالي الطلاب', activeNow: 'نشطين حالياً', courses: 'المواد الدراسية',
        simulatorRequests: 'طلبات التسجيل التجريبي', nextSemesterForecast: 'توقعات الفصل القادم',
        systemStatus: 'حالة النظام', systemProtected: 'حماية Postgre فعال',
        openReports: 'بلاغات مفتوحة', totalReports: 'إجمالي البلاغات:',
        academicCoverage: 'التغطية الأكاديمية', collegesSlashMajors: 'كليات / تخصصات',
        topDemand: 'المواد الأكثر طلباً (Top 5)', viewFullReport: 'عرض التقرير الكامل ←',
        student: 'طالب', noSimulatorData: 'لا يوجد بيانات تسجيل تجريبي مسجلة حالياً.',
        quickActions: 'إجراءات سريعة وبوابات التحكم', studentReports: 'بلاغات الطلاب',
        addCollege: 'إضافة كلية جديدة', updatePlan: 'تحديث خطة تخصص', activityLog: 'سجل حركات الإدارة',
        aiStatus: 'ذكاء اصطناعي نشط', configAlgo: 'تهيئة الخوارزميات',
        aiChats: 'محادثات AI',
        latestReports: 'آخر البلاغات', viewAll: 'عرض الكل', unknown: 'غير معروف',
        noNewReports: 'لا توجد بلاغات جديدة.', adminLog: 'سجل حركات الإدارة',
        lastMoves: (n) => `آخر ${n} حركة`, noLogEntries: 'لا توجد حركات مسجلة حالياً.',
        statusOpen: 'مفتوح', statusInProgress: 'قيد المعالجة', statusResolved: 'محلول',
        majorCourses: 'مادة تخصص', statsTracker: 'Stats Tracker',
        admins: 'أدمن',
        instructors: 'كادر تدريسي',
        openSettings: 'فتح الإعدادات',
        adminNotesTitle: 'ملاحظات الأدمنز اليومية',
        adminNotesHint: 'اكتب ملحوظتك بعد إنهاء المهام اليوم.',
        myNote: 'ملاحظتي اليوم',
        notePlaceholder: 'اكتب ملاحظتك... ماذا تم اليوم؟',
        saveNote: 'حفظ الملاحظة',
        updateNote: 'تحديث الملاحظة',
        noteSaved: 'تم حفظ الملاحظة',
        notesTimeline: 'آخر الملاحظات',
        noNotesYet: 'لا توجد ملاحظات مسجلة بعد.',
        academicTreeSection: 'إحصائيات الخطة والشجرة الأكاديمية الأكاديمية',
        quizChaptersSection: 'منظومة الشباتر والكويزات التفاعلية',
        quizCourses: 'مواد الكويزات فقط',
        totalChapters: 'إجمالي الشباتر المرفوعة',
        totalQuestions: 'بنك الأسئلة',
        quizAttempts: 'محاولات الطلاب للكويزات',
        avgQuizScore: 'متوسط الدرجات الكلي',
    },
    en: {
        title: 'Admin Control Center', subtitle: 'Operational dashboard: stats, reports, log, and quick controls.',
        liveOps: 'Live Ops', infrastructure: 'Active Infrastructure', greeting: 'Welcome,',
        manageStudents: 'Manage Students', liveReports: 'Live Reports',
        totalStudents: 'Total Students', activeNow: 'Currently Active', courses: 'Courses',
        simulatorRequests: 'Trial Registration Requests', nextSemesterForecast: 'Next Semester Forecast',
        systemStatus: 'System Status', systemProtected: 'PostgreSQL Protection Active',
        openReports: 'Open Reports', totalReports: 'Total Reports:',
        academicCoverage: 'Academic Coverage', collegesSlashMajors: 'Colleges / Majors',
        topDemand: 'Top 5 Most Demanded Courses', viewFullReport: 'View Full Report →',
        student: 'students', noSimulatorData: 'No trial registration data recorded yet.',
        quickActions: 'Quick Controls & Gateways', studentReports: 'Student Reports',
        addCollege: 'Add New College', updatePlan: 'Update Major Plan', activityLog: 'Activity Log',
        aiStatus: 'AI Active', configAlgo: 'Configure Algorithms',
        aiChats: 'AI Chats',
        latestReports: 'Latest Reports', viewAll: 'View All', unknown: 'Unknown',
        noNewReports: 'No new reports.', adminLog: 'Admin Activity Log',
        lastMoves: (n) => `Last ${n} entries`, noLogEntries: 'No activity recorded yet.',
        statusOpen: 'Open', statusInProgress: 'In Progress', statusResolved: 'Resolved',
        majorCourses: 'major courses', statsTracker: 'Stats',
        admins: 'Admins',
        instructors: 'Instructors',
        openSettings: 'Open Settings',
        adminNotesTitle: 'Daily Admin Notes',
        adminNotesHint: 'Leave a short note once you finish today.',
        myNote: 'My note today',
        notePlaceholder: 'Write your note... what got done?',
        saveNote: 'Save note',
        updateNote: 'Update note',
        noteSaved: 'Note saved',
        notesTimeline: 'Recent notes',
        noNotesYet: 'No notes logged yet.',
        academicTreeSection: 'Academic Tree & Plan Statistics',
        quizChaptersSection: 'Interactive Quiz & Chapters Ecosystem',
        quizCourses: 'Quiz-only Courses',
        totalChapters: 'Total Chapters',
        totalQuestions: 'Question Bank',
        quizAttempts: 'Quiz Attempts',
        avgQuizScore: 'Avg Quiz Score',
    },
};

export default function AdminDashboard({ auth, stats, platform = {}, demandReport = [], issueSummary = {}, recentIssues = [], logs = [], onlineUsers = [], adminNotes = [], myAdminNote = null, notesEnabled = true, ntpGuests = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;
    const safeAuth = auth || {};
    const safeUser = safeAuth.user || { name: 'Admin' };
    const safeStats = stats || {};
    const safePlatform = platform || {};
    const safeIssueSummary = issueSummary || {};
    const safeDemandReport = Array.isArray(demandReport) ? demandReport : [];
    const safeRecentIssues = Array.isArray(recentIssues) ? recentIssues : [];
    const safeLogs = Array.isArray(logs) ? logs : [];
    const safeNotes = Array.isArray(adminNotes) ? adminNotes : [];
    const safeMyNote = myAdminNote || null;

    const parseDevice = (userAgent) => {
        if (!userAgent) return 'جهاز غير معروف';
        try {
            const parser = new UAParser(userAgent);
            const res = parser.getResult();
            
            const os = res.os.name || 'غير معروف';
            const browser = res.browser.name || '';
            const deviceType = res.device.type; // 'mobile', 'tablet'
            const deviceVendor = res.device.vendor || ''; // 'Samsung', 'Apple'
            const deviceModel = res.device.model || ''; // 'SM-A505F', 'iPhone'
            
            let deviceIcon = '💻';
            if (deviceType === 'mobile') deviceIcon = '📱';
            else if (deviceType === 'tablet') deviceIcon = '💊';
            
            let deviceLabel = '';
            if (deviceVendor || deviceModel) {
                deviceLabel = `${deviceVendor} ${deviceModel}`.trim();
            } else {
                deviceLabel = os;
            }

            return `${deviceIcon} ${deviceLabel} - ${browser}`.trim();
        } catch (e) {
            return `💻 جهاز غير معروف`;
        }
    };

    // ── New User Notification System ──
    const lastRegIdRef = useRef(0);
    const audioRef = useRef(null);

    const [notificationPermission, setNotificationPermission] = useState(
        typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
    );

    const requestNotificationPermission = () => {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                setNotificationPermission(permission);
                if (permission === 'granted') {
                    toast.success('تم تفعيل إشعارات سطح المكتب بنجاح!');
                } else {
                    toast.error('تم رفض صلاحية الإشعارات من المتصفح.');
                }
            });
        }
    };

    const playNotificationSound = useCallback(() => {
        try {
            if (!audioRef.current) {
                audioRef.current = new Audio('/sounds/notification.wav');
                audioRef.current.volume = 0.6;
            }
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
        } catch (e) { /* ignore audio errors */ }
    }, []);

    const pollNewRegistrations = useCallback(async () => {
        try {
            const url = route('admin.api.new_registrations') + '?since_id=' + lastRegIdRef.current;
            const res = await fetch(url, { credentials: 'same-origin' });
            if (!res.ok) return;
            const data = await res.json();
            
            if (data.registrations && data.registrations.length > 0) {
                // To be safe, filter to only the new ones
                const newAlerts = data.registrations.filter(r => r.id > lastRegIdRef.current);
                
                if (newAlerts.length > 0) {
                    newAlerts.forEach(reg => {
                        const name = reg.user?.name || 'مستخدم جديد';
                        const email = reg.user?.email || '';
                        const role = reg.user?.role || 'student';
                        const roleBadge = role === 'instructor' ? '👨‍🏫 مدرس' : role === 'admin' ? '⚙️ أدمن' : '👨‍🎓 طالب';
                        
                        toast.success(`مستخدم جديد! ${name}`, {
                            description: `${email} • ${roleBadge}`,
                            duration: 12000,
                            icon: '🎉',
                        });

                        // Trigger native OS notification (Windows/Mac) if permitted
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('سنفور - مستخدم جديد!', {
                                body: `${name} (${roleBadge})\n${email}`,
                                icon: '/images/sanfoor.png', // Assuming logo is here
                                dir: 'rtl'
                            });
                        }
                    });
                    
                    playNotificationSound();
                    
                    // Update the last seen ID
                    const maxId = Math.max(...data.registrations.map(r => r.id));
                    if (maxId > lastRegIdRef.current) lastRegIdRef.current = maxId;
                }
            }
        } catch (e) { /* silently ignore polling errors */ }
    }, [playNotificationSound]);

    // Initialize lastRegIdRef on first load to avoid showing old registrations
    useEffect(() => {
        (async () => {
            try {
                const url = route('admin.api.new_registrations') + '?since_id=0';
                const res = await fetch(url, { credentials: 'same-origin' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.registrations && data.registrations.length > 0) {
                        lastRegIdRef.current = Math.max(...data.registrations.map(r => r.id));
                    }
                }
            } catch (e) {}
        })();
    }, []);

    useEffect(() => {
        const refreshDashboard = () => {
            // Do not hit the server if the user is in another tab (fixes the DDoS issue)
            if (document.hidden) return;

            router.reload({
                only: ['stats', 'platform', 'demandReport', 'issueSummary', 'recentIssues', 'logs', 'onlineUsers', 'adminNotes', 'myAdminNote', 'notesEnabled'],
                preserveState: true,
                preserveScroll: true,
            });
            // Also poll for new registrations
            pollNewRegistrations();
        };

        // Increase interval to 60 seconds to relieve the server
        const timer = window.setInterval(refreshDashboard, 60000);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshDashboard();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [pollNewRegistrations]);

    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const timeString = currentTime.toLocaleTimeString(lang === 'ar' ? 'ar-JO' : 'en-US', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateString = currentTime.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-US', { timeZone: 'Asia/Amman', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const safeStudentsCount = Number(safeStats.students_count || 0);
    const demandBase = safeStudentsCount > 0 ? safeStudentsCount : 1;

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const cardAlt = isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-[#f8fafc] border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const logRow = isDark ? 'border-slate-700 bg-slate-800/30 hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-200';

    const {
        data: noteData,
        setData: setNoteData,
        post: postNote,
        processing: noteProcessing,
        errors: noteErrors,
        recentlySuccessful: noteSaved,
    } = useForm({
        note: safeMyNote?.note || '',
    });

    useEffect(() => {
        setNoteData('note', safeMyNote?.note || '');
    }, [safeMyNote?.note, setNoteData]);

    const notesStoreUrl = (() => {
        if (typeof route === 'function') {
            try {
                if (route().has && route().has('admin.notes.store')) {
                    return route('admin.notes.store');
                }
            } catch (error) {
                return '/admin/notes';
            }
        }

        return '/admin/notes';
    })();

    const handleNoteSubmit = (event) => {
        event.preventDefault();
        postNote(notesStoreUrl, {
            preserveScroll: true,
            onSuccess: () => {
                router.reload({ only: ['adminNotes', 'myAdminNote'] });
            },
        });
    };

    const getStatusBadge = (s) => {
        if (s === 'open') return isDark ? 'bg-rose-900/40 text-rose-400' : 'bg-rose-100 text-rose-700';
        if (s === 'in_progress') return isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-700';
        return isDark ? 'bg-emerald-900/40 text-emerald-400' : 'bg-emerald-100 text-emerald-700';
    };
    const getStatusLabel = (s) => s === 'open' ? t.statusOpen : s === 'in_progress' ? t.statusInProgress : t.statusResolved;

    return (
        <AdminLayout user={safeUser}>
            <Head title={`${t.title} | سنفور`} />
            <Toaster richColors position={lang === 'ar' ? 'top-left' : 'top-right'} expand={true} />

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                .animate-slide-in { animation: slideInRight 0.5s ease-out forwards; }
                .delay-100 { animation-delay: 100ms; } .delay-200 { animation-delay: 200ms; }
            ` }} />

            <div className="space-y-8 pb-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                {/* Top bar */}
                <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${card} rounded-2xl px-5 py-3`}>
                    <p className={`text-xs font-black ${subtext}`}>{t.subtitle}</p>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <span className="text-lg">🇯🇴</span>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`} dir="ltr">{dateString}</span>
                                <span className={`text-xs font-black tracking-widest ${isDark ? 'text-slate-100' : 'text-slate-800'}`} dir="ltr">{timeString}</span>
                            </div>
                        </div>
                        <span className={`text-[10px] font-black rounded-lg px-2 py-1 ${isDark ? 'text-indigo-400 bg-indigo-500/20 border border-indigo-500/30' : 'text-indigo-600 bg-indigo-50 border border-indigo-100'}`}>{t.liveOps}</span>
                    </div>
                </div>

                {/* Hero Banner */}
                <div className="relative overflow-hidden bg-[#0b0f19] rounded-[3rem] p-10 text-white shadow-2xl border border-white/5">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/20 blur-[100px] rounded-full"></div>
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="max-w-2xl text-center md:text-right">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black tracking-widest uppercase mb-6">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                                {t.infrastructure} • v2.1.4
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">
                                {t.greeting} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">{safeUser.name}</span> 👋
                            </h1>
                            <p className="text-slate-400 font-bold text-sm md:text-base leading-relaxed">
                                {lang === 'ar'
                                    ? <>نراقب الآن أداء <span className="text-white">{safeStats.students_count || 0}</span> طالب، وإدارة <span className="text-white">{safeStats.admins_count || 0}</span> أدمن + <span className="text-white">{safeStats.owners_count || 0}</span> مالك نظام، مع تحليل <span className="text-white">{safeStats.courses_count || 0}</span> مادة أكاديمية.</>
                                    : <>Monitoring <span className="text-white">{safeStats.students_count || 0}</span> students, managing <span className="text-white">{safeStats.admins_count || 0}</span> admins + <span className="text-white">{safeStats.owners_count || 0}</span> owners, analyzing <span className="text-white">{safeStats.courses_count || 0}</span> courses.</>
                                }
                            </p>
                        </div>
                        <div className="flex shrink-0 gap-3">
                            <Link href={route('admin.students.index')} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm hover:scale-105 transition-all shadow-xl shadow-white/10">{t.manageStudents}</Link>
                            <Link href={route('admin.reports.demand')} className="bg-white/5 border border-white/10 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-black text-sm hover:bg-white/10 transition-all">{t.liveReports}</Link>
                        </div>
                    </div>
                </div>

                {/* 🏛️ 1. Academic Tree & Plan Section */}
                <div className="space-y-4 animate-slide-in">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">🏛️</span>
                        <h2 className={`text-lg font-black tracking-tight ${heading}`}>{t.academicTreeSection}</h2>
                        <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6">
                        <StatCard title={t.totalStudents} value={safeStats.students_count || 0} icon="👨‍🎓" color="indigo" trend={`${t.activeNow}: ${safeStats.active_students_now || 0}`} link={route('admin.students.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.admins} value={safeStats.admins_count || 0} icon="⚙️" color="violet" trend={`${t.activeNow}: ${safeStats.active_admins_now || 0}`} link={route('admin.admins.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.instructors} value={safeStats.instructors_count || 0} icon="👨‍🏫" color="amber" trend={lang === 'ar' ? 'حسابات هيئة التدريس' : 'Faculty accounts'} link={route('admin.instructors.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.courses} value={safeStats.courses_count || 0} icon="📚" color="emerald" trend={`${safeStats.compulsory_count || 0} ${t.majorCourses}`} link={route('admin.courses')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.simulatorRequests} value={safeDemandReport.reduce((acc, curr) => acc + Number(curr?.cart_users_count || 0), 0)} icon="🛒" color="rose" trend={t.nextSemesterForecast} link={route('admin.reports.demand')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.academicCoverage} value={`${safePlatform.colleges_count || 0}/${safePlatform.majors_count || 0}`} icon="🏛️" color="indigo" trend={t.collegesSlashMajors} link={route('admin.courses')} isDark={isDark} tLabel={t.statsTracker} />
                    </div>
                </div>

                {/* ⚡ 2. Interactive Chapters & Quizzes Section */}
                <div className="space-y-4 animate-slide-in delay-100">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">⚡</span>
                        <h2 className={`text-lg font-black tracking-tight ${heading}`}>{t.quizChaptersSection}</h2>
                        <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        <StatCard title={t.totalChapters} value={safeStats.chapters_count || 0} icon="📖" color="indigo" trend={lang === 'ar' ? 'إدارة محتوى الشباتر' : 'Manage Chapters'} link={route('admin.chapters.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.totalQuestions} value={safeStats.questions_count || 0} icon="❓" color="violet" trend={lang === 'ar' ? 'بنك الأسئلة والخيارات' : 'Question Bank'} link={route('admin.questions.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.quizCourses} value={safeStats.quiz_courses_count || 0} icon="🎓" color="emerald" trend={lang === 'ar' ? 'خارج الشجرة الأكاديمية' : 'Isolated quiz subjects'} link={route('admin.chapters.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.quizAttempts} value={safeStats.quiz_attempts_count || 0} icon="🎯" color="rose" trend={lang === 'ar' ? 'إجمالي محاولات الاختبارات' : 'Total quiz responses'} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.avgQuizScore} value={`${safeStats.quiz_avg_score || 0}%`} icon="📈" color="amber" trend={lang === 'ar' ? 'مستوى أداء الطلاب العام' : 'Overall student success rate'} isDark={isDark} tLabel={t.statsTracker} />
                    </div>
                </div>

                {/* 💬 3. Content & Communication Section */}
                <div className="space-y-4 animate-slide-in delay-200">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">💬</span>
                        <h2 className={`text-lg font-black tracking-tight ${heading}`}>{lang === 'ar' ? 'إدارة المحتوى والتواصل' : 'Content & Communication'}</h2>
                        <div className={`h-px flex-1 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title={lang === 'ar' ? 'رسائل التواصل' : 'Contact Messages'} value={safeStats.contact_messages_count || 0} icon="📩" color="indigo" trend={`${safeStats.unread_contact_messages_count || 0} غير مقروء`} link={route('admin.contact_messages.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={t.aiChats} value={safeStats.ai_chats_count || 0} icon="🤖" color="emerald" trend={lang === 'ar' ? 'محادثات المرشد الذكي' : 'AI Advisor Chats'} link={route('admin.ai_chats')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={lang === 'ar' ? 'المعالم الجامعية' : 'Landmarks'} value={safeStats.landmarks_count || 0} icon="📍" color="amber" trend={lang === 'ar' ? 'أماكن وخدمات الجامعة' : 'University Services'} link={route('admin.landmarks.index')} isDark={isDark} tLabel={t.statsTracker} />
                        <StatCard title={lang === 'ar' ? 'بلاغات المشاكل' : 'Issue Reports'} value={safeIssueSummary.total || 0} icon="🛠️" color="rose" trend={`${safeIssueSummary.open || 0} ${t.statusOpen}`} link={route('admin.issues.index')} isDark={isDark} tLabel={t.statsTracker} />
                    </div>
                </div>

                {/* Reports + Quick Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className={`lg:col-span-2 ${card} rounded-[2.5rem] p-8 shadow-sm`}>
                        <div className="flex justify-between items-center mb-8">
                            <h3 className={`text-xl font-black ${heading} flex items-center gap-3`}>
                                <span className="text-indigo-500 text-2xl">🔥</span> {t.topDemand}
                            </h3>
                            <Link href={route('admin.reports.demand')} className="text-xs font-black text-indigo-500 hover:underline">{t.viewFullReport}</Link>
                        </div>
                        <div className="space-y-6">
                            {safeDemandReport.slice(0, 5).map((item) => (
                                <div key={item.id} className="group">
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-xs font-black group-hover:text-indigo-500 transition-colors ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.name}</span>
                                        <span className={`text-[10px] font-bold ${subtext}`}>{item.cart_users_count} {t.student}</span>
                                    </div>
                                    <div className={`w-full h-2 ${isDark ? 'bg-slate-700' : 'bg-slate-100'} rounded-full overflow-hidden`}>
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" style={{ width: `${(Number(item.cart_users_count || 0) / demandBase) * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                            {safeDemandReport.length === 0 && <p className={`text-center py-10 font-bold ${subtext}`}>{t.noSimulatorData}</p>}
                        </div>
                    </div>

                    <div className={`${cardAlt} rounded-[2.5rem] p-8 flex flex-col justify-between`}>
                        <div className="w-full">
                            <h3 className={`text-lg font-black ${heading} mb-4 flex items-center gap-2`}>
                                <span>⚡</span> {t.quickActions}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <QuickLink title={lang === 'ar' ? 'إدارة المعالم' : 'Manage Landmarks'} icon="📍" href={route('admin.landmarks.index')} isDark={isDark} />
                                <QuickLink title={lang === 'ar' ? 'صندوق الرسائل' : 'Contact Inbox'} icon="📩" href={route('admin.contact_messages.index')} isDark={isDark} />
                                <QuickLink title={lang === 'ar' ? 'إدارة الشباتر' : 'Manage Chapters'} icon="📖" href={route('admin.chapters.index')} isDark={isDark} />
                                <QuickLink title={lang === 'ar' ? 'إدارة الأسئلة' : 'Manage Questions'} icon="❓" href={route('admin.questions.index')} isDark={isDark} />
                                <QuickLink title={lang === 'ar' ? 'إدارة مواد الشجرة' : 'Manage Tree Courses'} icon="📚" href={route('admin.courses')} isDark={isDark} />
                                <QuickLink title={t.aiChats} icon="🤖" href={route('admin.ai_chats')} isDark={isDark} />
                                <QuickLink title={t.openSettings} icon="⚙️" href={route('admin.settings')} isDark={isDark} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Admin Notes */}
                <div className={`${card} rounded-[2.5rem] p-8 shadow-sm`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                        <h3 className={`text-lg font-black ${heading} flex items-center gap-2`}>📝 {t.adminNotesTitle}</h3>
                        <span className={`text-xs font-bold ${subtext}`}>{t.adminNotesHint}</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <form onSubmit={handleNoteSubmit} className="space-y-3">
                            <label className={`text-[11px] font-black ${subtext} uppercase tracking-widest block`}>{t.myNote}</label>
                            {!notesEnabled && (
                                <div className={`text-[11px] font-black rounded-xl border px-3 py-2 ${isDark ? 'border-rose-700 bg-rose-900/30 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                                    ملاحظات الأدمن غير مفعّلة حالياً. شغّل `php artisan migrate` لإنشاء الجدول.
                                </div>
                            )}
                            <textarea
                                value={noteData.note}
                                onChange={(e) => setNoteData('note', e.target.value)}
                                placeholder={t.notePlaceholder}
                                rows={6}
                                maxLength={1500}
                                className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold focus:ring-indigo-500 ${isDark ? 'bg-slate-900/40 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
                            />
                            {noteErrors.note && (
                                <p className="text-[11px] font-bold text-rose-500">{noteErrors.note}</p>
                            )}
                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={noteProcessing || !noteData.note.trim() || !notesEnabled}
                                    className="px-5 py-2.5 rounded-xl text-[12px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-50"
                                >
                                    {noteProcessing ? '...' : (safeMyNote ? t.updateNote : t.saveNote)}
                                </button>
                                {noteSaved && (
                                    <span className={`text-[11px] font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t.noteSaved}</span>
                                )}
                            </div>
                        </form>
                        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                            <p className={`text-[11px] font-black ${subtext} uppercase tracking-widest`}>{t.notesTimeline}</p>
                            {safeNotes.length > 0 ? safeNotes.map((note) => {
                                const updatedAt = note.updated_at || note.created_at || note.note_date;
                                const dateLabel = note.note_date || note.updated_at || note.created_at;

                                return (
                                    <div key={note.id} className={`p-3.5 border rounded-xl transition-colors ${logRow}`}>
                                        <p className="text-[11px] font-black text-indigo-500 mb-1">
                                            {note.user?.name || 'Admin'} • {dateLabel ? new Date(dateLabel).toLocaleDateString() : ''}
                                        </p>
                                        <p className={`text-[13px] font-bold leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{note.note}</p>
                                        <p className={`text-[10px] font-black mt-1.5 ${subtext}`}>{updatedAt ? new Date(updatedAt).toLocaleString() : ''}</p>
                                    </div>
                                );
                            }) : (
                                <p className={`text-sm font-bold py-6 text-center ${subtext}`}>{t.noNotesYet}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* NTP Festival Guests */}
                <div className={`${card} rounded-[2.5rem] p-8 shadow-sm`}>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
                        <h3 className={`text-lg font-black ${heading} flex items-center gap-2`}>
                            <span className="text-amber-500 text-2xl">🎪</span> ضيوف مهرجان NTP
                        </h3>
                        <span className={`text-xs font-bold px-3 py-1 rounded-lg ${isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                            إجمالي المسجلين: {ntpGuests.length}
                        </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead>
                                <tr className={`text-[11px] font-black uppercase tracking-widest ${subtext} border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                                    <th className="py-4 px-4 font-black">الاسم</th>
                                    <th className="py-4 px-4 font-black">الكلية</th>
                                    <th className="py-4 px-4 font-black">التخصص</th>
                                    <th className="py-4 px-4 font-black">الخطة</th>
                                    <th className="py-4 px-4 font-black">وقت التسجيل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ntpGuests.map((guest) => (
                                    <tr key={guest.id} className={`border-b last:border-0 transition-colors ${isDark ? 'border-slate-700 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                        <td className={`py-4 px-4 font-bold text-sm ${heading}`}>{guest.name}</td>
                                        <td className={`py-4 px-4 font-bold text-xs ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{guest.college?.name || '—'}</td>
                                        <td className={`py-4 px-4 font-bold text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{guest.major?.name || '—'}</td>
                                        <td className={`py-4 px-4 font-black text-xs ${subtext}`}>الإصدار {guest.study_plan_version}</td>
                                        <td className={`py-4 px-4 font-bold text-[11px] ${subtext}`}>{new Date(guest.created_at).toLocaleString('ar-JO')}</td>
                                    </tr>
                                ))}
                                {ntpGuests.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className={`py-8 text-center text-sm font-bold ${subtext}`}>لا يوجد ضيوف مسجلين حتى الآن.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Bottom panels */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    <div className={`${card} rounded-[2rem] p-6 sm:p-7 shadow-sm`}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className={`text-lg font-black ${heading} flex items-center gap-2`}>🛠️ {t.latestReports}</h3>
                            <Link href={route('admin.issues.index')} className="text-xs font-black text-indigo-500 hover:underline">{t.viewAll}</Link>
                        </div>
                        <div className="space-y-3">
                            {safeRecentIssues.length > 0 ? safeRecentIssues.map((issue) => (
                                <div key={issue.id} className={`p-3.5 border rounded-xl transition-colors ${logRow}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className={`text-[13px] font-black ${heading}`}>#{issue.id} {issue.subject}</p>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${getStatusBadge(issue.status)}`}>{getStatusLabel(issue.status)}</span>
                                    </div>
                                    <p className={`text-[11px] font-bold ${subtext}`}>{issue.user?.name || t.unknown} • {new Date(issue.created_at).toLocaleString()}</p>
                                </div>
                            )) : <p className={`text-sm font-bold py-8 text-center ${subtext}`}>{t.noNewReports}</p>}
                        </div>
                    </div>

                    <div className={`${card} rounded-[2rem] p-6 sm:p-7 shadow-sm`}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className={`text-lg font-black ${heading} flex items-center gap-2`}>📜 {t.adminLog}</h3>
                            <span className={`text-xs font-black ${subtext}`}>{t.lastMoves(safeLogs.length)}</span>
                        </div>
                        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                            {safeLogs.length > 0 ? safeLogs.map((log) => (
                                <div key={log.id} className={`p-3.5 border rounded-xl transition-colors ${logRow}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-[11px] font-black text-indigo-500">{log.action}</p>
                                        <p className={`text-[10px] font-black ${subtext}`}>{new Date(log.created_at).toLocaleString()}</p>
                                    </div>
                                    <p className={`text-[13px] font-bold leading-relaxed mb-2 ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{log.details}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isDark ? 'bg-slate-700/50 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                            👤 {log.user?.name || 'System'}
                                        </span>
                                        {log.ip_address && (
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-md font-mono ${isDark ? 'bg-orange-900/30 text-orange-300 border border-orange-700/50' : 'bg-orange-50 text-orange-700 border border-orange-200'}`} dir="ltr">
                                                🌐 {log.ip_address}
                                            </span>
                                        )}
                                        {log.meta?.user_agent && (
                                            <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isDark ? 'bg-blue-900/30 text-blue-300 border border-blue-700/50' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                                {parseDevice(log.meta.user_agent)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )) : <p className={`text-sm font-bold py-8 text-center ${subtext}`}>{t.noLogEntries}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

/* ── Sub-components ── */

function StatCard({ title, value, icon, color, link = '#', trend, isDark, tLabel }) {
    const colors = {
        indigo: { gradient: 'from-indigo-500 to-blue-600', dot: 'text-indigo-500' },
        violet: { gradient: 'from-violet-500 to-purple-600', dot: 'text-violet-500' },
        emerald: { gradient: 'from-emerald-500 to-teal-600', dot: 'text-emerald-500' },
        rose: { gradient: 'from-rose-500 to-pink-600', dot: 'text-rose-500' },
        amber: { gradient: 'from-amber-500 to-orange-600', dot: 'text-amber-500' },
        slate: { gradient: 'from-slate-500 to-slate-700', dot: 'text-slate-500' },
    };
    const c = colors[color] || colors.slate;
    return (
        <Link href={link} className="block group">
            <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-all duration-300 group-hover:-translate-y-2 ${isDark ? 'bg-slate-800/60 border-slate-700 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)]' : 'bg-white border-slate-100 hover:shadow-xl'}`}>
                <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-gradient-to-br ${c.gradient} text-white shadow-lg transition-transform group-hover:rotate-6`}>{icon}</div>
                    <div className={`text-[8px] font-black uppercase tracking-widest mt-2 ${isDark ? 'text-slate-500' : 'text-slate-300'}`}>{tLabel}</div>
                </div>
                <h3 className={`text-4xl font-black tracking-tighter mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</h3>
                <p className={`text-[11px] font-black uppercase mb-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{title}</p>
                <div className={`flex items-center gap-1.5 pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-50'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-current ${c.dot}`}></span>
                    <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{trend}</span>
                </div>
            </div>
        </Link>
    );
}

function QuickLink({ title, icon, href, isDark }) {
    return (
        <Link href={href} className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${isDark ? 'bg-slate-800/50 border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800' : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'}`}>
            <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg group-hover:scale-110 transition-transform shrink-0">{icon}</span>
                <span className={`text-[11px] font-black truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{title}</span>
            </div>
            <span className={`transition-transform duration-300 text-xs font-black group-hover:translate-x-[-3px] shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`}>←</span>
        </Link>
    );
}