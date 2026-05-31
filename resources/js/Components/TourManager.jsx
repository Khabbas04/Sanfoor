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
        .driver-popover.has-mascot {
            position: relative;
            overflow: visible !important;
        }
        .driver-popover.has-mascot::before {
            content: '';
            position: absolute;
            top: -45px;
            right: -30px;
            width: 85px;
            height: 85px;
            background-image: url('/images/sanfoor.png');
            background-size: cover;
            background-position: center;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            z-index: 100;
            animation: mascotFloat 3s ease-in-out infinite alternate;
            background-color: white;
        }
        @keyframes mascotFloat {
            0% { transform: translateY(0); }
            100% { transform: translateY(-10px); }
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
            .driver-popover.has-mascot::before {
                width: 70px;
                height: 70px;
                top: -35px;
                right: -15px;
            }
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
                        popoverClass: 'driver-theme-sanfoor has-mascot',
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
                    element: '.react-flow', // Use a generic element to center popover, but highlight the whole canvas initially
                    popover: {
                        popoverClass: 'driver-theme-sanfoor has-mascot',
                        title: '👆 التدريب العملي: اختر مادة',
                        description: 'هيا نتدرب معاً! <strong style="color:#0ea5e9;">ابحث عن أي مادة لونها أزرق (متاحة) واضغط عليها</strong> لتفتح نافذة التحكم وتفاصيل المادة.<br/><br/><span style="font-size:0.8rem;color:#64748b;">(لن نكمل حتى تضغط على إحدى المواد!)</span>',
                        side: 'left',
                        align: 'center',
                        showButtons: ['close'] // Force user to click a node
                    },
                    onHighlightStarted: (el) => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: false } }));
                        setTimeout(() => {
                            const nodes = Array.from(document.querySelectorAll('.react-flow__node')).filter(n => n.innerHTML.includes('متاح') && !n.innerHTML.includes('التسجيل التجريبي') && !n.innerHTML.includes('منجز'));
                            if (nodes.length > 0) {
                                const handler = () => {
                                    setTimeout(() => driverObj.moveNext(), 600); // Wait for sidebar to open
                                    nodes.forEach(n => n.removeEventListener('click', handler));
                                };
                                nodes.forEach(n => n.addEventListener('click', handler));
                            } else {
                                setTimeout(() => driverObj.moveNext(), 3000); // Fallback if no available courses
                            }
                        }, 500);
                    }
                },
                {
                    element: '#tour-add-cart-btn',
                    popover: {
                        popoverClass: 'driver-theme-sanfoor has-mascot',
                        title: '🛒 التسجيل التجريبي',
                        description: 'ممتاز! من هذا الزر المضيء، يمكنك إضافة المادة إلى مسودة التسجيل التجريبي، وهذا سيتيح لك قياس تأثيرها على العبء الدراسي قبل أن تنزلها فعلياً بالجامعة.',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-pass-btn',
                    popover: {
                        popoverClass: 'driver-theme-sanfoor has-mascot',
                        title: '✅ إنجاز المادة وإدخال علامتك',
                        description: 'وإذا كنت قد أخذت هذه المادة بالفعل، يمكنك تسجيلها كـ "منجزة" هنا وإدخال معدلك. سيحسبها النظام فوراً ويفتح لك المواد التالية التي تعتمد عليها!',
                        side: 'left',
                        align: 'start'
                    }
                },
                {
                    element: '#tour-tree-cart', // The cart toggle button or sidebar
                    popover: {
                        title: '🛒 مسودة التسجيل (التجريبي)',
                        description: '<div style="margin-bottom:8px;">هل سجلت مواداً تجريبياً؟</div><strong style="color:#0ea5e9;">اضغط على هذا الزر المضيء 👆</strong> لفتح السلة وتجربة إدارتها.',
                        side: 'right',
                        align: 'start',
                        showButtons: ['close'] // Hide Next button to force interaction
                    },
                    onHighlightStarted: (el) => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: true } }));
                        if (el && !el.dataset.tourListenerAttached) {
                            el.dataset.tourListenerAttached = 'true';
                            const handler = () => {
                                setTimeout(() => driverObj.moveNext(), 300);
                                el.removeEventListener('click', handler);
                                delete el.dataset.tourListenerAttached;
                            };
                            el.addEventListener('click', handler);
                        }
                    }
                },
                {
                    element: '#tour-tree-plan', // The study plan toggle button
                    popover: {
                        title: '📅 التخطيط المستقبلي',
                        description: 'لتخطيط أبعد مدى، استخدم تبويب الفصول لتوزيع موادك على فصول دراسية متعددة حتى التخرج.',
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
                        popoverClass: 'driver-theme-sanfoor has-mascot',
                        title: '🤖 المرشد الذكي',
                        description: 'في أي وقت تشعر فيه بالحيرة، اضغط هنا! يمكنني بناء جدولك القادم أوتوماتيكياً واختيار المواد الأفضل لرفع معدلك، أو الإجابة عن أي استفسار أكاديمي يخطر ببالك.',
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
