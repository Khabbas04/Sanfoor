import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { useForm, usePage } from '@inertiajs/react';

export default function SyncPortalForm({ className = '' }) {
    const user = usePage().props.auth.user;

    const { data, setData, post, processing, errors, reset } = useForm({
        student_id: user.portal_student_id || '',
        password: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('portal.sync'), {
            preserveScroll: true,
            onFinish: () => reset('password'),
        });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-xl font-black text-slate-800 border-r-4 border-indigo-600 pr-3 font-cairo">
                    مزامنة بوابة الجامعة
                </h2>

                <p className="mt-2 text-sm text-slate-500 font-medium font-cairo">
                    أدخل الرقم الجامعي وكلمة المرور لمزامنة التخصص والمعدل والمواد المقطوعة من بوابة جامعة الزرقاء.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-5">
                <div>
                    <InputLabel htmlFor="portal_student_id" value="الرقم الجامعي" />

                    <TextInput
                        id="portal_student_id"
                        className="mt-1 block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                        value={data.student_id}
                        onChange={(e) => setData('student_id', e.target.value)}
                        required
                        autoComplete="username"
                    />

                    <InputError className="mt-2" message={errors.student_id} />
                </div>

                <div>
                    <InputLabel htmlFor="portal_password" value="كلمة مرور البوابة" />

                    <TextInput
                        id="portal_password"
                        type="password"
                        className="mt-1 block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        required
                        autoComplete="current-password"
                    />

                    <InputError className="mt-2" message={errors.password} />
                    <InputError className="mt-2" message={errors.portal_sync} />
                </div>

                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 mt-6 pt-6">
                    <PrimaryButton
                        disabled={processing}
                        className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-6 py-3 font-black shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        {processing ? 'جاري المزامنة...' : 'مزامنة البيانات من البوابة'}
                    </PrimaryButton>
                </div>
            </form>
        </section>
    );
}
