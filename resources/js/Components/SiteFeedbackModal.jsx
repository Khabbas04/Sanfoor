import React, { useState, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';

export default function SiteFeedbackModal() {
    const { auth } = usePage().props;
    const hasSubmitted = auth?.user?.has_submitted_feedback;
    const isEligible = auth?.user?.is_eligible_for_feedback;
    const isGuest = auth?.user?.is_guest;
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredStar, setHoveredStar] = useState(0);

    const { data, setData, post, processing, errors } = useForm({
        rating: 0,
        comments: '',
        status: 'submitted',
    });

    useEffect(() => {
        // Show modal only if user is logged in, not a guest, hasn't submitted yet, and IS eligible (used the site)
        if (auth?.user && !isGuest && hasSubmitted === false && isEligible) {
            // Show after 5 seconds to not interrupt their initial view
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [auth, hasSubmitted, isEligible, isGuest]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const submit = (e) => {
        e.preventDefault();
        post(route('site_feedbacks.store'), {
            preserveScroll: true,
            onSuccess: () => setIsOpen(false),
        });
    };

    const handleSkip = () => {
        setData('status', 'skipped');
        setData('rating', 0);
        setData('comments', '');
        post(route('site_feedbacks.store'), {
            preserveScroll: true,
            onSuccess: () => setIsOpen(false),
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

            {/* Modal Content */}
            <div
                dir="rtl"
                className="relative bg-white/90 backdrop-blur-xl border border-white/50 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
            >
                {/* Decorative glows */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="p-8 relative z-10">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center shadow-inner">
                            <span className="text-3xl animate-bounce">🌟</span>
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 text-center mb-2">
                        رأيك يهمنا جداً!
                    </h2>
                    <p className="text-[13px] font-bold text-slate-500 text-center mb-6 leading-relaxed">
                        كيف تقيم تجربتك مع منصة سنفور حتى الآن؟ نحن نسعى دائماً لتطوير المنصة لتلبي احتياجاتك.
                    </p>

                    <form onSubmit={submit} className="space-y-6">
                        {/* Star Rating */}
                        <div className="flex justify-center gap-2" dir="ltr">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setData('rating', star)}
                                    onMouseEnter={() => setHoveredStar(star)}
                                    onMouseLeave={() => setHoveredStar(0)}
                                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                                >
                                    <svg
                                        className={`w-10 h-10 transition-colors duration-200 ${
                                            star <= (hoveredStar || data.rating)
                                                ? 'text-yellow-400 drop-shadow-sm'
                                                : 'text-slate-200'
                                        }`}
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                    >
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                        {errors.rating && <p className="text-red-500 text-xs font-bold text-center">{errors.rating}</p>}

                        {/* Comments */}
                        <div>
                            <textarea
                                value={data.comments}
                                onChange={(e) => setData('comments', e.target.value)}
                                placeholder="أخبرنا عن تجربتك، اقتراحاتك، أو أي مشكلة واجهتك... (اختياري)"
                                className="w-full h-28 p-4 text-[13px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all resize-none"
                            />
                            {errors.comments && <p className="text-red-500 text-xs font-bold mt-1">{errors.comments}</p>}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={processing || data.rating === 0}
                                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[14px] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-slate-900/20"
                            >
                                {processing ? 'جاري الإرسال...' : 'إرسال التقييم'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSkip}
                                disabled={processing}
                                className="w-full py-3 text-[13px] font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                تخطي مؤقتاً
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
