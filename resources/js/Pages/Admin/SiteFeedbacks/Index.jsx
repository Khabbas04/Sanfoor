import React from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, Link } from '@inertiajs/react';
import Pagination from '@/Components/Pagination';

export default function Index({ feedbacks }) {
    return (
        <AdminLayout>
            <Head title="تقييمات المنصة" />
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-black text-slate-800">تقييمات وتجارب الطلاب</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right" dir="rtl">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[13px] font-black text-slate-600">الطالب</th>
                                <th className="px-6 py-4 text-[13px] font-black text-slate-600">التقييم</th>
                                <th className="px-6 py-4 text-[13px] font-black text-slate-600">التعليق</th>
                                <th className="px-6 py-4 text-[13px] font-black text-slate-600">الحالة</th>
                                <th className="px-6 py-4 text-[13px] font-black text-slate-600">التاريخ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {feedbacks.data.map((feedback) => (
                                <tr key={feedback.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="text-[14px] font-bold text-slate-800">{feedback.user?.name || 'غير معروف'}</div>
                                        <div className="text-[12px] text-slate-500">{feedback.user?.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {feedback.rating ? (
                                            <div className="flex items-center gap-1 text-yellow-400">
                                                <span>{feedback.rating}</span>
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-[13px] text-slate-700 max-w-md">
                                        {feedback.comments ? (
                                            <p className="whitespace-pre-wrap">{feedback.comments}</p>
                                        ) : (
                                            <span className="text-slate-400 italic">لا يوجد تعليق</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-black ${
                                            feedback.status === 'submitted' 
                                                ? 'bg-emerald-50 text-emerald-600' 
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {feedback.status === 'submitted' ? 'تم التقييم' : 'تم التخطي'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-[12px] text-slate-500 font-bold" dir="ltr">
                                        {new Date(feedback.created_at).toLocaleString('en-GB')}
                                    </td>
                                </tr>
                            ))}
                            {feedbacks.data.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-bold">
                                        لا توجد أي تقييمات مسجلة بعد.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6">
                <Pagination links={feedbacks.links} />
            </div>
        </AdminLayout>
    );
}
