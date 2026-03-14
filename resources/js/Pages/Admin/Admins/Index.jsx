import React, { useMemo, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Swal from 'sweetalert2';

export default function AdminsIndex({ auth, admins = [], students = [] }) {
    const [selectedUserId, setSelectedUserId] = useState('');

    const selectedStudent = useMemo(
        () => students.find((s) => String(s.id) === String(selectedUserId)),
        [students, selectedUserId],
    );

    const handlePromote = () => {
        if (!selectedUserId) {
            Swal.fire({ icon: 'warning', title: 'اختيار مطلوب', text: 'اختر طالبًا أولًا.' });
            return;
        }

        router.post(
            route('admin.admins.promote'),
            { user_id: selectedUserId },
            {
                onSuccess: () => {
                    setSelectedUserId('');
                    Swal.fire({ icon: 'success', title: 'تمت الترقية', text: 'تمت ترقية الطالب إلى Admin.' });
                },
                onError: (errors) => {
                    Swal.fire({ icon: 'error', title: 'فشل', text: Object.values(errors)[0] || 'حدث خطأ أثناء الترقية.' });
                },
            },
        );
    };

    const handleDemote = (admin) => {
        Swal.fire({
            icon: 'question',
            title: 'تنزيل الصلاحية',
            text: `هل تريد تنزيل ${admin.name} إلى Student؟`,
            showCancelButton: true,
            confirmButtonText: 'نعم',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#4f46e5',
        }).then((res) => {
            if (!res.isConfirmed) return;

            router.put(route('admin.admins.update_role', admin.id), { role: 'student' }, {
                onSuccess: () => Swal.fire({ icon: 'success', title: 'تم التنزيل', text: `تم تنزيل ${admin.name} إلى Student.` }),
                onError: (errors) => Swal.fire({ icon: 'error', title: 'فشل', text: Object.values(errors)[0] || 'حدث خطأ أثناء التنزيل.' }),
            });
        });
    };

    const handleDelete = (admin) => {
        Swal.fire({
            icon: 'warning',
            title: 'حذف حساب الأدمن',
            text: `سيتم حذف ${admin.name} نهائيًا. هل أنت متأكد؟`,
            showCancelButton: true,
            confirmButtonText: 'نعم، احذف',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#e11d48',
        }).then((res) => {
            if (!res.isConfirmed) return;

            router.delete(route('admin.admins.destroy', admin.id), {}, {
                onSuccess: () => Swal.fire({ icon: 'success', title: 'تم الحذف', text: `تم حذف حساب ${admin.name}.` }),
                onError: (errors) => Swal.fire({ icon: 'error', title: 'فشل', text: Object.values(errors)[0] || 'حدث خطأ أثناء الحذف.' }),
            });
        });
    };

    return (
        <AdminLayout>
            <Head title="إدارة الأدمنز - Owner" />

            <div className="py-8" dir="rtl">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6">
                        <h1 className="text-3xl font-black text-slate-900">👑 إدارة الأدمنز</h1>
                        <p className="text-slate-500 font-bold mt-2 text-sm">
                            هذه الصفحة خاصة بـ Owner لإدارة حسابات الأدمنز بالكامل.
                        </p>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
                        <h2 className="text-sm font-black text-slate-800 mb-4">ترقية طالب إلى Admin</h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <select
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="md:col-span-3 border border-slate-200 rounded-xl p-3 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">اختر طالبًا...</option>
                                {students.map((student) => (
                                    <option key={student.id} value={student.id}>
                                        {student.name} - {student.email}
                                    </option>
                                ))}
                            </select>

                            <button
                                onClick={handlePromote}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-sm px-4 py-3"
                            >
                                ترقية إلى Admin
                            </button>
                        </div>

                        {selectedStudent && (
                            <p className="text-xs font-bold text-slate-500 mt-3">
                                المختار: {selectedStudent.name} ({selectedStudent.email})
                            </p>
                        )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-black text-slate-500">الاسم</th>
                                        <th className="px-4 py-3 text-xs font-black text-slate-500">البريد</th>
                                        <th className="px-4 py-3 text-xs font-black text-slate-500">الرتبة</th>
                                        <th className="px-4 py-3 text-xs font-black text-slate-500">تاريخ الإنشاء</th>
                                        <th className="px-4 py-3 text-xs font-black text-slate-500 text-center">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {admins.map((admin) => {
                                        const isOwner = String(admin.role || '').toLowerCase() === 'owner';

                                        return (
                                            <tr key={admin.id} className="border-b border-slate-100 last:border-b-0">
                                                <td className="px-4 py-3 font-black text-slate-800 text-sm">{admin.name}</td>
                                                <td className="px-4 py-3 font-bold text-slate-500 text-xs">{admin.email}</td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`px-2 py-1 rounded-md text-[11px] font-black ${
                                                            isOwner
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-indigo-100 text-indigo-800'
                                                        }`}
                                                    >
                                                        {isOwner ? 'OWNER' : 'ADMIN'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-500 text-xs">
                                                    {new Date(admin.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            disabled={isOwner}
                                                            onClick={() => handleDemote(admin)}
                                                            className={`px-3 py-2 rounded-lg text-[11px] font-black ${
                                                                isOwner
                                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                            }`}
                                                        >
                                                            تنزيل إلى Student
                                                        </button>

                                                        <button
                                                            disabled={isOwner}
                                                            onClick={() => handleDelete(admin)}
                                                            className={`px-3 py-2 rounded-lg text-[11px] font-black ${
                                                                isOwner
                                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                            }`}
                                                        >
                                                            حذف الحساب
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {admins.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="text-center py-8 text-slate-400 font-bold text-sm">
                                                لا يوجد حسابات Admin/Owner.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
