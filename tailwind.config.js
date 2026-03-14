import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    // تحديد المسارات التي يبحث فيها Tailwind عن كلاسات لاستخدامها
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            // 🔥 جعل خط Tajawal الخط الأساسي لكل الموقع 🔥
            fontFamily: {
                sans: ['Tajawal', ...defaultTheme.fontFamily.sans],
            },
            // 1. تعريف ألوان الهوية الخاصة بـ سنفور (لسهولة التعديل لاحقاً)
            colors: {
                brand: {
                    DEFAULT: '#4f46e5', // لون الـ Indigo-600 كافتراضي
                    light: '#eef2ff',   // خلفية فاتحة
                    dark: '#312e81',    // نص غامق
                }
            },
            // 2. حركات (Animations) احترافية جاهزة للاستخدام
            animation: {
                'float': 'float 6s ease-in-out infinite', // حركة طفو للأيقونات
                'blob': 'blob 7s infinite', // حركة تمايل للخلفيات المدمجة
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite', // نبض بطيء
            },
            // 3. تعريف مراحل الحركة (Keyframes)
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-15px)' }, // حركة طفو ناعمة للأعلى
                },
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(20px, -30px) scale(1.1)' }, // حركة عشوائية 1
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },  // حركة عشوائية 2
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                }
            },
            // 4. ظلال (Shadows) زجاجية ناعمة ومشعة
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)', // ظل زجاجي
                'glow': '0 0 20px rgba(79, 70, 229, 0.4)', // ظل مشع بلون الهوية
            }
        },
    },

    // إضافة plugin النماذج (forms)
    plugins: [
        forms,
        // يمكنك إضافة 'tailwind-scrollbar-hide' هنا مستقبلاً إذا احتجته
    ],
};