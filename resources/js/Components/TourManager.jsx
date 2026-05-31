import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { router } from '@inertiajs/react';

// Custom CSS added via global style injection to keep it clean and localized
const injectTourStyles = () => {
    if (document.getElementById('sanfoor-tour-styles')) return;
    const style = document.createElement('style');
    style.id = 'sanfoor-tour-styles';
    style.innerHTML = `
        @keyframes tourBloop {
            0% { opacity: 0; transform: translateY(15px) scale(0.95); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .driver-popover {
            border-radius: 1.5rem !important;
            padding: 24px !important;
            font-family: 'Cairo', sans-serif !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 15px rgba(14, 165, 233, 0.15) !important;
            border: 1px solid rgba(226, 232, 240, 1) !important;
            background: linear-gradient(to bottom, #ffffff, #f8fafc) !important;
            animation: tourBloop 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (max-width: 640px) {
            .driver-popover {
                max-width: 90vw !important;
                padding: 18px !important;
                border-radius: 1.25rem !important;
            }
            .driver-popover-title {
                font-size: 1.1rem !important;
            }
            .driver-popover-description {
                font-size: 0.85rem !important;
            }
        }
        .driver-popover-title {
            font-size: 1.25rem !important;
            font-weight: 800 !important;
            font-family: 'Cairo', sans-serif !important;
            color: #0f172a !important;
            margin-bottom: 8px !important;
        }
        .driver-popover-description {
            font-size: 0.9rem !important;
            font-weight: 600 !important;
            font-family: 'Cairo', sans-serif !important;
            color: #475569 !important;
            line-height: 1.6 !important;
        }
        .driver-popover-footer {
            margin-top: 16px !important;
        }
        .driver-popover-next-btn, .driver-popover-prev-btn {
            border-radius: 0.75rem !important;
            padding: 8px 16px !important;
            font-weight: 700 !important;
            font-family: 'Cairo', sans-serif !important;
            font-size: 0.85rem !important;
            text-shadow: none !important;
            border: none !important;
            transition: all 0.2s ease !important;
        }
        .driver-popover-next-btn {
            background: linear-gradient(to right, #0ea5e9, #3b82f6) !important;
            color: white !important;
            box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.39) !important;
        }
        .driver-popover-next-btn:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4) !important;
        }
        .driver-popover-prev-btn {
            background: #f1f5f9 !important;
            color: #64748b !important;
        }
        .driver-popover-prev-btn:hover {
            background: #e2e8f0 !important;
            color: #334155 !important;
        }
        .driver-popover-close-btn {
            color: #94a3b8 !important;
            top: 15px !important;
            right: 15px !important;
        }
        .driver-popover-close-btn:hover {
            color: #ef4444 !important;
        }
        .driver-popover-progress-text {
            font-weight: 800 !important;
            color: #94a3b8 !important;
            font-size: 0.8rem !important;
        }
        /* RTL Support for popovers */
        .driver-popover[dir="rtl"] {
            text-align: right;
        }
        .driver-popover[dir="rtl"] .driver-popover-close-btn {
            right: auto !important;
            left: 15px !important;
        }
    `;
    document.head.appendChild(style);
};

export const startWelcomeTour = () => {
    injectTourStyles();
    
    // Smooth scroll to features first
    const featuresSection = document.getElementById('features');
    if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            popoverClass: 'driver-theme-sanfoor',
            allowClose: false,
            overlayOpacity: 0.75,
            doneBtnText: 'جاهز؟ انطلق! 🚀',
            nextBtnText: 'التالي ←',
            prevBtnText: '→ السابق',
            progressText: '{{current}} من {{total}}',
            onPopoverRender: (popover) => {
                popover.wrapper.setAttribute('dir', 'rtl');
            },
            onDestroyed: () => {
                // If they close or finish the welcome tour, setup the tree tour pending state
                localStorage.setItem('sanfoor_tour', 'tree_pending');
                
                // Navigate to the tree page smoothly
                router.visit(route('tree.index'));
            },
            steps: [
                {
                    element: '#tour-feature-1',
                    popover: {
                        title: '🌳 خطتك الدراسية بين يديك',
                        description: 'تخلص من الجداول الورقية المعقدة! شجرتك التفاعلية توضح لك بنظرة واحدة المواد المنجزة، المتاحة للتسجيل، والمغلقة بألوان مريحة للعين لتفهم خطتك بثانية واحدة.',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-feature-2',
                    popover: {
                        title: '🛒 جرب قبل أن تسجل',
                        description: 'خاصية التسجيل التجريبي تتيح لك اختيار المواد وقياس العبء الدراسي مسبقاً. سنقوم بتنبيهك تلقائياً في حال وجود أي تعارض مع قوانين الخطة.',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-feature-3',
                    popover: {
                        title: '🤖 مرشدك الأكاديمي الذكي',
                        description: 'لا داعي للحيرة في اختيار موادك! مساعد الذكاء الاصطناعي (AI Sanfoor) يقرأ خطتك ويقترح لك أفضل جدول لرفع معدلك التراكمي في ثوانٍ.',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-cta-btn',
                    popover: {
                        title: '🚀 انطلق الآن',
                        description: 'الخطوة الأولى تبدأ من هنا! اضغط لفتح خطتك الدراسية واستكشاف هذه الميزات بنفسك فوراً.',
                        side: 'top',
                        align: 'center'
                    }
                }
            ]
        });
        driverObj.drive();
    }, 800); // Wait for scroll
};

