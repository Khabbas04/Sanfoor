import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { router } from '@inertiajs/react';
import Swal from 'sweetalert2';

// Custom CSS added via global style injection to keep it clean and localized
const injectTourStyles = () => {
    if (document.getElementById('sanfoor-tour-styles')) return;
    const style = document.createElement('style');
    style.id = 'sanfoor-tour-styles';
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        
        @keyframes tourBloop {
            0% { opacity: 0; transform: translateY(20px) scale(0.9); }
            50% { transform: translateY(-5px) scale(1.02); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        /* Force Cairo on everything in the tour */
        .driver-popover * {
            font-family: 'Cairo', sans-serif !important;
        }

        .driver-popover {
            border-radius: 1.5rem !important;
            padding: 24px !important;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 30px rgba(14, 165, 233, 0.15) !important;
            border: 1px solid rgba(255, 255, 255, 0.5) !important;
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
            animation: tourBloop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards !important;
        }

        @media (max-width: 640px) {
            .driver-popover {
                max-width: 92vw !important;
                padding: 16px !important;
                border-radius: 1.25rem !important;
            }
            .driver-popover-title {
                font-size: 1.15rem !important;
                margin-bottom: 6px !important;
            }
            .driver-popover-description {
                font-size: 0.85rem !important;
                line-height: 1.5 !important;
            }
            .driver-popover-footer {
                margin-top: 12px !important;
            }
            .driver-popover-next-btn, .driver-popover-prev-btn {
                padding: 6px 12px !important;
                font-size: 0.8rem !important;
            }
        }

        .driver-popover-title {
            font-size: 1.35rem !important;
            font-weight: 900 !important;
            color: #0f172a !important;
            margin-bottom: 8px !important;
            background: linear-gradient(135deg, #0ea5e9, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .driver-popover-description {
            font-size: 0.95rem !important;
            font-weight: 600 !important;
            color: #334155 !important;
            line-height: 1.7 !important;
        }

        .driver-popover-footer {
            margin-top: 20px !important;
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
        }

        .driver-popover-next-btn, .driver-popover-prev-btn {
            border-radius: 0.75rem !important;
            padding: 8px 18px !important;
            font-weight: 800 !important;
            font-size: 0.9rem !important;
            text-shadow: none !important;
            border: none !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }

        .driver-popover-next-btn {
            background: linear-gradient(135deg, #0ea5e9, #3b82f6) !important;
            color: white !important;
            box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.3) !important;
        }
        .driver-popover-next-btn:hover {
            transform: translateY(-2px) scale(1.02) !important;
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4) !important;
        }

        .driver-popover-prev-btn {
            background: #f1f5f9 !important;
            color: #475569 !important;
        }
        .driver-popover-prev-btn:hover {
            background: #e2e8f0 !important;
            color: #1e293b !important;
        }

        .driver-popover-close-btn {
            color: #94a3b8 !important;
            top: 15px !important;
            right: 15px !important;
            transition: color 0.2s ease, transform 0.2s ease !important;
        }
        .driver-popover-close-btn:hover {
            color: #ef4444 !important;
            transform: rotate(90deg) !important;
        }

        .driver-popover-progress-text {
            font-weight: 800 !important;
            color: #64748b !important;
            font-size: 0.85rem !important;
            background: #f1f5f9 !important;
            padding: 4px 10px !important;
            border-radius: 20px !important;
        }

        /* RTL Support */
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
    
    // Smooth scroll to top first
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
        const driverObj = driver({
            showProgress: true,
            animate: true,
            popoverClass: 'driver-theme-sanfoor',
            allowClose: true,
            overlayOpacity: 0.8,
            doneBtnText: 'جاهز؟ انطلق! 🚀',
            nextBtnText: 'التالي ←',
            prevBtnText: '→ السابق',
            progressText: '{{current}} من {{total}}',
            onPopoverRender: (popover) => {
                popover.wrapper.setAttribute('dir', 'rtl');
            },
            onDestroyed: () => {
                localStorage.setItem('sanfoor_tour', 'tree_pending');
                router.visit(route('tree.index'));
            },
            steps: [
                {
                    popover: {
                        title: '👋 أهلاً بك في سنفور',
                        description: 'المنصة الأذكى والأسرع لتخطيط مسارك الجامعي. دعنا نأخذك في جولة سريعة لنريك كيف يمكنك إنهاء معاناتك مع الجداول الأكاديمية للأبد!',
                        side: 'center',
                        align: 'center'
                    }
                },
                {
                    element: '#features',
                    popover: {
                        title: '✨ مميزات ذكية متكاملة',
                        description: 'بدلاً من البحث المشتت، جمعنا لك كل ما تحتاجه هنا: الشجرة التفاعلية، الذكاء الاصطناعي، الشباتر، التسجيل التجريبي وبنك الأسئلة. كل شيء في مكان واحد لخدمتك!',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: 'section:nth-of-type(3)', // Tree Preview Section
                    popover: {
                        title: '🌳 الشجرة التفاعلية',
                        description: 'بمجرد تسجيل دخولك، سنقوم ببناء خريطة مرئية (شجرة) ذكية لموادك. يمكنك من خلالها معرفة المواد المنجزة والمفتوحة بلمحة بصر!',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: 'section:nth-of-type(4)', // AI Section
                    popover: {
                        title: '🤖 الذكاء الاصطناعي',
                        description: '<div style="display:flex; gap:15px; align-items:center;"><img src="/images/ai_robot.png" style="width:64px; height:64px; border-radius:16px; object-fit:cover; background:white; box-shadow:0 8px 16px rgba(14,165,233,0.15); border:1px solid #e2e8f0; margin-top:5px; flex-shrink:0;"/><div style="line-height: 1.6;">AI Sanfoor هو مساعدك الشخصي. يقرأ خطتك ويقترح لك أفضل جدول لتسجيل المواد لرفع معدلك بأسرع وقت!</div></div>',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: 'section:nth-of-type(5)', // Workflow Section
                    popover: {
                        title: '⚡ ٣ خطوات فقط',
                        description: 'العملية بسيطة جداً: اختار تخصصك، حدد موادك المنجزة، ثم خطط بذكاء! النظام سيقوم بالباقي.',
                        side: 'top',
                        align: 'center'
                    }
                },
                {
                    element: 'section:nth-of-type(6)', // CTA
                    popover: {
                        title: '🚀 حان وقت الانطلاق',
                        description: 'انضم لآلاف الطلاب اللي غيروا طريقتهم بالتخطيط. جاهز تبدأ؟',
                        side: 'top',
                        align: 'center'
                    }
                }
            ]
        });
        driverObj.drive();
    }, 500); 
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
                
                // Show professional summary alert
                Swal.fire({
                    title: '<strong>فهمت اللعبة؟ 🎯</strong>',
                    html: `
                        <div style="font-family: 'Cairo', sans-serif; line-height: 1.8; color: #475569; font-size: 0.95rem;">
                            الشجرة هاي رح توفر عليك ساعات من التخطيط والتفكير!<br><br>
                            ببساطة: أي مادة <b>لونها أزرق</b> بتقدر تنزلها فوراً وتجربها بالسلة، والمواد المقفلة رح يحكيلك النظام ليش مقفلة وايش ناقصك لتفتحها.<br><br>
                            <span style="color: #0ea5e9; font-weight: bold;">تجنب التعارضات وسجل بثقة!</span>
                        </div>
                    `,
                    icon: 'success',
                    iconColor: '#10b981',
                    confirmButtonText: 'يلا نبدأ 🚀',
                    confirmButtonColor: '#0ea5e9',
                    background: 'rgba(255,255,255,0.98)',
                    backdrop: `rgba(15, 23, 42, 0.6) blur(4px)`,
                    customClass: {
                        title: 'font-cairo text-2xl font-black text-slate-800',
                        htmlContainer: 'font-cairo',
                        confirmButton: 'font-cairo font-bold rounded-xl px-8 py-3 shadow-lg shadow-sky-500/30'
                    },
                    showClass: {
                        popup: 'animate__animated animate__zoomIn animate__faster'
                    },
                    hideClass: {
                        popup: 'animate__animated animate__zoomOut animate__faster'
                    }
                });
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
                        description: 'من هنا يمكنك فتح سلة المواد، واختيار المواد التي ترغب بتجربة تسجيلها لمعرفة إذا كان هنالك أي تعارض أو مشاكل بالخطة.',
                        side: 'right',
                        align: 'start'
                    },
                    onHighlightStarted: () => {
                        window.dispatchEvent(new CustomEvent('tour-update', { detail: { sidebar: true } }));
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
                        description: '<div style="display:flex; gap:15px; align-items:center;"><img src="/images/ai_robot.png" style="width:64px; height:64px; border-radius:16px; object-fit:cover; background:white; box-shadow:0 8px 16px rgba(14,165,233,0.15); border:1px solid #e2e8f0; margin-top:5px; flex-shrink:0;"/><div style="line-height: 1.6;">عندما تفتح نافذة التخطيط، اضغط هنا لدعوة الذكاء الاصطناعي لبناء جدولك القادم أوتوماتيكياً أو للإجابة عن استفساراتك.</div></div>',
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
