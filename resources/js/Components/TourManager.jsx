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
        .driver-popover {
            border-radius: 1.5rem !important;
            padding: 20px !important;
            font-family: 'Geist', 'Tajawal', sans-serif !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
            border: 1px solid rgba(226, 232, 240, 1) !important;
            background: linear-gradient(to bottom, #ffffff, #f8fafc) !important;
        }
        .driver-popover-title {
            font-size: 1.25rem !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            margin-bottom: 8px !important;
        }
        .driver-popover-description {
            font-size: 0.9rem !important;
            font-weight: 600 !important;
            color: #475569 !important;
            line-height: 1.6 !important;
        }
        .driver-popover-footer {
            margin-top: 16px !important;
        }
        .driver-popover-next-btn, .driver-popover-prev-btn {
            border-radius: 0.75rem !important;
            padding: 8px 16px !important;
            font-weight: 800 !important;
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
                        title: '🌳 الشجرة التفاعلية',
                        description: 'خريطة مرئية كاملة لكل مواد تخصصك. المنجز بلون، والمتاح بلون، والمغلق بلون لتفهم خطتك بثانية واحدة!',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-feature-2',
                    popover: {
                        title: '🛒 التسجيل التجريبي',
                        description: 'ضيف المواد كأنك بتسجل تسجيل حقيقي! النظام رح يحسب العبء وينبهك لو في تعارض مع الخطة.',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-feature-3',
                    popover: {
                        title: '🤖 الذكاء الاصطناعي',
                        description: 'مستشارك الأكاديمي الشخصي جاهز يقرأ خطتك ويقترحلك أفضل جدول لترفع معدلك!',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-cta-btn',
                    popover: {
                        title: '🚀 افتح خطتي',
                        description: 'اضغط هنا أو على إنهاء لتنتقل مباشرة وتجرب الشجرة بنفسك!',
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
                        title: '🌳 شجرتك الأكاديمية',
                        description: 'هنا تعرض جميع موادك. يمكنك سحب الشاشة للتحرك، والتكبير والتصغير. الأخضر مواد أنهيتها، الأزرق متاح لك الآن!',
                        side: 'left',
                        align: 'center'
                    }
                },
                {
                    element: '#tour-tree-legend', // The legend button
                    popover: {
                        title: '🎨 دليل الألوان',
                        description: 'إذا نسيت معنى أي لون في الشجرة، اضغط هنا لترى دليل الألوان التفصيلي.',
                        side: 'top',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-tree-cart', // The cart toggle button or sidebar
                    popover: {
                        title: '🛒 التسجيل التجريبي',
                        description: 'من هنا يمكنك فتح سلة التسجيل وتجربة إضافة مواد لمعرفة عبئك الدراسي.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-tree-plan', // The study plan toggle button
                    popover: {
                        title: '📅 الخطة الشجرية',
                        description: 'يمكنك أيضاً بناء خطة تخرج كاملة لعدة فصول من هنا وتوزيع المواد عليها.',
                        side: 'right',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-tree-ai', // The AI button
                    popover: {
                        title: '🤖 المرشد الذكي',
                        description: 'اضغط هنا لفتح إعدادات المرشد الذكي واجعله يبني لك الخطة أو يرد على أي استفسار أكاديمي لديك فوراً!',
                        side: 'left',
                        align: 'start'
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
