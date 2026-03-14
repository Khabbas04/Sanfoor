import PrimaryButton from '@/Components/PrimaryButton';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm, usePage, router } from '@inertiajs/react';
import { useEffect } from 'react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});
    const { auth } = usePage().props;

    // Auto-redirect when the user verifies their email in another tab/window
    useEffect(() => {
        if (auth?.user?.email_verified_at) {
            router.visit(route('dashboard'));
            return;
        }

        const interval = setInterval(() => {
            router.reload({ only: ['auth'] });
        }, 4000);

        return () => clearInterval(interval);
    }, [auth?.user?.email_verified_at]);

    const submit = (e) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        <GuestLayout>
            <Head title="تأكيد البريد الإلكتروني - سنفور" />

            <div dir="rtl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-blue-100">
                        ✉️
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">تأكيد البريد الإلكتروني</h2>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed">
                        شكراً لتسجيلك! قبل البدء، يرجى تأكيد بريدك الإلكتروني بالضغط على الرابط الذي أرسلناه إليك. إذا لم تستلم الرسالة، يمكننا إرسال واحدة أخرى.
                    </p>
                </div>

                {status === 'verification-link-sent' && (
                    <div className="mb-6 text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                        ✅ تم إرسال رابط تأكيد جديد إلى بريدك الإلكتروني.
                    </div>
                )}

                <form onSubmit={submit}>
                    <div className="flex flex-col gap-4">
                        <PrimaryButton className="w-full justify-center py-3.5" disabled={processing}>
                            {processing ? 'جاري الإرسال...' : 'إعادة إرسال رابط التأكيد'}
                        </PrimaryButton>

                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            جاري التحقق تلقائيًا...
                        </div>

                        <Link
                            href={route('logout')}
                            method="post"
                            as="button"
                            className="w-full text-center py-3 text-sm font-bold text-slate-500 hover:text-rose-600 transition-colors rounded-xl hover:bg-rose-50"
                        >
                            تسجيل الخروج
                        </Link>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}
