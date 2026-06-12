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
            // 1. تعريف ألوان الهوية الخاصة بـ سنفور (لسهولة التعديل لاحقاً)
            colors: {
                brand: {
                    DEFAULT: '#1d6ef2', // لون أزرق زاهٍ واحترافي
                    light: '#f0f7ff',   // خلفية زرقاء فاتحة
                    dark: '#0f3a80',    // نص أزرق غامق
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
            // 4. ظلال (Shadows) زجاجية ناعمة ومشعة
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)', // ظل زجاجي
                'glow': '0 0 20px rgba(29, 110, 242, 0.4)', // ظل مشع بلون الهوية الأزرق
            }
        },
    },

    plugins: [
        forms,
        require('@tailwindcss/typography'),
    ],
};