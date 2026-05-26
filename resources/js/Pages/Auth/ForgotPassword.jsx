import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="استعادة كلمة المرور - سنفور" />

            <div dir="rtl">
                {/* عنوان */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-100">
                        🔑
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">استعادة كلمة المرور</h2>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed">
                        نسيت كلمة مرورك؟ لا مشكلة. أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيينها.
                    </p>
                </div>

                {status && (
                    <div className="mb-6 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                        ✅ تم إرسال رابط إعادة التعيين بنجاح! تحقق من بريدك الإلكتروني.
                    </div>
                )}

                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <TextInput
                            id="email"
                            type="email"
                            name="email"
                            value={data.email}
                            className="block w-full text-left"
                            dir="ltr"
                            isFocused={true}
                            placeholder="أدخل بريدك الإلكتروني"
                            onChange={(e) => setData('email', e.target.value)}
                        />
                        <InputError message={errors.email} className="mt-2" />
                    </div>

                    <PrimaryButton className="w-full justify-center py-3.5" disabled={processing}>
                        {processing ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
                    </PrimaryButton>

                    <div className="text-center pt-4 border-t border-slate-100">
                        <Link
                            href={route('login')}
                            className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
                        >
                            → العودة لتسجيل الدخول
                        </Link>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}
