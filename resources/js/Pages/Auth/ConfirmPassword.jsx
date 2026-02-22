import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({
        password: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.confirm'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="تأكيد كلمة المرور - سنفور" />

            <div dir="rtl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-amber-100">
                        🛡️
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">تأكيد الهوية</h2>
                    <p className="text-sm font-bold text-slate-500 leading-relaxed">
                        هذه منطقة محمية. يرجى تأكيد كلمة المرور قبل المتابعة.
                    </p>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <InputLabel htmlFor="password" value="كلمة المرور" />
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            className="mt-1.5 block w-full"
                            isFocused={true}
                            placeholder="••••••••"
                            onChange={(e) => setData('password', e.target.value)}
                        />
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <PrimaryButton className="w-full justify-center py-3.5" disabled={processing}>
                        {processing ? 'جاري التأكيد...' : 'تأكيد ومتابعة'}
                    </PrimaryButton>
                </form>
            </div>
        </GuestLayout>
    );
}
