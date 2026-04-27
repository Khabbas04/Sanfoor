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

    const [editingCollegeId, setEditingCollegeId] = React.useState(null);
    const [editingMajorId, setEditingMajorId] = React.useState(null);

    const {
        data: colData, setData: setColData, post: postCol, put: putCol, delete: delCol,
        processing: colProcessing, errors: colErrors, reset: resetCol,
    } = useForm({ name: '' });

    const {
        data: majData, setData: setMajData, post: postMaj, put: putMaj, delete: delMaj,
        processing: majProcessing, errors: majErrors, reset: resetMaj,
    } = useForm({ name: '', code: '', college_id: '' });

    const handleCollegeSubmit = (e) => {
        e.preventDefault();
        if (editingCollegeId) {
            putCol(route('admin.colleges.quick_update', editingCollegeId), {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingCollegeId(null);
                    resetCol('name');
                    Swal.fire({ icon: 'success', title: lang === 'ar' ? 'تم التحديث' : 'Updated', text: lang === 'ar' ? 'تم تحديث الكلية بنجاح' : 'College updated successfully.', timer: 1600, showConfirmButton: false });
                },
            });
        } else {
            postCol(route('admin.colleges.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    resetCol('name');
                    Swal.fire({ icon: 'success', title: lang === 'ar' ? 'تمت الإضافة' : 'Added', text: lang === 'ar' ? 'تم حفظ الكلية بنجاح' : 'College saved successfully.', timer: 1600, showConfirmButton: false });
                },
            });
        }
    };

    const handleMajorSubmit = (e) => {
        e.preventDefault();
        if (editingMajorId) {
            putMaj(route('admin.majors.quick_update', editingMajorId), {
                preserveScroll: true,
                onSuccess: () => {
                    setEditingMajorId(null);
                    resetMaj('name', 'code', 'college_id');
                    Swal.fire({ icon: 'success', title: lang === 'ar' ? 'تم التحديث' : 'Updated', text: lang === 'ar' ? 'تم تحديث التخصص بنجاح' : 'Major updated successfully.', timer: 1600, showConfirmButton: false });
                },
            });
        } else {
            postMaj(route('admin.majors.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    resetMaj('name', 'code', 'college_id');
                    Swal.fire({ icon: 'success', title: lang === 'ar' ? 'تمت الإضافة' : 'Added', text: lang === 'ar' ? 'تم حفظ التخصص بنجاح' : 'Major saved successfully.', timer: 1600, showConfirmButton: false });
                },
            });
        }
    };

    const editCollege = (college) => {
        setEditingCollegeId(college.id);
        setColData('name', college.name);
    };

    const cancelEditCollege = () => {
        setEditingCollegeId(null);
        resetCol('name');
    };

    const deleteCollege = (id) => {
        Swal.fire({
            title: lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
            text: lang === 'ar' ? 'سيتم حذف الكلية وكافة البيانات المرتبطة بها!' : 'This will delete the college and all related data!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: lang === 'ar' ? 'نعم، احذف' : 'Yes, delete',
            cancelButtonText: lang === 'ar' ? 'إلغاء' : 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                delCol(route('admin.colleges.quick_destroy', id), { preserveScroll: true });
            }
        });
    };

    const editMajor = (major) => {
        setEditingMajorId(major.id);
        setMajData({
            name: major.name,
            code: major.code,
            college_id: major.college_id
        });
    };

    const cancelEditMajor = () => {
        setEditingMajorId(null);
        resetMaj('name', 'code', 'college_id');
    };

    const deleteMajor = (id) => {
        Swal.fire({
            title: lang === 'ar' ? 'هل أنت متأكد؟' : 'Are you sure?',
            text: lang === 'ar' ? 'سيتم حذف التخصص والمواد المرتبطة به!' : 'This will delete the major and related courses!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: lang === 'ar' ? 'نعم، احذف' : 'Yes, delete',
            cancelButtonText: lang === 'ar' ? 'إلغاء' : 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                delMaj(route('admin.majors.quick_destroy', id), { preserveScroll: true });
            }
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
                        <h3 className={`text-lg font-black ${heading} flex items-center gap-2 mb-6`}>
                            {editingCollegeId ? (lang === 'ar' ? '✏️ تعديل كلية' : '✏️ Edit College') : tr.addCollege}
                        </h3>
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
                            <div className="flex gap-2">
                                <button type="submit" disabled={colProcessing} className={`flex-1 ${editingCollegeId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black transition-colors`}>
                                    {colProcessing ? tr.saving : (editingCollegeId ? (lang === 'ar' ? 'تحديث' : 'Update') : tr.saveCollege)}
                                </button>
                                {editingCollegeId && (
                                    <button type="button" onClick={cancelEditCollege} className="px-5 bg-slate-500 text-white rounded-xl text-sm font-black">
                                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        </form>
                        <div className={`mt-5 border-t pt-4 max-h-80 overflow-y-auto space-y-2 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <input type="text" value={collegeQuery} onChange={(e) => setCollegeQuery(e.target.value)} placeholder={tr.searchCollege}
                                className={`w-full rounded-xl text-sm font-bold border mb-2 ${inputCls}`} />
                            {visibleColleges.map((college) => (
                                <div key={college.id} className={`text-[12px] font-bold border rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${listItem}`}>
                                    <span>{college.name}</span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => editCollege(college)} className="p-1.5 bg-amber-500/10 text-amber-600 rounded-md hover:bg-amber-500 hover:text-white transition-colors">✏️</button>
                                        <button onClick={() => deleteCollege(college.id)} className="p-1.5 bg-rose-500/10 text-rose-600 rounded-md hover:bg-rose-500 hover:text-white transition-colors">🗑️</button>
                                    </div>
                                </div>
                            ))}
                            {visibleColleges.length === 0 && <p className={`text-[12px] font-bold ${subtext}`}>{tr.noColleges}</p>}
                        </div>
                    </div>

                    {/* Major Panel */}
                    <div className={`${card} rounded-[2rem] p-7 shadow-sm`}>
                        <h3 className={`text-lg font-black ${heading} flex items-center gap-2 mb-6`}>
                            {editingMajorId ? (lang === 'ar' ? '✏️ تعديل تخصص' : '✏️ Edit Major') : tr.addMajor}
                        </h3>
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
                            <div className="flex gap-2">
                                <button type="submit" disabled={majProcessing} className={`flex-1 ${editingMajorId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-violet-600 hover:bg-violet-700'} disabled:opacity-60 text-white py-3 rounded-xl text-sm font-black transition-colors`}>
                                    {majProcessing ? tr.saving : (editingMajorId ? (lang === 'ar' ? 'تحديث' : 'Update') : tr.saveMajor)}
                                </button>
                                {editingMajorId && (
                                    <button type="button" onClick={cancelEditMajor} className="px-5 bg-slate-500 text-white rounded-xl text-sm font-black">
                                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                                    </button>
                                )}
                            </div>
                        </form>
                        <div className={`mt-5 border-t pt-4 max-h-80 overflow-y-auto space-y-2 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                            <input type="text" value={majorQuery} onChange={(e) => setMajorQuery(e.target.value)} placeholder={tr.searchMajor}
                                className={`w-full rounded-xl text-sm font-bold border mb-2 ${inputCls}`} />
                            {visibleMajors.map((major) => (
                                <div key={major.id} className={`text-[12px] font-bold border rounded-lg px-3 py-2 flex items-center justify-between gap-2 ${listItem}`}>
                                    <div className="flex flex-col">
                                        <span>{major.name}</span>
                                        <span dir="ltr" className={`text-[9px] font-black opacity-50`}>{major.code}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => editMajor(major)} className="p-1.5 bg-amber-500/10 text-amber-600 rounded-md hover:bg-amber-500 hover:text-white transition-colors">✏️</button>
                                        <button onClick={() => deleteMajor(major.id)} className="p-1.5 bg-rose-500/10 text-rose-600 rounded-md hover:bg-rose-500 hover:text-white transition-colors">🗑️</button>
                                    </div>
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
