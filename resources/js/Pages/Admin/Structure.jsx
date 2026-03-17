import React from 'react';
import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';
import { useTheme } from '@/Contexts/ThemeContext';
import { useLanguage } from '@/Contexts/LanguageContext';

export default function AdminStructure({ auth, platform = {}, colleges = [], majors = [] }) {
    const { isDark } = useTheme();
    const { lang } = useLanguage();

    const tr = {
        ar: {
            pageTitle: 'إدارة الكليات والتخصصات | سنفور',
            header: '🏛️ إدارة الكليات والتخصصات',
            headerSub: 'صفحة مستقلة لإدارة الهيكل الأكاديمي للجامعة.',
            colleges: 'الكليات:', majors: 'التخصصات:',
            addCollege: '🏛️ إضافة كلية', addMajor: '🎓 إضافة تخصص',
            collegeName: 'اسم الكلية', collegePlaceholder: 'مثال: كلية تكنولوجيا المعلومات',
            saveCollege: 'حفظ الكلية', saving: 'جاري الحفظ...',
            searchCollege: 'ابحث عن كلية...', noColleges: 'لا توجد نتائج مطابقة.',
            parentCollege: 'الكلية التابعة', selectCollege: '-- اختر الكلية --',
            majorName: 'اسم التخصص', majorPlaceholder: 'مثال: علم الحاسوب',
            code: 'الرمز', saveMajor: 'حفظ التخصص', searchMajor: 'ابحث عن تخصص أو رمز...',
            noMajors: 'لا توجد نتائج مطابقة.',
        },
        en: {
            pageTitle: 'Colleges & Majors | Sanfoor',
            header: '🏛️ Colleges & Majors',
            headerSub: 'Standalone page to manage the university academic structure.',
            colleges: 'Colleges:', majors: 'Majors:',
            addCollege: '🏛️ Add College', addMajor: '🎓 Add Major',
            collegeName: 'College Name', collegePlaceholder: 'e.g. Faculty of Information Technology',
            saveCollege: 'Save College', saving: 'Saving...',
            searchCollege: 'Search for a college...', noColleges: 'No matching results.',
            parentCollege: 'Parent College', selectCollege: '-- Select College --',
            majorName: 'Major Name', majorPlaceholder: 'e.g. Computer Science',
            code: 'Code', saveMajor: 'Save Major', searchMajor: 'Search by name or code...',
            noMajors: 'No matching results.',
        },
    }[lang] || {};

    const [collegeQuery, setCollegeQuery] = React.useState('');
    const [majorQuery, setMajorQuery] = React.useState('');

    const visibleColleges = React.useMemo(() => {
        if (!collegeQuery) return colleges;
        return colleges.filter((college) => String(college.name || '').toLowerCase().includes(collegeQuery.toLowerCase()));
    }, [colleges, collegeQuery]);

    const visibleMajors = React.useMemo(() => {
        if (!majorQuery) return majors;
        return majors.filter((major) => {
            const name = String(major.name || '').toLowerCase();
            const code = String(major.code || '').toLowerCase();
            const q = majorQuery.toLowerCase();
            return name.includes(q) || code.includes(q);
        });
    }, [majors, majorQuery]);

    const {
        data: colData, setData: setColData, post: postCol,
        processing: colProcessing, errors: colErrors, reset: resetCol,
    } = useForm({ name: '' });

    const {
        data: majData, setData: setMajData, post: postMaj,
        processing: majProcessing, errors: majErrors, reset: resetMaj,
    } = useForm({ name: '', code: '', college_id: '' });

    const handleCollegeSubmit = (e) => {
        e.preventDefault();
        postCol(route('admin.colleges.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetCol('name');
                Swal.fire({ icon: 'success', title: lang === 'ar' ? 'تمت الإضافة' : 'Added', text: lang === 'ar' ? 'تم حفظ الكلية بنجاح' : 'College saved successfully.', timer: 1600, showConfirmButton: false });
            },
        });
    };

    const handleMajorSubmit = (e) => {
        e.preventDefault();
        postMaj(route('admin.majors.store'), {
            preserveScroll: true,
            onSuccess: () => {
                resetMaj('name', 'code');
                Swal.fire({ icon: 'success', title: lang === 'ar' ? 'تمت الإضافة' : 'Added', text: lang === 'ar' ? 'تم حفظ التخصص بنجاح' : 'Major saved successfully.', timer: 1600, showConfirmButton: false });
            },
        });
    };

    const card = isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200';
    const heading = isDark ? 'text-slate-100' : 'text-slate-800';
    const subtext = isDark ? 'text-slate-400' : 'text-slate-500';
    const inputCls = isDark
        ? 'bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:ring-indigo-500 focus:border-indigo-500'
        : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-indigo-500 focus:border-indigo-500';
    const labelCls = isDark ? 'text-slate-300' : 'text-slate-600';
    const listItem = isDark ? 'bg-slate-700/50 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-100 text-slate-600';

    return (
        <AdminLayout user={auth?.user}>
            <Head title={tr.pageTitle} />

            <div className="space-y-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <div className={`${card} rounded-[2rem] p-7 shadow-sm`}>
                    <h1 className={`text-2xl font-black ${heading} mb-2`}>{tr.header}</h1>
                    <p className={`text-sm font-bold ${subtext}`}>{tr.headerSub}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <span className={`text-xs font-black px-3 py-1 rounded-xl ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>{tr.colleges} {platform.colleges_count || 0}</span>
                        <span className={`text-xs font-black px-3 py-1 rounded-xl ${isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-50 text-violet-700'}`}>{tr.majors} {platform.majors_count || 0}</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* College Panel */}
                    <div className={`${card} rounded-[2rem] p-7 shadow-sm`}>
                        <h3 className={`text-lg font-black ${heading} flex items-center gap-2 mb-6`}>{tr.addCollege}</h3>
                        <form onSubmit={handleCollegeSubmit} className="space-y-4">
                            <div>
                                <label className={`text-[12px] font-bold ${labelCls} mb-1.5 block`}>{tr.collegeName}</label>
                                <input
                                    type="text"
                                    className={`w-full rounded-xl text-sm font-bold border ${inputCls}`}
                                    placeholder={tr.collegePlaceholder}
                                    value={colData.name}
                                    onChange={(e) => setColData('name', e.target.value)}
                                    required
                                />
                                {colErrors.name && <p className="text-[11px] font-bold text-rose-500 mt-1">{colErrors.name}</p>}
                            </div>
                            <button type="submit" disabled={colProcessing} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black transition-colors">
                                {colProcessing ? tr.saving : tr.saveCollege}
                            </button>
                        </form>
                        <div className={`mt-5 border-t pt-4 max-h-60 overflow-y-auto space-y-2 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <input type="text" value={collegeQuery} onChange={(e) => setCollegeQuery(e.target.value)} placeholder={tr.searchCollege}
                                className={`w-full rounded-xl text-sm font-bold border mb-2 ${inputCls}`} />
                            {visibleColleges.map((college) => (
                                <div key={college.id} className={`text-[12px] font-bold border rounded-lg px-3 py-2 ${listItem}`}>{college.name}</div>
                            ))}
                            {visibleColleges.length === 0 && <p className={`text-[12px] font-bold ${subtext}`}>{tr.noColleges}</p>}
                        </div>
                    </div>

                    {/* Major Panel */}
                    <div className={`${card} rounded-[2rem] p-7 shadow-sm`}>
                        <h3 className={`text-lg font-black ${heading} flex items-center gap-2 mb-6`}>{tr.addMajor}</h3>
                        <form onSubmit={handleMajorSubmit} className="space-y-4">
                            <div>
                                <label className={`text-[12px] font-bold ${labelCls} mb-1.5 block`}>{tr.parentCollege}</label>
                                <select className={`w-full rounded-xl text-sm font-bold border ${inputCls}`} value={majData.college_id}
                                    onChange={(e) => setMajData('college_id', e.target.value)} required>
                                    <option value="">{tr.selectCollege}</option>
                                    {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                                </select>
                                {majErrors.college_id && <p className="text-[11px] font-bold text-rose-500 mt-1">{majErrors.college_id}</p>}
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2">
                                    <label className={`text-[12px] font-bold ${labelCls} mb-1.5 block`}>{tr.majorName}</label>
                                    <input type="text" className={`w-full rounded-xl text-sm font-bold border ${inputCls}`} placeholder={tr.majorPlaceholder}
                                        value={majData.name} onChange={(e) => setMajData('name', e.target.value)} required />
                                    {majErrors.name && <p className="text-[11px] font-bold text-rose-500 mt-1">{majErrors.name}</p>}
                                </div>
                                <div className="col-span-1">
                                    <label className={`text-[12px] font-bold ${labelCls} mb-1.5 block`}>{tr.code}</label>
                                    <input type="text" dir="ltr" className={`w-full rounded-xl text-sm font-black text-center uppercase border ${inputCls}`} placeholder="CS"
                                        value={majData.code} onChange={(e) => setMajData('code', e.target.value.toUpperCase())} required />
                                    {majErrors.code && <p className="text-[11px] font-bold text-rose-500 mt-1">{majErrors.code}</p>}
                                </div>
                            </div>
                            <button type="submit" disabled={majProcessing} className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black transition-colors">
                                {majProcessing ? tr.saving : tr.saveMajor}
                            </button>
                        </form>
                        <div className={`mt-5 border-t pt-4 max-h-60 overflow-y-auto space-y-2 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <input type="text" value={majorQuery} onChange={(e) => setMajorQuery(e.target.value)} placeholder={tr.searchMajor}
                                className={`w-full rounded-xl text-sm font-bold border mb-2 ${inputCls}`} />
                            {visibleMajors.map((major) => (
                                <div key={major.id} className={`text-[12px] font-bold border rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${listItem}`}>
                                    <span>{major.name}</span>
                                    <span dir="ltr" className={`text-[10px] font-black ${subtext}`}>{major.code}</span>
                                </div>
                            ))}
                            {visibleMajors.length === 0 && <p className={`text-[12px] font-bold ${subtext}`}>{tr.noMajors}</p>}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
