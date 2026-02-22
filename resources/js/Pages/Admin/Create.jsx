import React from 'react';
import { useForm, Head } from '@inertiajs/react';
import Swal from 'sweetalert2';

export default function CreateCourse({ universities, colleges, majors }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        university_id: '',
        college_id: '',
        major_id: '',
        name: '',
        code: '',
        credit_hours: '',
        type: 'compulsory',
    });

    // 🔥 فلترة الكليات بناءً على الجامعة المختارة
    const filteredColleges = colleges.filter(c => c.university_id == data.university_id);
    
    // 🔥 فلترة التخصصات بناءً على الكلية المختارة
    const filteredMajors = majors.filter(m => m.college_id == data.college_id);

    // دوال للتعامل مع التغييرات وتصفير الحقول المرتبطة لمنع الأخطاء
    const handleUniversityChange = (e) => {
        setData(prevData => ({
            ...prevData,
            university_id: e.target.value,
            college_id: '', // تصفير الكلية
            major_id: ''    // تصفير التخصص
        }));
    };

    const handleCollegeChange = (e) => {
        setData(prevData => ({
            ...prevData,
            college_id: e.target.value,
            major_id: ''    // تصفير التخصص
        }));
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('admin.courses.store'), {
            onSuccess: () => {
                reset('name', 'code', 'credit_hours'); // تفريغ حقول المادة فقط وترك التخصص المختار
                Swal.fire({ icon: 'success', title: 'تم الحفظ', text: 'تمت إضافة المادة بنجاح!', confirmButtonColor: '#3b82f6' });
            }
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-8 font-cairo" dir="rtl">
            <Head title="إضافة مادة جديدة - لوحة الإدارة" />
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
                    <span className="text-indigo-600">📚</span> إضافة مادة جديدة
                </h2>

                <form onSubmit={submit} className="space-y-6">
                    
                    {/* --- قسم الهيكلة الأكاديمية (الجامعة، الكلية، التخصص) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 bg-slate-50 rounded-xl border border-slate-100">
                        {/* 1. الجامعة */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">الجامعة</label>
                            <select 
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={data.university_id} 
                                onChange={handleUniversityChange}
                                required
                            >
                                <option value="">اختر الجامعة...</option>
                                {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>

                        {/* 2. الكلية */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">الكلية</label>
                            <select 
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-200 disabled:cursor-not-allowed"
                                value={data.college_id} 
                                onChange={handleCollegeChange}
                                disabled={!data.university_id}
                                required
                            >
                                <option value="">اختر الكلية...</option>
                                {filteredColleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        {/* 3. التخصص */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">التخصص</label>
                            <select 
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-200 disabled:cursor-not-allowed"
                                value={data.major_id} 
                                onChange={(e) => setData('major_id', e.target.value)}
                                disabled={!data.college_id}
                                required
                            >
                                <option value="">اختر التخصص...</option>
                                {filteredMajors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                            {errors.major_id && <div className="text-red-500 text-xs mt-1">{errors.major_id}</div>}
                        </div>
                    </div>

                    {/* --- قسم تفاصيل المادة --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">اسم المادة</label>
                            <input 
                                type="text" 
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={data.name} 
                                onChange={e => setData('name', e.target.value)} 
                                required placeholder="مثال: هياكل البيانات" 
                            />
                            {errors.name && <div className="text-red-500 text-xs mt-1">{errors.name}</div>}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">رمز المادة</label>
                            <input 
                                type="text" 
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={data.code} 
                                onChange={e => setData('code', e.target.value)} 
                                required placeholder="مثال: CS301" dir="ltr"
                            />
                            {errors.code && <div className="text-red-500 text-xs mt-1">{errors.code}</div>}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">الساعات المعتمدة</label>
                            <input 
                                type="number" 
                                min="1" max="6"
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={data.credit_hours} 
                                onChange={e => setData('credit_hours', e.target.value)} 
                                required 
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">نوع المادة</label>
                            <select 
                                className="w-full rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={data.type} 
                                onChange={e => setData('type', e.target.value)}
                            >
                                <option value="compulsory">إجباري تخصص</option>
                                <option value="elective">اختياري تخصص</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end mt-8 border-t border-slate-100 pt-6">
                        <button 
                            type="submit" 
                            disabled={processing}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50"
                        >
                            {processing ? 'جاري الحفظ...' : 'حفظ المادة'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}