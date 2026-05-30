import React, { useMemo, useState } from 'react';
import { Head, router, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

const translations = {
    ar: {
        pageTitle: '????? ?????? ???????? - Admin',
        heading: '????? ?????? ????????',
        subheading: '????? ?????? ????????? ???????? ??????? ???????? ????????.',
        searchPlaceholder: '???? ?????? ?? ?????? ??????????...',
        listedInstructors: '?????? ??????? ??????',
        taughtCourses: '???? ??????',
        avgGpa: '---',
        colInstructor: '???????',
        colMajor: '????? / ??????',
        colTaught: '??????',
        colAction: '?????',
        details: '????????',
        noInstructors: '?? ???? ?????? ??????? ?????.',
        courses: '????',
        tabTaught: '?? ?????? ????????',
        tabInfo: '?? ??????',
        editTitle: '????? ?????? ??????',
        emailLabel: '?????? ??????????',
        majorLabel: '?????',
        selectMajor: '???? ?????',
        saveChanges: '??? ?????????',
        noTaughtCourses: '?? ???? ???? ????? ???? ???????.',
        infoCardTitle: '?????? ??????? ???????',
        ipLabel: '??? IP ??????',
        regDate: '????? ???????',
        lastSeen: '??? ????',
        dangerZone: '??????? ????',
        deleteAccount: '??? ???? ???????',
        cancelEdit: '????? ???????',
        editData: '????? ????????',
        deleteTitle: '?? ??? ??????',
        deleteText: '???? ??? ???? ??????? ????? ?????? ???????!',
        deleteConfirm: '???? ???? ??????',
        cancel: '?????',
        updateSuccess: '?? ???????!',
        updateSuccessText: '?? ????? ?????? ??????? ?????.',
    },
    en: {
        pageTitle: 'Manage Instructors - Admin',
        heading: '????? Teaching Staff',
        subheading: 'Manage instructors accounts and their assigned courses.',
        searchPlaceholder: 'Search by name or email...',
        listedInstructors: 'Listed Instructors',
        taughtCourses: 'Taught Courses',
        avgGpa: '---',
        colInstructor: 'Instructor',
        colMajor: 'Department',
        colTaught: 'Courses',
        colAction: 'Action',
        details: 'Details',
        noInstructors: 'No instructors match the search.',
        courses: 'courses',
        tabTaught: '?? Taught Courses',
        tabInfo: '?? System',
        editTitle: 'Edit Account Data',
        emailLabel: 'Email',
        majorLabel: 'Department',
        selectMajor: 'Select Department',
        saveChanges: 'Save Changes',
        noTaughtCourses: 'No assigned courses.',
        infoCardTitle: 'Connection & Security Details',
        ipLabel: 'Last IP Address',
        regDate: 'Registration Date',
        lastSeen: 'Last Seen',
        dangerZone: 'Danger Zone',
        deleteAccount: 'Delete Instructor Account',
        cancelEdit: 'Cancel Edit',
        editData: 'Edit Data',
        deleteTitle: 'Are you sure?',
        deleteText: "Instructor's account and records will be deleted!",
        deleteConfirm: 'Yes, Delete Account',
        cancel: 'Cancel',
        updateSuccess: 'Updated!',
        updateSuccessText: "Instructor information has been updated successfully.",
    },
};

export default function AdminInstructors({ auth, instructors, filters, majors = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();
    const t = translations[lang] || translations.ar;

    const [search, setSearch] = useState(filters.search || '');
    const [selectedInstructor, setSelectedInstructor] = useState(null);
    const [activeTab, setActiveTab] = useState('taught');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', major_id: '' });

    const pageStats = useMemo(() => {
        const list = instructors?.data || [];
        const totalTaught = list.reduce((sum, i) => sum + Number(i?.taught_courses_count || 0), 0);

        return {
            listedInstructors: list.length,
            totalTaught,
        };
    }, [instructors]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
        router.get(route('admin.instructors.index'), { search: e.target.value }, { preserveState: true, replace: true });
    };

    const openProfile = (instructor) => {
        setSelectedInstructor(instructor);
        setEditForm({ 
            name: instructor.name, 
            email: instructor.email, 
            major_id: instructor.major_id || '',
        });
        setIsEditing(false);
        setActiveTab('taught');
        setIsSidebarOpen(true);
    };

    const handleUpdate = () => {
        router.put(route('admin.instructors.update', selectedInstructor.id), editForm, {
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
                router.delete(route('admin.instructors.destroy', id), {
                    onSuccess: () => setIsSidebarOpen(false)
                });
            }
        });
    };

    return (
        <AdminLayout user={auth.user}>
            <Head title={t.pageTitle} />
            
            <div className={`py-10 min-h-screen relative ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                
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
                            <span className={`absolute ${lang === 'ar' ? 'right-4' : 'left-4'} top-3.5 opacity-40`}>??</span>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.listedInstructors}</p>
                            <p className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{pageStats.listedInstructors}</p>
                        </div>
                        <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl p-4`}>
                            <p className={`text-[11px] font-black ${isDark ? 'text-slate-400' : 'text-slate-400'} mb-1`}>{t.taughtCourses}</p>
                            <p className="text-2xl font-black text-indigo-500">{pageStats.totalTaught}</p>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className={`${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'} border rounded-3xl shadow-sm overflow-hidden`}>
                        <div className="overflow-x-auto">
                            <table className={`w-full ${lang === 'ar' ? 'text-right' : 'text-left'} border-collapse`}>
                                <thead>
                                    <tr className={`${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50/80 border-slate-100'} border-b`}>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider`}>{t.colInstructor}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider`}>{t.colMajor}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider text-center`}>{t.colTaught}</th>
                                        <th className={`py-4 px-6 font-black ${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs uppercase tracking-wider text-center`}>{t.colAction}</th>
                                    </tr>
                                </thead>
                                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-slate-100'}`}>
                                    {instructors.data.map((instructor) => (
                                        <tr key={instructor.id} className={`transition-colors group ${isDark ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50/50'}`}>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center font-black text-sm shadow-sm uppercase">
                                                        {instructor.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} text-sm`}>{instructor.name}</p>
                                                        <p className="font-bold text-slate-400 text-[10px] dir-ltr text-left">{instructor.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={`py-4 px-6 font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'} text-xs`}>{instructor.major}</td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-2 py-1 ${isDark ? 'bg-indigo-900/30 text-indigo-300 border-indigo-800/50' : 'bg-indigo-50 text-indigo-600 border-indigo-200'} border rounded-md text-[11px] font-black`}>
                                                    {instructor.taught_courses_count} {t.courses}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button 
                                                    onClick={() => openProfile(instructor)}
                                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-black hover:bg-indigo-600 transition-colors shadow-sm"
                                                >
                                                    {t.details}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {instructors.data.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className={`py-12 text-center ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold`}>{t.noInstructors}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className={`p-4 border-t ${isDark ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50'} flex justify-center gap-2`}>
                            {instructors.links.map((link, i) => (
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

                {isSidebarOpen && (
                    <div className="fixed inset-0 z-[200] overflow-hidden">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>
                        
                        <div className={`absolute inset-y-0 left-0 w-full max-w-md ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} shadow-2xl flex flex-col animate-slideInLeft border-r`}>
                            
                            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-6 relative overflow-hidden shrink-0">
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/30 blur-2xl rounded-full"></div>
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <button 
                                        onClick={() => setIsEditing(!isEditing)} 
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-all ${isEditing ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-white/10 hover:bg-white/20'}`}
                                        title={isEditing ? t.cancelEdit : t.editData}
                                    >
                                        {isEditing ? '?' : '??'}
                                    </button>
                                    <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">?</button>
                                </div>

                                <div className="flex items-center gap-4 relative z-10 mt-4">
                                    <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-2xl shadow-inner backdrop-blur-md uppercase">
                                        {selectedInstructor?.name.charAt(0)}
                                    </div>
                                    <div className="text-white flex-1">
                                        {isEditing ? (
                                            <input 
                                                className="bg-white/10 border border-white/20 rounded-lg text-white font-black p-1.5 w-full text-lg outline-none focus:ring-1 focus:ring-indigo-400"
                                                value={editForm.name}
                                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            />
                                        ) : (
                                            <h2 className="text-xl font-black">{selectedInstructor?.name}</h2>
                                        )}
                                        <p className="text-indigo-200 font-bold text-xs mt-1">{selectedInstructor?.major}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-6 relative z-10">
                                    <div className="bg-white/10 border border-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                                        <p className="text-[9px] text-indigo-200 font-black uppercase mb-1">{t.taughtCourses}</p>
                                        <p className="text-lg font-black text-white">{selectedInstructor?.taught_courses_count}</p>
                                    </div>
                                    <div className="bg-white/10 border border-white/10 rounded-xl p-2.5 text-center backdrop-blur-md">
                                        <p className="text-[9px] text-indigo-200 font-black uppercase mb-1">??????</p>
                                        <p className="text-lg font-black text-emerald-400">???? ??????</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`flex border-b ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/80'} shrink-0 p-2 gap-1`}>
                                <button onClick={() => setActiveTab('taught')} className={`flex-1 py-2 rounded-lg text-[11px] font-black transition-all ${activeTab === 'taught' ? isDark ? 'bg-slate-700 text-indigo-400 border border-slate-600' : 'bg-white text-indigo-600 shadow-sm border border-slate-200' : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-500 hover:bg-slate-100'}`}>{t.tabTaught}</button>
                                <button onClick={() => setActiveTab('info')} className={`flex-1 py-2 rounded-lg text-[11px] font-black transition-all ${activeTab === 'info' ? isDark ? 'bg-slate-700 text-indigo-400 border border-slate-600' : 'bg-white text-indigo-600 shadow-sm border border-slate-200' : isDark ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-500 hover:bg-slate-100'}`}>{t.tabInfo}</button>
                            </div>

                            <div className={`flex-1 overflow-y-auto p-5 ${isDark ? 'bg-slate-900/80' : 'bg-slate-50'}`}>
                                
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
                                                    disabled
                                                />
                                                <small className="text-rose-500">?????? ?????????? ???? ?? Microsoft? ??? ???? ??????.</small>
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
                                        {activeTab === 'taught' && (
                                            <div className="space-y-3">
                                                {selectedInstructor?.taught_courses?.length > 0 ? (
                                                    selectedInstructor.taught_courses.map(course => (
                                                        <div key={course.id} className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-3 rounded-xl shadow-sm flex justify-between items-center`}>
                                                            <div>
                                                                <h4 className={`font-black ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs mb-1`}>{course.name}</h4>
                                                                <p className="text-[9px] font-bold text-slate-400">{course.code} • {course.credit_hours} ?????</p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className={`text-center py-10 ${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold text-xs`}>{t.noTaughtCourses}</div>
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'info' && (
                                            <div className="space-y-4">
                                                <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border p-4 rounded-2xl shadow-sm`}>
                                                    <h4 className={`text-xs font-black ${isDark ? 'text-slate-200 border-slate-700' : 'text-slate-800 border-slate-100'} border-b pb-2 mb-3`}>{t.infoCardTitle}</h4>
                                                    
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.ipLabel}:</span>
                                                            <span className={`text-xs font-black font-mono ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-700'} px-2 py-0.5 rounded`}>{selectedInstructor?.ip_address}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.regDate}:</span>
                                                            <span className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{selectedInstructor?.created_at}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t.lastSeen}:</span>
                                                            <span className="text-[11px] font-bold text-emerald-500">{selectedInstructor?.last_login}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className={`${isDark ? 'bg-rose-950/20 border-rose-900/30' : 'bg-rose-50 border-rose-100'} border p-4 rounded-2xl`}>
                                                    <h4 className={`text-xs font-black ${isDark ? 'text-rose-400' : 'text-rose-800'} mb-2`}>{t.dangerZone}</h4>
                                                    <button 
                                                        onClick={() => handleDelete(selectedInstructor.id)}
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

