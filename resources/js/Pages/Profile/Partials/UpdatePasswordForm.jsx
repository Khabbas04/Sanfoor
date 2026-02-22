import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { useForm } from '@inertiajs/react';
import { useRef } from 'react';

export default function UpdatePasswordForm({ className = '' }) {
    const passwordInput = useRef();
    const currentPasswordInput = useRef();

    const {
        data,
        setData,
        errors,
        put,
        reset,
        processing,
        recentlySuccessful,
    } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e) => {
        e.preventDefault();

        put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => reset(),
            onError: (errors) => {
                if (errors.password) {
                    reset('password', 'password_confirmation');
                    passwordInput.current.focus();
                }

                if (errors.current_password) {
                    reset('current_password');
                    currentPasswordInput.current.focus();
                }
            },
        });
    };

    return (
        <section className={className}>
            <header className="border-r-4 border-indigo-600 pr-4 mb-8">
                <h2 className="text-xl font-bold text-slate-800">
                    تأمين الحساب 🛡️
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-500 leading-relaxed">
                    تأكد من استخدام كلمة مرور قوية وطويلة لضمان بقاء حسابك الأكاديمي آمناً.
                </p>
            </header>

            <form onSubmit={updatePassword} className="space-y-6">
                <div className="group">
                    <InputLabel
                        htmlFor="current_password"
                        value="كلمة المرور الحالية"
                        className="font-black text-slate-700 mb-2 mr-1"
                    />

                    <TextInput
                        id="current_password"
                        ref={currentPasswordInput}
                        value={data.current_password}
                        onChange={(e) =>
                            setData('current_password', e.target.value)
                        }
                        type="password"
                        className="mt-1 block w-full rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-bold"
                        autoComplete="current-password"
                    />

                    <InputError
                        message={errors.current_password}
                        className="mt-2 font-bold text-xs"
                    />
                </div>

                <div className="group">
                    <InputLabel
                        htmlFor="password"
                        value="كلمة المرور الجديدة"
                        className="font-black text-slate-700 mb-2 mr-1"
                    />

                    <TextInput
                        id="password"
                        ref={passwordInput}
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        type="password"
                        className="mt-1 block w-full rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-bold"
                        autoComplete="new-password"
                    />

                    <InputError message={errors.password} className="mt-2 font-bold text-xs" />
                </div>

                <div className="group">
                    <InputLabel
                        htmlFor="password_confirmation"
                        value="تأكيد كلمة المرور الجديدة"
                        className="font-black text-slate-700 mb-2 mr-1"
                    />

                    <TextInput
                        id="password_confirmation"
                        value={data.password_confirmation}
                        onChange={(e) =>
                            setData('password_confirmation', e.target.value)
                        }
                        type="password"
                        className="mt-1 block w-full rounded-2xl border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500 transition-all font-bold"
                        autoComplete="new-password"
                    />

                    <InputError
                        message={errors.password_confirmation}
                        className="mt-2 font-bold text-xs"
                    />
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                    <button
                        disabled={processing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-indigo-900/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                        تحديث كلمة المرور 🔐
                    </button>

                    <Transition
                        show={recentlySuccessful}
                        enter="transition ease-in-out"
                        enterFrom="opacity-0 translate-x-2"
                        leave="transition ease-in-out"
                        leaveTo="opacity-0"
                    >
                        <p className="text-sm font-black text-emerald-600 flex items-center gap-2">
                            <span>✅</span> تم الحفظ بنجاح
                        </p>
                    </Transition>
                </div>
            </form>
        </section>
    );
}