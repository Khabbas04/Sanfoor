import React, { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Pencil, Trash2, Upload, FileSpreadsheet, Plus, X } from 'lucide-react';
import Pagination from '@/Components/Pagination';

export default function CourseSections({ sections, filters }) {
    const [search, setSearch] = useState(filters.search || '');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSection, setEditingSection] = useState(null);

    const { data: uploadData, setData: setUploadData, post: postUpload, processing: uploadProcessing, errors: uploadErrors, reset: resetUpload } = useForm({
        file: null,
    });

    const { data: editData, setData: setEditData, put: putEdit, processing: editProcessing, errors: editErrors, reset: resetEdit } = useForm({
        instructor: '',
        days: '',
        time: '',
        hall: '',
        capacity: 50,
    });

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('admin.sections.index'), { search }, { preserveState: true });
    };

    const handleUploadSubmit = (e) => {
        e.preventDefault();
        postUpload(route('admin.sections.import'), {
            onSuccess: () => {
                setIsUploadModalOpen(false);
                resetUpload();
            },
        });
    };

    const openEditModal = (section) => {
        setEditingSection(section);
        setEditData({
            instructor: section.instructor || '',
            days: section.days || '',
            time: section.time || '',
            hall: section.hall || '',
            capacity: section.capacity || 50,
        });
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        putEdit(route('admin.sections.update', editingSection.id), {
            onSuccess: () => {
                setIsEditModalOpen(false);
                resetEdit();
            },
        });
    };

    const deleteSection = (section) => {
        if (confirm('هل أنت متأكد من حذف هذه الشعبة؟')) {
            router.delete(route('admin.sections.destroy', section.id));
        }
    };

    return (
        <AdminLayout>
            <Head title="إدارة الشُعب والمواعيد" />

            <div className="py-6 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">إدارة الشُعب والمواعيد</h1>
                    
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Upload size={18} />
                        رفع ملف إكسل
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                    <form onSubmit={handleSearch} className="flex gap-2 max-w-lg">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="ابحث برقم أو اسم المادة أو الدكتور..."
                            className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <button type="submit" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            بحث
                        </button>
                    </form>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">المادة</th>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">الدكتور</th>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">الأيام</th>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">الوقت</th>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">القاعة</th>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">السنة/الفصل</th>
                                    <th className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sections.data.length > 0 ? sections.data.map((section) => (
                                    <tr key={section.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{section.course?.name}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">{section.course?.code}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {section.instructor || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {section.days || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                                            {section.time || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {section.hall || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                                            {section.academic_year} / الفصل {section.academic_term}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex gap-2">
                                                <button onClick={() => openEditModal(section)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => deleteSection(section)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            لا توجد شُعب دراسية مضافة بعد.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {sections.links && (
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                            <Pagination links={sections.links} />
                        </div>
                    )}
                </div>
            </div>

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl relative">
                        <button onClick={() => setIsUploadModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet size={24} className="text-green-600" />
                            استيراد من إكسل
                        </h2>
                        
                        <form onSubmit={handleUploadSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">اختر ملف الإكسل</label>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={(e) => setUploadData('file', e.target.files[0])}
                                    className="w-full text-sm text-gray-500 dark:text-gray-400
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-md file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-blue-50 file:text-blue-700
                                        hover:file:bg-blue-100
                                        dark:file:bg-gray-700 dark:file:text-gray-300"
                                />
                                {uploadErrors.file && <div className="text-red-500 text-sm mt-1">{uploadErrors.file}</div>}
                            </div>
                            
                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                <strong>ملاحظة:</strong> سيتم قراءة الأعمدة استناداً على أسماء الأعمدة في الصف الأول (Course, Instructor, Days, Time, Hall). سيتم استنتاج رمز واسم المادة آلياً، وربطها بالفصل الدراسي الحالي.
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setIsUploadModalOpen(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                                    إلغاء
                                </button>
                                <button type="submit" disabled={uploadProcessing} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                    {uploadProcessing ? 'جاري الرفع...' : 'رفع واستيراد'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-xl relative mt-10 md:mt-0">
                        <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                            <X size={20} />
                        </button>
                        <h2 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">
                            تعديل تفاصيل الشعبة
                        </h2>
                        
                        <form onSubmit={handleEditSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">المادة</label>
                                    <input type="text" value={editingSection?.course?.name || ''} disabled className="w-full rounded-md border-gray-300 bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 cursor-not-allowed" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">اسم الدكتور</label>
                                    <input type="text" value={editData.instructor} onChange={e => setEditData('instructor', e.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                                    {editErrors.instructor && <div className="text-red-500 text-sm">{editErrors.instructor}</div>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الأيام</label>
                                        <input type="text" value={editData.days} onChange={e => setEditData('days', e.target.value)} placeholder="مثال: ح ن ث ر" className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                                        {editErrors.days && <div className="text-red-500 text-sm">{editErrors.days}</div>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الوقت</label>
                                        <input type="text" value={editData.time} onChange={e => setEditData('time', e.target.value)} dir="ltr" placeholder="مثال: 09:00 - 10:00" className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-left" />
                                        {editErrors.time && <div className="text-red-500 text-sm">{editErrors.time}</div>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">القاعة</label>
                                        <input type="text" value={editData.hall} onChange={e => setEditData('hall', e.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                                        {editErrors.hall && <div className="text-red-500 text-sm">{editErrors.hall}</div>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">سعة الشعبة</label>
                                        <input type="number" value={editData.capacity} onChange={e => setEditData('capacity', e.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
                                        {editErrors.capacity && <div className="text-red-500 text-sm">{editErrors.capacity}</div>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-8">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                                    إلغاء
                                </button>
                                <button type="submit" disabled={editProcessing} className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                    {editProcessing ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </AdminLayout>
    );
}