export const startTreeTour = () => {
    injectTourStyles();
    
    setTimeout(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            popoverClass: 'driver-theme-sanfoor',
            allowClose: true,
            overlayOpacity: 0.75,
            doneBtnText: 'فهمت، شكراً!',
            nextBtnText: 'التالي ←',
            prevBtnText: '→ السابق',
            progressText: '{{current}} من {{total}}',
            onPopoverRender: (popover) => {
                popover.wrapper.setAttribute('dir', 'rtl');
            },
            onDestroyed: () => {
                // Mark tour as completely done
                localStorage.setItem('sanfoor_tour', 'completed');
            },
            steps: [
                {
                    element: '.react-flow', // The main tree canvas
                    popover: {
                        title: '🌳 مساحتك الأكاديمية',
                        description: 'مرحباً بك في شجرتك! يمكنك التحرك بحرية عبر السحب، والتكبير والتصغير. المواد باللون الأخضر هي ما أنجزته، وباللون الأزرق هي ما يمكنك تسجيله الآن.',
                        side: 'left',
                        align: 'center'
                    },
                    onHighlightStarted: () => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: false } }));
                    }
                },
                {
                    element: '#tour-tree-legend', // The legend button
                    popover: {
                        title: '🎨 ماذا تعني هذه الألوان؟',
                        description: 'في حال احتجت لتذكر دلالات الألوان في الشجرة، اضغط هنا لفتح الدليل التفصيلي في أي وقت.',
                        side: 'top',
                        align: 'start'
                    },
                    onHighlightStarted: () => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: false } }));
                    }
                },
                {
                    element: '#tour-tree-cart', // The cart toggle button or sidebar
                    popover: {
                        title: '🛒 مسودة التسجيل (التجريبي)',
                        description: 'من هذا التبويب، يمكنك فتح سلة التسجيل وتجربة إضافة مواد لمعرفة مجموع الساعات وتأثيرها على عبئك الدراسي.',
                        side: 'right',
                        align: 'start'
                    },
                    onHighlightStarted: () => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: true, tab: 'simulator' } }));
                    }
                },
                {
                    element: '#tour-tree-plan', // The study plan toggle button
                    popover: {
                        title: '📅 التخطيط المستقبلي',
                        description: 'هل ترغب بالتخطيط لعدة فصول للأمام؟ استخدم تبويب الفصول لتوزيع موادك المتبقية حتى التخرج بكل سهولة.',
                        side: 'right',
                        align: 'start'
                    },
                    onHighlightStarted: () => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: true, tab: 'semesters' } }));
                    }
                },
                {
                    element: '#tour-tree-ai', // The AI button
                    popover: {
                        title: '🤖 المرشد الذكي',
                        description: 'عندما تفتح نافذة التخطيط، اضغط هنا لدعوة الذكاء الاصطناعي لبناء جدولك القادم أوتوماتيكياً أو للإجابة عن استفساراتك.',
                        side: 'left',
                        align: 'start'
                    },
                    onHighlightStarted: () => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: true, tab: 'simulator' } }));
                    }
                }
            ]
        });
        driverObj.drive();
    }, 1000); // Give the tree a second to render
};

export default function TourManager() {
    // This is a utility component, it doesn't render anything visually by itself
    return null;
}
