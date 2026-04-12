import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';
import { useMemo } from 'react';

export default function UpdateProfileInformation({
    mustVerifyEmail,
    status,
    colleges = [],
    majors = [],
    className = '',
}) {
    const user = usePage().props.auth.user;
    const isStudent = String(user?.role ?? '').toLowerCase() === 'student';
    const academicFieldsLocked = isStudent && Boolean(user?.major_id);

    const initialCollegeId = String(
        user?.major?.college_id
        ?? majors.find((major) => String(major.id) === String(user.major_id))?.college_id
        ?? ''
    );

    const { data, setData, patch, errors, processing, recentlySuccessful } =
        useForm({
            name: user.name,
            email: user.email,
            college_id: initialCollegeId,
            major_id: user.major_id ? String(user.major_id) : '',
            study_plan_version: String(user.study_plan_version ?? 12),
        });

    const filteredMajors = useMemo(
        () => majors.filter((major) => String(major.college_id) === String(data.college_id)),
        [majors, data.college_id]
    );

    const submit = (e) => {
        e.preventDefault();
        patch(route('profile.update'));
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-xl font-black text-slate-800 border-r-4 border-indigo-600 pr-3 font-cairo">
                    المعلومات الشخصية
                </h2>

                <p className="mt-2 text-sm text-slate-500 font-medium font-cairo">
                    قم بتحديث اسمك وبريدك الإلكتروني المرتبط بالحساب الخاص بك في جامعة سنفور.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-5">
                <div>
                    <InputLabel htmlFor="name" value="الاسم الرباعي" />

                    <TextInput
                        id="name"
                        className="mt-1 block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        isFocused
                        autoComplete="name"
                    />

                    <InputError className="mt-2" message={errors.name} />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="البريد الإلكتروني" />

                    <TextInput
                        id="email"
                        type="email"
                        className="mt-1 block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 text-left shadow-sm transition-all"
                        dir="ltr"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.email} />
                </div>

                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-4">
                    <p className="text-sm font-black text-indigo-900">البيانات الأكاديمية</p>

                    {academicFieldsLocked && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-bold text-amber-800">
                            تم قفل الكلية والتخصص والخطة الدراسية بعد الحفظ الأول لحماية دقة البيانات.
                        </div>
                    )}

                    <div>
                        <InputLabel htmlFor="college_id" value="الكلية" />
                        <div className="relative mt-1">
                            <select
                                id="college_id"
                                value={data.college_id}
                                onChange={(e) => setData((prev) => ({ ...prev, college_id: e.target.value, major_id: '' }))}
                                disabled={academicFieldsLocked}
                                className="block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                            >
                                <option value="">اختر الكلية</option>
                                {colleges.map((college) => (
                                    <option key={college.id} value={college.id}>{college.name}</option>
                                ))}
                            </select>
                        </div>
                        <InputError className="mt-2" message={errors.college_id} />
                    </div>

                    <div>
                        <InputLabel htmlFor="major_id" value="التخصص" />
                        <div className="relative mt-1">
                            <select
                                id="major_id"
                                value={data.major_id}
                                onChange={(e) => setData('major_id', e.target.value)}
                                disabled={academicFieldsLocked || !data.college_id}
                                className="block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                            >
                                <option value="">{data.college_id ? 'اختر التخصص' : 'اختر الكلية أولاً'}</option>
                                {filteredMajors.map((major) => (
                                    <option key={major.id} value={major.id}>{major.name}</option>
                                ))}
                            </select>
                        </div>
                        <InputError className="mt-2" message={errors.major_id} />
                    </div>

                    <div>
                        <InputLabel htmlFor="study_plan_version" value="الخطة الدراسية" />
                        <div className="relative mt-1">
                            <select
                                id="study_plan_version"
                                value={data.study_plan_version}
                                onChange={(e) => setData('study_plan_version', e.target.value)}
                                disabled={academicFieldsLocked}
                                className="block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                            >
                                <option value="11">الخطة 11</option>
                                <option value="12">الخطة 12</option>
                            </select>
                        </div>
                        <InputError className="mt-2" message={errors.study_plan_version} />
                    </div>
                </div>

                {mustVerifyEmail && user.email_verified_at === null && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <p className="text-sm font-bold text-amber-800 flex flex-col sm:flex-row sm:items-center gap-2">
                            <span>⚠️ بريدك الإلكتروني غير موثق.</span>
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="underline text-sm text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                اضغط هنا لإعادة إرسال رابط التوثيق.
                            </Link>
                        </p>

                        {status === 'verification-link-sent' && (
                            <div className="mt-3 text-sm font-bold text-emerald-600 flex items-center gap-2">
                                <span>✉️</span> تم إرسال رابط توثيق جديد إلى بريدك الإلكتروني.
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 mt-6 pt-6">
                    <PrimaryButton disabled={processing} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-6 py-3 font-black shadow-lg shadow-indigo-200 transition-all active:scale-95">
                        {processing ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </PrimaryButton>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out duration-300 transform"
                        enterFrom="opacity-0 translate-x-4"
                        enterTo="opacity-100 translate-x-0"
                        leave="transition ease-in-out duration-300 transform"
                        leaveFrom="opacity-100 translate-x-0"
                        leaveTo="opacity-0 translate-x-4"
                    >
                        <p className="text-sm font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                            <span>✅</span> تم الحفظ بنجاح
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}