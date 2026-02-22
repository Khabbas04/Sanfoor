import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';

export default function DeleteUserForm({ className = '' }) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        clearErrors();
        reset();
    };

    return (
        <section className={className}>
            <header className="border-r-4 border-rose-500 pr-4 mb-8">
                <h2 className="text-xl font-bold text-slate-800">
                    حذف الحساب الأكاديمي ⚠️
                </h2>

                <p className="mt-2 text-sm font-medium text-slate-500 leading-relaxed">
                    بمجرد حذف حسابك، سيتم حذف جميع بياناتك وسجلاتك الأكاديمية بشكل نهائي. يرجى التأكد من تحميل أي بيانات ترغب في الاحتفاظ بها قبل المتابعة.
                </p>
            </header>

            <DangerButton
                onClick={confirmUserDeletion}
                className="rounded-2xl px-8 py-3.5 font-black shadow-lg shadow-rose-900/10 active:scale-95 transition-all"
            >
                حذف الحساب نهائياً
            </DangerButton>

            <Modal show={confirmingUserDeletion} onClose={closeModal}>
                <form onSubmit={deleteUser} className="p-8 font-cairo" dir="rtl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-rose-100 shadow-inner animate-bounce">
                            ❗
                        </div>
                        <h2 className="text-2xl font-black text-slate-800">
                            هل أنت متأكد من الحذف؟
                        </h2>
                    </div>

                    <p className="text-sm font-bold text-slate-500 text-center leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        هذا الإجراء لا يمكن التراجع عنه. يرجى إدخال كلمة المرور الخاصة بك لتأكيد رغبتك في حذف الحساب نهائياً من أنظمة سنفور.
                    </p>

                    <div className="mt-8">
                        <InputLabel
                            htmlFor="password"
                            value="كلمة المرور للتأكيد"
                            className="font-black text-slate-700 mb-2 mr-1"
                        />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            className="mt-1 block w-full rounded-2xl border-slate-200 bg-slate-50 focus:bg-white focus:ring-rose-500 transition-all font-bold text-center"
                            isFocused
                            placeholder="كلمة المرور الحالية"
                        />

                        <InputError
                            message={errors.password}
                            className="mt-2 font-bold text-xs"
                        />
                    </div>

                    <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                        <SecondaryButton
                            onClick={closeModal}
                            className="rounded-2xl px-8 py-3 font-black order-2 sm:order-1"
                        >
                            إلغاء العملية
                        </SecondaryButton>

                        <DangerButton
                            className="rounded-2xl px-8 py-3 font-black shadow-lg shadow-rose-900/20 order-1 sm:order-2"
                            disabled={processing}
                        >
                            تأكيد الحذف النهائي
                        </DangerButton>
                    </div>
                </form>
            </Modal>
        </section>
    );
}