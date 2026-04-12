import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { useForm, usePage } from '@inertiajs/react';

export default function SyncPortalForm({ className = '' }) {
    const user = usePage().props.auth.user;
    const inferredStudentId = String(user?.email || '').split('@')[0] || '';

    const { data, setData, post, processing, errors, reset } = useForm({
        student_id: user.portal_student_id || inferredStudentId,
        password: '',
        academic_year: '',
        academic_term: '1',
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

                {!user.portal_synced_at && (
                    <p className="mt-2 text-xs font-bold text-amber-700 font-cairo">
                        تم تعبئة الرقم الجامعي تلقائياً من بريد Microsoft إن توفر. اختر السنة والفصل المطلوبين ثم اضغط مزامنة.
                    </p>
                )}
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

                <div>
                    <InputLabel htmlFor="portal_academic_year" value="السنة الدراسية (كما تظهر في البوابة)" />

                    <TextInput
                        id="portal_academic_year"
                        className="mt-1 block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                        value={data.academic_year}
                        onChange={(e) => setData('academic_year', e.target.value)}
                        placeholder="مثال: 2024/2025 أو 4"
                        required
                    />

                    <InputError className="mt-2" message={errors.academic_year} />
                </div>

                <div>
                    <InputLabel htmlFor="portal_academic_term" value="الفصل" />

                    <select
                        id="portal_academic_term"
                        value={data.academic_term}
                        onChange={(e) => setData('academic_term', e.target.value)}
                        className="mt-1 block w-full rounded-xl border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700 shadow-sm transition-all"
                        required
                    >
                        <option value="1">الأول</option>
                        <option value="2">الثاني</option>
                        <option value="3">الصيفي</option>
                    </select>

                    <InputError className="mt-2" message={errors.academic_term} />
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
