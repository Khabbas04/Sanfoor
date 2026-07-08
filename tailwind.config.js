import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    // تحديد المسارات التي يبحث فيها Tailwind عن كلاسات لاستخدامها
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            // 🔥 جعل خط Cairo الخط الأساسي لكل الموقع 🔥
            fontFamily: {
                sans: ['Cairo', ...defaultTheme.fontFamily.sans],
            },
            // 1. تعريف ألوان الهوية الخاصة بـ سنفور (Sanfoor Soft Brand)
            colors: {
                brand: {
                    DEFAULT: '#2F80ED',
                    hover: '#2563EB',
                    secondary: '#60A5FA',
                    background: '#F7FAFC',
                    card: '#FFFFFF',
                    text: '#0F172A',
                    muted: '#64748B',
                    border: '#E2E8F0',
                    success: '#22C55E',
                    warning: '#F59E0B',
                    danger: '#EF4444',
                }
            },
            // 2. حركات (Animations) احترافية جاهزة للاستخدام
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'blob': 'blob 7s infinite',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'slideInLeft': 'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slideDown': 'slideDown 0.3s ease-out forwards',
            },
            // 3. تعريف مراحل الحركة (Keyframes)
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-15px)' },
                },
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(20px, -30px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                slideInLeft: {
                    'from': { transform: 'translateX(-100%)' },
                    'to': { transform: 'translateX(0)' },
                },
                slideDown: {
                    'from': { opacity: '0', transform: 'translateY(-10px)' },
                    'to': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            // 4. ظلال (Shadows) ناعمة لهوية سنفور
            boxShadow: {
                'soft': '0 4px 20px -2px rgba(15, 23, 42, 0.05)', // ظل خفيف للبطاقات
                'soft-hover': '0 10px 25px -5px rgba(47, 128, 237, 0.15)', // ظل أزرق عند الـ Hover
            },
            // 5. حواف دائرية خاصة
            borderRadius: {
                'brand': '14px',
            }
        },
    },

    plugins: [
        forms,
        require('@tailwindcss/typography'),
    ],
};