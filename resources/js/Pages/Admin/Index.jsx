import React, { useState, useMemo } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';

export default function AdminIndex({ courses, universities, colleges, majors, logs }) {

    const [selectedIds, setSelectedIds] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeMajorFilter, setActiveMajorFilter] = useState('');
    const [editingCourse, setEditingCourse] = useState(null);

    const { data, setData, post, put, processing, reset, errors, clearErrors } = useForm({
        id: null,
        college_id: '',
        major_id: '',
        name: '',
        code: '',
        credit_hours: 3,
        minimum_passed_hours: '',
        type: 'compulsory', // الأنواع: compulsory, elective, supporting, university_req
        prerequisite_id: '',
        study_plan_version: '12',
        semester: 1, // هذا هو مستوى العقدة (Node Level)
        description: '', 
    });

    const { data: fileData, setData: setFileData, post: postFile, processing: fileProcessing, reset: resetFile } = useForm({
        csv_file: null,
        college_id: '',
        major_id: '',
        study_plan_version: '12',
    });

    const { data: colData, setData: setColData, post: postCol, processing: colProc, reset: resetCol } = useForm({
        name: '',
        university_id: (universities && universities.length > 0) ? universities[0].id : '',
    });

    const { data: majData, setData: setMajData, post: postMaj, processing: majProc, reset: resetMaj, errors: majErr } = useForm({
        name: '',
        code: '',
        college_id: '',
    });

    const safeColleges = colleges || [];
    const safeMajors = majors || [];
    const safeCourses = courses || [];

    const kpi = useMemo(() => ({
        totalCourses: safeCourses.length,
        filteredCourses: safeCourses.filter(c => {
            if (!activeMajorFilter) return true;
            if (activeMajorFilter === 'general') return c.major_id === null;
            return c.major_id == activeMajorFilter;
        }).length,
        selectedCount: selectedIds.length,
    }), [safeCourses, activeMajorFilter, selectedIds.length]);

  // ✅ تم إلغاء فلتر الجامعة لعرض كافة الكليات فوراً
const filteredManualColleges = safeColleges; 
const filteredManualMajors = safeMajors.filter(m => m.college_id == data.college_id);

