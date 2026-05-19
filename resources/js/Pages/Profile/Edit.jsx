import MainLayout from '@/Layouts/MainLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head } from '@inertiajs/react';

export default function Edit({ auth, mustVerifyEmail, status, colleges, majors, approved_plan }) {
    const approvedSemesters = approved_plan?.payload?.semesters || [];
    const approvedTotals = approvedSemesters.reduce(
        (acc, sem) => {
            const hours = (sem.course_ids || []).length;
            acc.semesters += 1;
            acc.courses += (sem.course_ids || []).length;
            return acc;
        },
        { semesters: 0, courses: 0 }
    );

    return (
        <MainLayout user={auth.user}>
            <Head title="حسابي الشخصي - جامعة سنفور" />

            <div className="py-10 bg-slate-50 min-h-screen" dir="rtl">
                <div className="max-w-4xl mx-auto sm:px-6 lg:px-8 space-y-8">
                    
                    {/* ترويسة الصفحة */}
                    <div className="mb-2">
                        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <span className="text-4xl drop-shadow-sm">⚙️</span> إعدادات الحساب
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium text-sm md:text-base pr-2">
                            تحكم في بياناتك الشخصية، كلمة المرور، وإعدادات الأمان الخاصة بك بكل سهولة.
                        </p>

                        {status && status !== 'verification-link-sent' && (
                            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-900">
                                {status}
                            </div>
                        )}
                    </div>

                    {/* كرت المعلومات الشخصية */}
                    <div className="p-8 bg-white shadow-sm border border-slate-200/60 rounded-[2rem] hover:shadow-md transition-shadow duration-300">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            colleges={colleges}
                            majors={majors}
                            className="max-w-xl"
                        />
                    </div>

                    {/* كرت خطة التخرج المعتمدة */}
                    <div className="p-8 bg-white shadow-sm border border-slate-200/60 rounded-[2rem] hover:shadow-md transition-shadow duration-300">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <span className="text-2xl">🧭</span> خطة التخرج المعتمدة
                                </h3>
                                <p className="text-slate-500 mt-2 font-medium text-sm">
                                    تظهر هنا آخر خطة تنبؤية قمت باعتمادها من الشجرة الأكاديمية.
                                </p>
                            </div>
                            {approved_plan && (
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-black text-[12px] shadow-lg hover:bg-indigo-600 transition-all active:scale-95"
                                >
                                    🖨️ طباعة الخطة
                                </button>
                            )}
                        </div>

                        {approved_plan ? (
                            <div className="mt-5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                                <div className="flex flex-wrap gap-3">
                                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 text-[11px] font-black">
                                        {approvedTotals.semesters} فصل
                                    </span>
                                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 text-[11px] font-black">
                                        {approvedTotals.courses} مادة
                                    </span>
                                    {approved_plan.approved_at && (
                                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1 text-[11px] font-black">
                                            آخر اعتماد: {new Date(approved_plan.approved_at).toLocaleDateString('ar-EG')}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-3 text-[12px] font-bold text-slate-500">
                                    راجع التفاصيل والتعديل من صفحة الشجرة الأكاديمية.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
                                لم تعتمد خطة تنبؤية بعد.
                            </div>
                        )}
                    </div>

                    {/* كرت كلمة المرور */}
                    <div className="p-8 bg-white shadow-sm border border-slate-200/60 rounded-[2rem] hover:shadow-md transition-shadow duration-300">
                        <UpdatePasswordForm className="max-w-xl" />
                    </div>

                    {/* كرت الحذف (منطقة خطرة) */}
                    <div className="p-8 bg-red-50/50 shadow-sm border border-red-100 rounded-[2rem] hover:bg-red-50 transition-colors duration-300">
                        <DeleteUserForm className="max-w-xl" />
                    </div>
                    
                </div>
            </div>
        </MainLayout>
    );
}