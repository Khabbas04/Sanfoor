import React, { useMemo, useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const translations = {
    ar: {
        pageTitle: 'إدارة الطلاب - Admin',
        heading: '👨‍🎓 قاعدة بيانات الطلاب',
        subheading: 'إدارة السجلات الأكاديمية، تتبع المحاكي، ومعلومات النظام.',
        searchPlaceholder: 'ابحث بالاسم أو البريد الإلكتروني...',
        listedStudents: 'طلاب معروضون حالياً',
        cartCourses: 'مواد داخل المحاكيات',
        avgGpa: 'متوسط المعدل (القائمة)',
        colStudent: 'الطالب',
        colMajor: 'التخصص',
        colGpa: 'المعدل',
        colHours: 'الساعات',
        colCart: 'المحاكي',
        colAction: 'إجراء',
        details: 'التفاصيل',
        noStudents: 'لا يوجد طلاب مطابقين للبحث.',
        courses: 'مواد',
        tabPassed: '✅ المنجزة',
        tabCart: '🛒 المحاكي',
        tabInfo: '💻 النظام',
        editTitle: 'تعديل بيانات الحساب',
        emailLabel: 'البريد الإلكتروني',
        majorLabel: 'التخصص',
        selectMajor: 'اختر التخصص',
        saveChanges: 'حفظ التغييرات',
        noPassedCourses: 'لا يوجد مواد منجزة لهذا الطالب.',
        emptyCart: 'المحاكي فارغ حالياً.',
        infoCardTitle: 'تفاصيل الاتصال والأمان',
        ipLabel: 'رقم IP الأخير',
        regDate: 'تاريخ التسجيل',
        lastSeen: 'آخر ظهور',
        dangerZone: 'إجراءات خطرة',
        deleteAccount: 'حذف حساب الطالب',
        stats_gpa: 'المعدل',
        stats_hours: 'الساعات',
        stats_cart: 'بالمحاكي',
        cancelEdit: 'إلغاء التعديل',
        editData: 'تعديل البيانات',
        gradeLabel: 'ناجح',
        semesterLabel: 'فصل',
        creditHoursLabel: 'ساعات',
        deleteTitle: 'هل أنت متأكد؟',
        deleteText: 'سيتم حذف حساب الطالب وكافة سجلاته نهائياً!',
        deleteConfirm: 'نعم، احذف الحساب',
        cancel: 'إلغاء',
        updateSuccess: 'تم التحديث!',
        updateSuccessText: 'تم تعديل بيانات الطالب بنجاح.',
    },
    en: {
        pageTitle: 'Manage Students - Admin',
        heading: '👨‍🎓 Student Database',
        subheading: 'Manage academic records, simulator tracking, and system information.',
        searchPlaceholder: 'Search by name or email...',
        listedStudents: 'Currently Listed Students',
        cartCourses: 'Courses in Simulators',
        avgGpa: 'Avg GPA (List)',
        colStudent: 'Student',
        colMajor: 'Major',
        colGpa: 'GPA',
        colHours: 'Hours',
        colCart: 'Simulator',
        colAction: 'Action',
        details: 'Details',
        noStudents: 'No students match the search.',
        courses: 'courses',
        tabPassed: '✅ Passed',
        tabCart: '🛒 Simulator',
        tabInfo: '💻 System',
        editTitle: 'Edit Account Data',
        emailLabel: 'Email',
        majorLabel: 'Major',
        selectMajor: 'Select Major',
        saveChanges: 'Save Changes',
        noPassedCourses: 'No passed courses for this student.',
        emptyCart: 'The simulator is currently empty.',
        infoCardTitle: 'Connection & Security Details',
        ipLabel: 'Last IP Address',
        regDate: 'Registration Date',
        lastSeen: 'Last Seen',
        dangerZone: 'Danger Zone',
        deleteAccount: 'Delete Student Account',
        stats_gpa: 'GPA',
        stats_hours: 'Hours',
        stats_cart: 'In Cart',
        cancelEdit: 'Cancel Edit',
        editData: 'Edit Data',
        gradeLabel: 'Passed',
        semesterLabel: 'Semester',
        creditHoursLabel: 'credits',
        deleteTitle: 'Are you sure?',
        deleteText: "The student's account and all records will be permanently deleted!",
        deleteConfirm: 'Yes, Delete Account',
        cancel: 'Cancel',
        updateSuccess: 'Updated!',
        updateSuccessText: "Student's information has been updated successfully.",
    },
};

export default function AdminStudents({ auth, students, filters, majors = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;

    const [search, setSearch] = useState(filters.search || '');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [activeTab, setActiveTab] = useState('passed'); // passed, cart, info
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // 🔥 حالات التعديل الجديدة 🔥
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', major_id: '' });

    const pageStats = useMemo(() => {
        const list = students?.data || [];
        const totalCartCourses = list.reduce((sum, s) => sum + Number(s?.stats?.cart_courses_count || 0), 0);
        const avgGpaRaw = list.length
            ? list.reduce((sum, s) => sum + Number(s?.stats?.gpa || 0), 0) / list.length
            : 0;

        return {
            listedStudents: list.length,
            totalCartCourses,
            avgGpa: avgGpaRaw.toFixed(1),
        };
    }, [students]);

    // دالة البحث
    const handleSearch = (e) => {
        setSearch(e.target.value);
        router.get(route('admin.students.index'), { search: e.target.value }, { preserveState: true, replace: true });
    };

    // فتح ملف الطالب
    const openStudentProfile = (student) => {
        setSelectedStudent(student);
        // تعبئة بيانات الفورم عند فتح الملف
        setEditForm({ 
            name: student.name, 
            email: student.email, 
            major_id: student.major_id || '' 
        });
        setIsEditing(false);
        setActiveTab('passed');
        setIsSidebarOpen(true);
    };

    // 🔥 دالة حفظ التعديلات 🔥
    const handleUpdate = () => {
        router.put(route('admin.students.update', selectedStudent.id), editForm, {
            onSuccess: () => {
                setIsEditing(false);
                Swal.fire({
                    icon: 'success',
                    title: t.updateSuccess,
                    text: t.updateSuccessText,
                    confirmButtonColor: '#4f46e5'
                });
            }
        });
    };

    // 🔥 دالة الحذف 🔥
    const handleDelete = (id) => {
        Swal.fire({
            title: t.deleteTitle,
            text: t.deleteText,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            confirmButtonText: t.deleteConfirm,
            cancelButtonText: t.cancel
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('admin.students.destroy', id), {
                    onSuccess: () => setIsSidebarOpen(false)
                });
            }
        });
    };

    // ألوان العلامات
    const getBadgeColor = (grade) => {
        const val = parseFloat(grade);
        if (isNaN(val) || val === 0) return 'bg-slate-100 text-slate-500 border-slate-200';
        if (val >= 84) return 'bg-emerald-100 text-emerald-700 border-emerald-200'; 
        if (val >= 76) return 'bg-blue-100 text-blue-700 border-blue-200'; 
        if (val >= 68) return 'bg-indigo-100 text-indigo-700 border-indigo-200'; 
        if (val >= 60) return 'bg-amber-100 text-amber-700 border-amber-200'; 
        return 'bg-rose-100 text-rose-700 border-rose-200'; 
    };

    return (
        <AdminLayout user={auth.user}>
            <Head title={t.pageTitle} />
            
            <div className={`py-10 min-h-screen relative ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                
                {/* ════════════════════════════════════
                    1. HEADER & SEARCH
                ════════════════════════════════════ */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sticky top-24 z-20">
                    <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4 shadow-sm`}>
                        <div>
                            <h1 className={`text-3xl font-[900] ${isDark ? 'text-slate-100' : 'text-slate-900'} tracking-tight flex items-center gap-3`}>{t.heading}</h1>
                            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} font-bold mt-1 text-sm`}>{t.subheading}</p>
                        </div>
                        
                        <div className="relative w-full md:w-96">
                            <input 
                                type="text" 
                                placeholder={t.searchPlaceholder}
                                value={search}
                                onChange={handleSearch}
                                className={`w-full border rounded-xl py-3 ${lang === 'ar' ? 'pr-10 pl-4' : 'pl-10 pr-4'} font-bold text-sm shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800'}`}
                            />
                            <span className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-3.5 opacity-40`}>🔍</span>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.listedStudents}</p>
                            <p className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{pageStats.listedStudents}</p>
                        </div>
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.cartCourses}</p>
                            <p className="text-2xl font-black text-amber-500">{pageStats.totalCartCourses}</p>
                        </div>
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.avgGpa}</p>
                            <p className="text-2xl font-black text-indigo-500">{pageStats.avgGpa}%</p>
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════════
                    2. STUDENTS TABLE
                ════════════════════════════════════ */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-3xl shadow-sm overflow-hidden`}>
                        <div className="overflow-x-auto">
                            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} border-collapse`}>
                                <thead>
                                    <tr className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50/80 border-slate-100'} border-b`}>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider`}>{t.colStudent}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider`}>{t.colMajor}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider text-center`}>{t.colGpa}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider text-center`}>{t.colHours}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider text-center`}>{t.colCart}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider text-center`}>{t.colAction}</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                    {students.data.map((student) => (
                                        <tr key={student.id} className={`transition-colors group ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/50'}`}>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center font-black text-sm shadow-sm uppercase">
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} text-sm`}>{student.name}</p>
                                                        <p className="font-bold text-slate-400 text-[10px] dir-ltr text-left">{student.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`py-4 px-6 font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} text-xs`}>{student.major}</td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-black border ${getBadgeColor(student.stats.gpa)}`}>
                                                    {student.stats.gpa > 0 ? `${student.stats.gpa}%` : '---'}
                                                </span>
                                            </td>
                                            <td className={`py-4 px-6 text-center font-black ${isDark ? 'text-slate-300' : 'text-slate-700'} text-sm`}>
                                                {student.stats.total_passed_credits}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-2 py-1 ${isDark ? 'bg-amber-900/30 text-amber-300 border-amber-800/50' : 'bg-amber-50 text-amber-600 border-amber-200'} border rounded-md text-[11px] font-black`}>
                                                    {student.stats.cart_courses_count} {t.courses}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button 
                                                    onClick={() => openStudentProfile(student)}
                                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-black hover:bg-indigo-600 transition-colors shadow-sm"
                                                >
                                                    {t.details}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {students.data.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className={`py-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold`}>{t.noStudents}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Paginator */}
                        <div className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'} flex justify-center gap-2`}>
                            {students.links.map((link, i) => (
                                <Link 
                                    key={i} 
                                    href={link.url || '#'} 
                                    className={`px-3 py-1 text-xs font-bold rounded-lg border ${link.active ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : isDark ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ════════════════════════════════════
                    3. STUDENT PROFILE SLIDE-OVER (SIDEBAR)
                ════════════════════════════════════ */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-[200] overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>
                        
                        <div className="absolute inset-y-0 left-0 w-full max-w-md bg-white shadow-2xl flex flex-col animate-slideInLeft border-r border-slate-200">
                                                    <div className={`absolute inset-y-0 left-0 w-full max-w-md ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} shadow-2xl flex flex-col animate-slideInLeft border-r`}>
                            
                            {/* هيدر اللوحة */}
                            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 relative overflow-hidden shrink-0">
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/30 blur-2xl rounded-full"></div>
                                <div className="absolute top-4 left-4 flex gap-2">
                                    {/* 🔥 زر التعديل الجديد 🔥 */}
                                    <button 
                                        onClick={() => setIsEditing(!isEditing)} 
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all ${isEditing ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-white/10 hover:bg-white/20'}`}
                                        title={isEditing ? t.cancelEdit : t.editData}
                                    >
                                        {isEditing ? '✓' : '✏️'}
                                    </button>
                                    <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">✕</button>
                                </div>

                                <div className="flex items-center gap-4 relative z-10 mt-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-2xl shadow-inner backdrop-blur-md uppercase">
                                        {selectedStudent?.name.charAt(0)}
                                    </div>
                                    <div className="text-white flex-1">
                                        {isEditing ? (
                                            <input 
                                                className="bg-white/10 border border-white/20 rounded-lg text-white font-black p-1.5 w-full text-lg outline-none focus:ring-1 focus:ring-indigo-400"
                                                value={editForm.name}
                                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            />
                                        ) : (
                                            <h2 className="text-xl font-black">{selectedStudent?.name}</h2>
                                        )}
                                        <p className="text-indigo-200 font-bold text-xs mt-1">{selectedStudent?.major}</p>
                                    </div>
                                </div>

                                {/* إحصائيات سريعة */}
                                <div className="grid grid-cols-3 gap-2 mt-6 relative z-10">
                                    <div className="bg-white/10 border border-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                                        <p className="text-[9px] text-indigo-200 font-black uppercase mb-1">المعدل</p>
                                        <p className="text-lg font-black text-white">{selectedStudent?.stats.gpa}%</p>
                                    </div>
                                    <div className="bg-white/10 border border-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                                        <p className="text-[9px] text-indigo-200 font-black uppercase mb-1">الساعات</p>
                                        <p className="text-lg font-black text-emerald-400">{selectedStudent?.stats.total_passed_credits}</p>
                                    </div>
                                    <div className="bg-white/10 border border-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                                        <p className="text-[9px] text-indigo-200 font-black uppercase mb-1">بالمحاكي</p>
                                        <p className="text-lg font-black text-amber-400">{selectedStudent?.stats.cart_courses_count}</p>
                                    </div>
                                </div>
                            </div>

                            {/* تبويبات اللوحة */}
                            <div className={`flex border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/80'} shrink-0 p-2 gap-1`}>
                                <button onClick={() => setActiveTab('passed')} className={`flex-1 py-2 rounded-lg text-[11px] font-black transition-all ${activeTab === 'passed' ? isDark ? 'bg-slate-700 text-emerald-400 border border-slate-600' : 'bg-white text-emerald-600 shadow-sm border border-slate-200' : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-500 hover:bg-slate-100'}`}>{t.tabPassed}</button>
                                <button onClick={() => setActiveTab('cart')} className={`flex-1 py-2 rounded-lg text-[11px] font-black transition-all ${activeTab === 'cart' ? isDark ? 'bg-slate-700 text-amber-400 border border-slate-600' : 'bg-white text-amber-600 shadow-sm border border-slate-200' : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-500 hover:bg-slate-100'}`}>{t.tabCart}</button>
                                <button onClick={() => setActiveTab('info')} className={`flex-1 py-2 rounded-lg text-[11px] font-black transition-all ${activeTab === 'info' ? isDark ? 'bg-slate-700 text-indigo-400 border border-slate-600' : 'bg-white text-indigo-600 shadow-sm border border-slate-200' : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-500 hover:bg-slate-100'}`}>{t.tabInfo}</button>
                            </div>

                            {/* محتوى اللوحة */}
                            <div className={`flex-1 overflow-y-auto p-5 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50'}`}>
                                
                                {/* 🔥 وضع التعديل (Edit Mode) 🔥 */}
                                {isEditing ? (
                                    <div className="space-y-5 animate-slideDown">
                                        <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-4 rounded-2xl shadow-sm space-y-4`}>
                                            <h4 className={`text-xs font-black ${isDark ? 'text-slate-200 border-slate-700' : 'text-slate-800 border-slate-200'} border-b pb-2`}>{t.editTitle}</h4>
                                            
                                            <div>
                                                <label className={`text-[10px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} block mb-1`}>{t.emailLabel}</label>
                                                <input 
                                                    className={`w-full border rounded-xl font-bold p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-slate-200 text-slate-800'}`}
                                                    value={editForm.email}
                                                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                                                />
                                            </div>

                                            <div>
                                                <label className={`text-[10px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} block mb-1`}>{t.majorLabel}</label>
                                                <select 
                                                    className={`w-full border rounded-xl font-bold p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none ${isDark ? 'bg-slate-700 border-slate-600 text-slate-100' : 'border-slate-200 text-slate-800'}`}
                                                    value={editForm.major_id}
                                                    onChange={e => setEditForm({...editForm, major_id: e.target.value})}
                                                >
                                                    <option value="">{t.selectMajor}</option>
                                                    {majors.map(m => (
                                                        <option key={m.id} value={m.id}>{m.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleUpdate}
                                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
                                        >
                                            {t.saveChanges}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* 1. المواد المنجزة */}
                                        {activeTab === 'passed' && (
                                            <div className="space-y-3">
                                                {selectedStudent?.passed_courses?.length > 0 ? (
                                                    selectedStudent.passed_courses.map(course => (
                                                        <div key={course.id} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-3 rounded-xl shadow-sm flex justify-between items-center`}>
                                                            <div>
                                                                <h4 className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs mb-1`}>{course.name}</h4>
                                                                <p className="text-[9px] font-bold text-slate-400">{course.code} • {course.credit_hours} {t.creditHoursLabel}</p>
                                                            </div>
                                                            <div className="text-left">
                                                                <span className={`px-2 py-1 rounded text-[10px] font-black border ${getBadgeColor(course.pivot?.grade)}`}>
                                                                    {course.pivot?.grade ? `${course.pivot.grade}%` : t.gradeLabel}
                                                                </span>
                                                                <p className="text-[8px] font-bold text-slate-400 mt-1">{t.semesterLabel} {course.pivot?.studied_semester || 1}</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className={`text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold text-xs`}>{t.noPassedCourses}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* 2. مواد المحاكي */}
                                        {activeTab === 'cart' && (
                                            <div className="space-y-3">
                                                {selectedStudent?.cart_courses?.length > 0 ? (
                                                    selectedStudent.cart_courses.map(course => (
                                                        <div key={course.id} className={`${isDark ? 'bg-amber-900/10 border-amber-800/30' : 'bg-amber-50/30 border-amber-100'} border p-3 rounded-xl shadow-sm flex justify-between items-center`}>
                                                            <div>
                                                                <h4 className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs mb-1`}>{course.name}</h4>
                                                                <p className="text-[9px] font-bold text-slate-400">{course.code} • {course.credit_hours} {t.creditHoursLabel}</p>
                                                            </div>
                                                            <span className="text-amber-500 text-xs">🛒</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className={`text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold text-xs`}>{t.emptyCart}</div>
                                                )}
                                            </div>
                                        )}

                                        {/* 3. بيانات النظام و الـ IP */}
                                        {activeTab === 'info' && (
                                            <div className="space-y-4">
                                                <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-4 rounded-2xl shadow-sm`}>
                                                    <h4 className={`text-xs font-black ${isDark ? 'text-slate-200 border-slate-700' : 'text-slate-800 border-slate-100'} border-b pb-2 mb-3`}>{t.infoCardTitle}</h4>
                                                    
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.ipLabel}:</span>
                                                            <span className={`text-xs font-black font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'} px-2 py-0.5 rounded`}>{selectedStudent?.ip_address}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.regDate}:</span>
                                                            <span className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{selectedStudent?.created_at}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.lastSeen}:</span>
                                                            <span className="text-[11px] font-bold text-emerald-500">{selectedStudent?.last_login}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={`${isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50 border-rose-100'} border p-4 rounded-2xl`}>
                                                    <h4 className={`text-xs font-black ${isDark ? 'text-rose-400' : 'text-rose-800'} mb-2`}>{t.dangerZone}</h4>
                                                    <button 
                                                        onClick={() => handleDelete(selectedStudent.id)}
                                                        className={`w-full py-2.5 ${isDark ? 'bg-slate-800 border-rose-800/50 text-rose-400 hover:bg-rose-600 hover:text-white' : 'bg-white border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white'} border text-[11px] font-black rounded-xl transition-colors`}
                                                    >
                                                        {t.deleteAccount}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
            

        </AdminLayout>
    );
}