// ✅ تم إلغاء فلتر الجامعة هنا أيضاً
const filteredImportColleges = safeColleges; 
const filteredImportMajors = safeMajors.filter(m => m.college_id == fileData.college_id);

    const filteredCourses = useMemo(() => {
        let result = safeCourses;
        if (activeMajorFilter) {
            if (activeMajorFilter === 'general') result = result.filter(c => c.major_id === null);
            else result = result.filter(c => c.major_id == activeMajorFilter);
        }
        if (searchQuery) {
            result = result.filter(c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.code.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return result;
    }, [searchQuery, safeCourses, activeMajorFilter]);

    const availablePrerequisites = useMemo(() => {
        const selectedMajor = data.major_id ? String(data.major_id) : null;
        const selectedPlan = String(data.study_plan_version || '12');

        return safeCourses.filter(c => {
            if (editingCourse && c.id === editingCourse.id) return false;

            const courseMajor = c.major_id ? String(c.major_id) : null;
            const coursePlan = String(c.study_plan_version || '12');

            return courseMajor === selectedMajor && coursePlan === selectedPlan;
        });
    }, [safeCourses, editingCourse, data.major_id, data.study_plan_version]);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        clearErrors();

        if (editingCourse) {
            put(route('admin.courses.update', editingCourse.id), {
                onSuccess: () => {
                    cancelEdit();
                    Swal.fire({ icon: 'success', title: 'تم التعديل', text: 'تم تحديث المادة بنجاح', timer: 1500, showConfirmButton: false });
                }
            });
        } else {
            post(route('admin.courses.store'), {
                onSuccess: () => {
                    reset('name', 'code', 'prerequisite_id', 'description', 'minimum_passed_hours');
                    setData('study_plan_version', '12');
                    Swal.fire({ icon: 'success', title: 'تمت الإضافة', text: 'تم حفظ المادة بنجاح', timer: 1500, showConfirmButton: false });
                }
            });
        }
    };

    const editCourse = (course) => {
        setEditingCourse(course);
        let collId = '';
        if (course.major_id) {
            const major = safeMajors.find(m => m.id === course.major_id);
            if (major) collId = major.college_id;
        }

        setData({
            id: course.id,
            college_id: collId,
            major_id: course.major_id || '',
            name: course.name,
            code: course.code,
            credit_hours: course.credit_hours,
            minimum_passed_hours: course.minimum_passed_hours ?? '',
            type: course.type,
            study_plan_version: String(course.study_plan_version || 12),
            semester: course.semester || 1,
            prerequisite_id: course.prerequisites?.length > 0 ? course.prerequisites[0].id : '',
            description: course.description || '',
        });

        setTimeout(() => {
            const formElement = document.getElementById('course-action-form');
            if (formElement) {
                const y = formElement.getBoundingClientRect().top + window.scrollY - 100;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 50);
    };

    const cancelEdit = () => {
        setEditingCourse(null);
        reset('id', 'name', 'code', 'prerequisite_id', 'semester', 'description', 'minimum_passed_hours');
        clearErrors();
    };

    const handleDeleteSingle = (id, name) => {
        Swal.fire({
            title: 'حذف المادة؟', text: `هل أنت متأكد من حذف (${name})؟`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                router.delete(route('admin.courses.destroy', id), {
                    onSuccess: () => Swal.fire('تم الحذف!', 'تم تنظيف السجل بنجاح.', 'success')
                });
            }
        });
    };

    const handleImportSubmit = (e) => {
        e.preventDefault();
        postFile(route('admin.courses.import'), {
            onSuccess: () => {
                resetFile('csv_file');
                Swal.fire('تم الاستيراد!', 'تم بناء روابط الشجرة بنجاح 🚀', 'success');
            }
        });
    };

    const handleColSubmit = (e) => {
        e.preventDefault();
        postCol(route('admin.colleges.store'), {
            onSuccess: () => { resetCol('name'); Swal.fire({ icon: 'success', title: 'نجاح', text: 'تمت إضافة الكلية بنجاح 🏛️', timer: 1500, showConfirmButton: false }); }
        });
    };

    const handleMajSubmit = (e) => {
        e.preventDefault();
        postMaj(route('admin.majors.store'), {
            onSuccess: () => { resetMaj('name', 'code'); Swal.fire({ icon: 'success', title: 'نجاح', text: 'تمت إضافة التخصص بنجاح 🎓', timer: 1500, showConfirmButton: false }); }
        });
    };

    const handleBulkDelete = () => {
        Swal.fire({
            title: 'هل أنت متأكد؟', text: `سيتم حذف ${selectedIds.length} مادة مع علاقاتها نهائياً!`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء'
        }).then((result) => {
            if (result.isConfirmed) {
                router.post(route('admin.courses.bulk_delete'), { ids: selectedIds }, {
                    onSuccess: () => { setSelectedIds([]); Swal.fire('تم الحذف!', 'تم تنظيف السجلات بنجاح.', 'success'); }
                });
            }
        });
    };

    const renderCourseBadge = (type, hours) => {
        switch(type) {
            case 'compulsory': 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-indigo-50 text-indigo-600 border-indigo-100" title="إجباري">{hours}س</div>;
            case 'elective': 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-emerald-50 text-emerald-600 border-emerald-100" title="اختياري">{hours}س</div>;
            case 'supporting': 
                return <div className="w-12 h-9 rounded-[2rem] flex items-center justify-center font-black text-[10px] border bg-amber-50 text-amber-600 border-amber-200 shadow-sm" title="مادة مساندة">{hours}س</div>;
            case 'university_req': 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-cyan-50 text-cyan-600 border-cyan-200" title="متطلب جامعة (أونلاين)">{hours}س</div>;
            default: 
                return <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] border bg-slate-50 text-slate-600 border-slate-200">{hours}س</div>;
        }
    };

    return (
        <AdminLayout>
            <Head title="إدارة النظام - Sanfoor" />

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
                .delay-100 { animation-delay: 100ms; }
                .delay-200 { animation-delay: 200ms; }
                
                @keyframes borderPulse {
                    0% { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.2); }
                    50% { border-color: rgba(245, 158, 11, 0.8); box-shadow: 0 0 0 4px rgba(245, 158, 11, 0.1); }
                    100% { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                }
                .edit-mode-active { animation: borderPulse 2s infinite; }

                /* 🔥 إضافة كلاس لإخفاء السكرول بار داخل الفورم 🔥 */
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            ` }} />

            <div className="p-4 md:p-8 bg-[#f4f7f9] min-h-screen" dir="rtl">

                {/* --- 1. الترويسة وأزرار التنقل (Header & Tabs) --- */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-5 animate-fade-in-up">
                    <div>
                        <h1 className="text-3xl font-[900] text-slate-800 tracking-tight">إدارة النظام الأكاديمي</h1>
                        <p className="text-slate-500 mt-1.5 font-bold text-sm">إدارة الشجرة الأكاديمية والمواد فقط. تمت إدارة الكليات والتخصصات والسجل من لوحة الداشبورد.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-fade-in-up delay-100">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[11px] font-black text-slate-400 mb-1">إجمالي المواد</p>
                        <p className="text-2xl font-black text-slate-900">{kpi.totalCourses}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[11px] font-black text-slate-400 mb-1">مواد ضمن الفلتر الحالي</p>
                        <p className="text-2xl font-black text-indigo-600">{kpi.filteredCourses}</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <p className="text-[11px] font-black text-slate-400 mb-1">مواد محددة للحذف</p>
                        <p className="text-2xl font-black text-rose-600">{kpi.selectedCount}</p>
                    </div>
                </div>

                {/* --- 2. محتوى تبويب: الكليات والتخصصات --- */}
                {false && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up delay-100">
                        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-blue-500 to-cyan-500"></div>
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>🏛️</span> إضافة كلية جديدة</h3>
                            <form onSubmit={handleColSubmit} className="space-y-5">
                                <div>
                                    <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">اسم الكلية الرسمي</label>
                                    <input type="text" placeholder="مثال: كلية التمريض" className="w-full rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 bg-slate-50/50 font-bold text-slate-800" value={colData.name} onChange={e => setColData('name', e.target.value)} required />
                                </div>
                                <button type="submit" disabled={colProc} className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 active:scale-95">
                                    {colProc ? 'جاري الحفظ...' : 'حفظ بيانات الكلية'}
                                </button>
                            </form>
                        </div>

                        <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-violet-500 to-purple-500"></div>
                            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2"><span>🎓</span> إضافة تخصص جديد</h3>
                            <form onSubmit={handleMajSubmit} className="space-y-5">
                                <div>
                                    <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">الكلية التابعة لها</label>
                                    <select className="w-full rounded-xl border-slate-200 focus:ring-violet-500 focus:border-violet-500 bg-slate-50/50 font-bold text-slate-700" value={majData.college_id} onChange={e => setMajData('college_id', e.target.value)} required>
                                        <option value="">-- اختر الكلية --</option>
                                        {safeColleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">اسم التخصص</label>
                                        <input type="text" placeholder="مثال: الذكاء الاصطناعي" className="w-full rounded-xl border-slate-200 focus:ring-violet-500 focus:border-violet-500 bg-slate-50/50 font-bold text-slate-800" value={majData.name} onChange={e => setMajData('name', e.target.value)} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[13px] font-bold text-slate-600 mb-1.5 block">الرمز</label>
                                        <input type="text" placeholder="AI" dir="ltr" className="w-full rounded-xl border-slate-200 focus:ring-violet-500 focus:border-violet-500 bg-slate-50/50 uppercase font-black text-center text-violet-700" value={majData.code} onChange={e => setMajData('code', e.target.value.toUpperCase())} required />
                                    </div>
                                </div>
                                {majErr.code && <div className="text-rose-500 text-xs mt-1 font-bold">{majErr.code}</div>}
                                <button type="submit" disabled={majProc} className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-black hover:bg-violet-700 transition-all shadow-lg shadow-violet-500/30 active:scale-95 mt-2">
                                    {majProc ? 'جاري الحفظ...' : 'إضافة التخصص'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- 3. محتوى تبويب: الشجرة والمواد --- */}
                {(
                    <div className="space-y-8 animate-fade-in-up delay-100">

                        <div className={`bg-[#0b0f19] p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-slate-800 transition-opacity duration-300 ${editingCourse ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none"></div>
                            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                            
                            <div className="relative z-10">
                                <h2 className="text-2xl font-[900] flex items-center gap-3 mb-2">
                                    <span className="text-indigo-400">🚀</span> البناء التلقائي للشجرة (CSV)
                                </h2>
                                <p className="text-slate-400 font-bold text-sm mb-8">ارفع خطة القسم كاملة بملف إكسل ليقوم النظام ببناء الشجرة وربط المتطلبات تلقائياً.</p>
                                
                                <form onSubmit={handleImportSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-5 items-end bg-white/5 p-6 rounded-[1.5rem] border border-white/10 backdrop-blur-md">
                                    <div>
                                        <label className="block text-[11px] font-black mb-2 text-indigo-200 tracking-widest uppercase">1. حدد الكلية</label>
                                        <select className="w-full rounded-xl border-none bg-white/10 text-white font-bold p-3.5 text-sm focus:ring-2 focus:ring-indigo-500 appearance-none" value={fileData.college_id} onChange={e => setFileData({ ...fileData, college_id: e.target.value, major_id: '' })}>
                                            <option value="" className="text-slate-900">-- اختر الكلية --</option>
                                            {filteredImportColleges.map(c => <option key={c.id} value={c.id} className="text-slate-900">{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black mb-2 text-indigo-200 tracking-widest uppercase">2. حدد التخصص</label>
                                        <select className="w-full rounded-xl border-none bg-white/10 text-white font-bold p-3.5 text-sm focus:ring-2 focus:ring-indigo-500 appearance-none disabled:opacity-50" value={fileData.major_id} onChange={e => setFileData('major_id', e.target.value)} disabled={!fileData.college_id} required>
                                            <option value="" className="text-slate-900">-- التخصص المستهدف --</option>
                                            {filteredImportMajors.map(m => <option key={m.id} value={m.id} className="text-slate-900">{m.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black mb-2 text-indigo-200 tracking-widest uppercase">3. رقم الخطة</label>
                                        <select className="w-full rounded-xl border-none bg-white/10 text-white font-bold p-3.5 text-sm focus:ring-2 focus:ring-indigo-500 appearance-none" value={fileData.study_plan_version} onChange={e => setFileData('study_plan_version', e.target.value)} required>
                                            <option value="11" className="text-slate-900">الخطة 11</option>
                                            <option value="12" className="text-slate-900">الخطة 12</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-black mb-2 text-indigo-200 tracking-widest uppercase">4. ملف الخطة (CSV)</label>
                                        <input type="file" onChange={e => setFileData('csv_file', e.target.files[0])} className="w-full bg-white/10 rounded-xl p-2.5 border border-transparent text-sm file:bg-indigo-600 file:text-white file:rounded-lg file:border-0 file:px-4 file:py-1.5 file:font-black cursor-pointer hover:bg-white/20 transition-colors" required />
                                    </div>
                                    <button type="submit" disabled={fileProcessing || !fileData.major_id || !fileData.csv_file || !fileData.study_plan_version} className="bg-indigo-600 text-white h-[52px] rounded-xl font-black hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50 shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                                        بدء المعالجة
                                    </button>
                                </form>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
                            
                            {/* 🔥 تم التعديل هنا: max-h-[calc(100vh-100px)] و overflow-y-auto 🔥 */}
                            <div id="course-action-form" className={`lg:col-span-4 bg-white p-6 rounded-[2rem] border shadow-[0_8px_30px_rgb(0,0,0,0.03)] sticky top-24 max-h-[calc(100vh-100px)] overflow-y-auto hide-scrollbar transition-all duration-300 z-10 ${editingCourse ? 'edit-mode-active bg-amber-50/10' : 'border-slate-200/80'}`}>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-[900] text-slate-800 flex items-center gap-2">
                                        {editingCourse ? <><span className="text-amber-500">✏️</span> تعديل بيانات المادة</> : <><span className="text-indigo-600">✍️</span> إضافة مادة يدوياً</>}
                                    </h3>
                                    {editingCourse && (
                                        <button onClick={cancelEdit} className="text-[10px] font-black text-rose-500 bg-rose-50 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition-colors">إلغاء التعديل ✕</button>
                                    )}
                                </div>

                                <form onSubmit={handleManualSubmit} className="space-y-5 pb-2">
                                    
                                    <div className="space-y-3">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">المسار الأكاديمي</label>
                                        <select className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500" value={data.college_id} onChange={e => setData({ ...data, college_id: e.target.value, major_id: '' })}>
                                            <option value="">-- اختر الكلية --</option>
                                            {filteredManualColleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <select className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50" value={data.major_id} onChange={e => setData('major_id', e.target.value)} disabled={!data.college_id}>
                                            <option value="">-- متطلب جامعة عام (بدون تخصص) --</option>
                                            {filteredManualMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <select className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500" value={data.study_plan_version} onChange={e => setData('study_plan_version', e.target.value)} required>
                                            <option value="11">الخطة الشجرية 11</option>
                                            <option value="12">الخطة الشجرية 12</option>
                                        </select>
                                        {errors.study_plan_version && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.study_plan_version}</div>}
                                    </div>

                                    <div className="h-px bg-slate-100 w-full"></div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">تفاصيل المادة</label>
                                        <div>
                                            <input type="text" placeholder="اسم المادة (مثال: تفاضل وتكامل 1)" className="rounded-xl border-slate-200 w-full text-sm font-bold focus:ring-indigo-500 focus:border-indigo-500" value={data.name} onChange={e => setData('name', e.target.value)} required />
                                            {errors.name && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.name}</div>}
                                        </div>
                                        <div className="grid grid-cols-5 gap-3">
                                            <div className="col-span-3 relative">
                                                <input type="text" placeholder="الرمز (MATH101)" className="rounded-xl border-slate-200 w-full text-sm font-black focus:ring-indigo-500 focus:border-indigo-500 uppercase font-mono pr-10" value={data.code} onChange={e => setData('code', e.target.value.toUpperCase())} required dir="ltr" />
                                                <span className="absolute right-3 top-2.5 text-slate-400">🔢</span>
                                                {errors.code && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.code}</div>}
                                            </div>
                                            <div className="col-span-2 relative">
                                                <input type="number" min="0" max="6" className="rounded-xl border-slate-200 w-full text-sm font-black focus:ring-indigo-500 focus:border-indigo-500 pl-8 text-center" value={data.credit_hours} onChange={e => setData('credit_hours', e.target.value)} required />
                                                <span className="absolute left-3 top-2.5 text-[10px] font-black text-slate-400">ساعة</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                                                <span className="text-[11px] font-bold text-amber-800">شرط ساعات قبل تنزيل المادة (اختياري)</span>
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                                    checked={data.minimum_passed_hours !== ''}
                                                    onChange={e => setData('minimum_passed_hours', e.target.checked ? 90 : '')}
                                                />
                                            </label>

                                            {data.minimum_passed_hours !== '' && (
                                                <div>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="200"
                                                        className="rounded-xl border-amber-200 w-full text-sm font-black focus:ring-amber-500 focus:border-amber-500 text-center"
                                                        value={data.minimum_passed_hours}
                                                        onChange={e => setData('minimum_passed_hours', e.target.value)}
                                                        placeholder="مثال: 90"
                                                    />
                                                    <p className="text-[10px] text-amber-700 font-bold mt-1">لن يستطيع الطالب تسجيلها قبل إكمال هذا العدد من الساعات.</p>
                                                    {errors.minimum_passed_hours && <div className="text-rose-500 text-xs mt-1 font-bold">{errors.minimum_passed_hours}</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                                            ملاحظات (وصف)
                                            <span className="text-indigo-400 text-[9px] bg-indigo-50 px-1.5 rounded">يظهر للطلاب</span>
                                        </label>
                                        <textarea 
                                            placeholder="اكتب نبذة عن طبيعة المادة هنا (اختياري)..." 
                                            className="rounded-xl border-slate-200 w-full text-xs font-medium focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 min-h-[60px] resize-none" 
                                            value={data.description} 
                                            onChange={e => setData('description', e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="h-px bg-slate-100 w-full"></div>

                                    <div className="space-y-4">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">موقع العقدة وتصنيفها</label>
                                        
                                        <div className="flex flex-col gap-1.5 mb-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[11px] font-bold text-slate-700">مستوى المادة (موقعها بالشجرة):</span>
                                                <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded">يحدد الـ X-Axis</span>
                                            </div>
                                            <select className="w-full rounded-xl border-slate-200 text-sm font-bold focus:ring-indigo-500 bg-slate-50" value={data.semester} onChange={e => setData('semester', e.target.value)}>
                                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(num => <option key={num} value={num}>المستوى (الفصل) {num}</option>)}
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-[11px] font-bold text-slate-700">تصنيف العقدة (Node Type):</span>
                                            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl">
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="compulsory" checked={data.type === 'compulsory'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-white peer-checked:text-indigo-600 peer-checked:shadow-sm font-bold transition-all text-xs text-slate-500">إجباري</div>
                                                </label>
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="elective" checked={data.type === 'elective'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-white peer-checked:text-emerald-600 peer-checked:shadow-sm font-bold transition-all text-xs text-slate-500">اختياري</div>
                                                </label>
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="supporting" checked={data.type === 'supporting'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-amber-50 peer-checked:text-amber-600 peer-checked:shadow-sm peer-checked:border-amber-200 border border-transparent font-bold transition-all text-[11px] text-slate-500 flex flex-col items-center justify-center">
                                                        <span>مساندة</span>
                                                        <span className="text-[8px] font-normal opacity-70">(شكل بيضاوي)</span>
                                                    </div>
                                                </label>
                                                <label className="cursor-pointer">
                                                    <input type="radio" className="hidden peer" name="type" value="university_req" checked={data.type === 'university_req'} onChange={e => setData('type', e.target.value)} />
                                                    <div className="text-center py-2 rounded-lg peer-checked:bg-cyan-50 peer-checked:text-cyan-600 peer-checked:shadow-sm peer-checked:border-cyan-200 border border-transparent font-bold transition-all text-[11px] text-slate-500 flex flex-col items-center justify-center">
                                                        <span>متطلب جامعة</span>
                                                        <span className="text-[8px] font-normal opacity-70">(أونلاين)</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-1.5 mt-2">
                                            <span className="text-[11px] font-bold text-slate-700">تفتح بعد اجتياز (المتطلب السابق):</span>
                                            <select className="w-full rounded-xl border-slate-200 text-sm font-bold focus:ring-indigo-500 bg-slate-50" value={data.prerequisite_id} onChange={e => setData('prerequisite_id', e.target.value)}>
                                                <option value="">-- بدون متطلب سابق --</option>
                                                {availablePrerequisites.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <button type="submit" disabled={processing} className={`w-full text-white py-3.5 rounded-xl font-black transition-all shadow-lg active:scale-95 mt-6 disabled:opacity-50 text-sm ${editingCourse ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30' : 'bg-slate-900 hover:bg-indigo-600 hover:shadow-indigo-500/30'}`}>
                                        {processing ? 'جاري المعالجة...' : (editingCourse ? 'حفظ التعديلات' : 'إضافة المادة للشجرة')}
                                    </button>
                                </form>
                            </div>

                            {/* جدول عرض المواد (Data Table) */}
                            <div className="lg:col-span-8 space-y-5">
                                <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 flex flex-col md:flex-row items-center gap-4 shadow-sm">
                                    <div className="flex-1 w-full">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">تصفية حسب التخصص</label>
                                        <select
                                            className="w-full rounded-xl border-slate-200 focus:ring-indigo-500 text-sm font-bold text-indigo-800 bg-indigo-50/50 border-transparent cursor-pointer"
                                            value={activeMajorFilter}
                                            onChange={e => setActiveMajorFilter(e.target.value)}
                                        >
                                            <option value="">🌍 عرض كل المواد (النظام كامل)</option>
                                            <option value="general">🏛️ متطلبات الجامعة الإجبارية والاختيارية</option>
                                            {safeMajors.map(m => <option key={m.id} value={m.id}>🎓 {m.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1 w-full relative">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-2">بحث سريع</label>
                                        <span className="absolute right-4 top-[34px] text-slate-400">🔍</span>
                                        <input type="text" placeholder="اكتب رمز أو اسم المادة..." className="w-full pr-12 rounded-xl border-slate-200 focus:ring-indigo-500 text-sm font-bold bg-slate-50/50" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                    </div>
                                </div>

                                <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden">
                                    
                                    {selectedIds.length > 0 && (
                                        <div className="bg-indigo-50 border-b border-indigo-100 flex items-center justify-between px-6 py-3 animate-fade-in-up">
                                            <span className="text-sm font-black text-indigo-800 flex items-center gap-2">
                                                تم تحديد <span className="text-lg bg-white px-2 py-0.5 rounded-md shadow-sm">{selectedIds.length}</span> مواد
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 bg-white text-slate-500 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">إلغاء التحديد</button>
                                                <button onClick={handleBulkDelete} className="px-4 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 shadow-md shadow-rose-500/20 active:scale-95 transition-all">🗑️ حذف نهائي</button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-right whitespace-nowrap">
                                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                                <tr>
                                                    <th className="p-5 w-10">
                                                        <input type="checkbox" className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer" onChange={(e) => e.target.checked ? setSelectedIds(filteredCourses.map(c => c.id)) : setSelectedIds([])} checked={selectedIds.length === filteredCourses.length && filteredCourses.length > 0} />
                                                    </th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest">المادة ورمزها</th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest">التصنيف والنوع</th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest">الاعتماد (يفتح)</th>
                                                    <th className="p-5 font-black text-slate-400 text-[11px] uppercase tracking-widest text-left">إجراءات</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {filteredCourses.map(course => (
                                                    <tr key={course.id} className={`transition-all duration-200 group ${editingCourse?.id === course.id ? 'bg-amber-50/30' : 'hover:bg-slate-50/50'}`}>
                                                        <td className="p-5">
                                                            <input type="checkbox" className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer opacity-40 group-hover:opacity-100 transition-opacity" checked={selectedIds.includes(course.id)} onChange={() => setSelectedIds(prev => prev.includes(course.id) ? prev.filter(i => i !== course.id) : [...prev, course.id])} />
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="flex items-center gap-3">
                                                                {renderCourseBadge(course.type, course.credit_hours)}
                                                                <div>
                                                                    <div className="font-[900] text-slate-800 text-[13px] mb-0.5 flex items-center gap-1.5">
                                                                        {course.name}
                                                                        {course.description && <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded" title="تحتوي على ملاحظات">📝</span>}
                                                                    </div>
                                                                    <div className="text-[10px] font-black text-slate-400 font-mono tracking-wider" dir="ltr">{course.code}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5">
                                                            <div className="flex flex-col gap-1.5 items-start">
                                                                {course.major ? <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-200/60 shadow-sm">{course.major.name}</span> : <span className="bg-gradient-to-r from-violet-100 to-fuchsia-100 text-violet-700 px-2.5 py-1 rounded-lg text-[10px] font-black border border-violet-200/60 shadow-sm">🎓 متطلب جامعة</span>}
                                                                <span className="text-[10px] font-bold text-slate-400">
                                                                    {course.type === 'supporting' ? '🔸 مادة مساندة | ' : course.type === 'university_req' ? '🌐 أونلاين | ' : ''}
                                                                    الفصل {course.semester || 1}
                                                                </span>
                                                                <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-lg">الخطة {course.study_plan_version || 12}</span>
                                                                {course.minimum_passed_hours ? (
                                                                    <span className="text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg">⏳ شرط {course.minimum_passed_hours} ساعة</span>
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                        <td className="p-5">
                                                            {course.prerequisites && course.prerequisites.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                                                    {course.prerequisites.map(pre => (
                                                                        <span key={pre.id} className="bg-white text-slate-600 text-[10px] font-black px-2 py-1 rounded-md border border-slate-200 shadow-sm group-hover:border-indigo-200 transition-colors" title={`رمز: ${pre.code}`}>
                                                                            🔒 {pre.name}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : <span className="text-slate-300 font-black text-lg">-</span>}
                                                        </td>
                                                        <td className="p-5 text-left">
                                                            <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => editCourse(course)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 flex items-center justify-center transition-all shadow-sm" title="تعديل المادة">
                                                                    ✏️
                                                                </button>
                                                                <button onClick={() => handleDeleteSingle(course.id, course.name)} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 flex items-center justify-center transition-all shadow-sm" title="حذف نهائي">
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    {filteredCourses.length === 0 && (
                                        <div className="p-20 text-center flex flex-col items-center justify-center">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner border border-slate-100">📂</div>
                                            <h4 className="text-slate-700 font-black text-lg mb-1">لا توجد مواد هنا</h4>
                                            <p className="text-slate-400 font-medium text-sm">جرب تغيير الفلتر المختار أو ابدأ بإضافة مواد جديدة.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- 4. محتوى تبويب: سجل العمليات --- */}
                {false && (
                    <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] overflow-hidden animate-fade-in-up delay-100">
                        <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-[900] text-slate-800 tracking-tight">🕵️ سجل نشاطات النظام</h2>
                                <p className="text-[11px] font-bold text-slate-400 mt-1">تتبع من قام بإضافة، تعديل، أو حذف البيانات.</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right whitespace-nowrap">
                                <thead className="bg-white text-slate-400 text-[11px] font-black uppercase tracking-widest border-b border-slate-100">
                                    <tr><th className="p-5">التاريخ والوقت</th><th className="p-5">المسؤول (الأدمن)</th><th className="p-5">تفاصيل العملية</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-sm">
                                    {logs && logs.length > 0 ? logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-5 text-slate-400 font-mono text-[11px] font-bold" dir="ltr">{new Date(log.created_at).toLocaleString('en-GB')}</td>
                                            <td className="p-5 font-[900] text-slate-700 flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px]">{log.user?.name?.charAt(0) || '?'}</div>
                                                {log.user?.name || 'مستخدم غير معروف'}
                                            </td>
                                            <td className="p-5 text-slate-500 font-bold whitespace-normal">
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ml-2 border ${
                                                    log.action.includes('add') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    log.action.includes('delete') ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    'bg-blue-50 text-blue-600 border-blue-100'
                                                }`}>
                                                    {log.action}
                                                </span>
                                                {log.details}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="3" className="p-10 text-center text-slate-400 font-bold">لم يتم تسجيل أي عمليات بعد.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}