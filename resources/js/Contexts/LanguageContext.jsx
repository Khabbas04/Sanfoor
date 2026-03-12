import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

/**
 * 🌍 مزود اللغة العالمي — يحفظ اللغة في localStorage ويوفرها لجميع المكونات
 */
export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('lang') || 'ar';
        return 'ar';
    });

    useEffect(() => {
        localStorage.setItem('lang', lang);
        // تحديث اتجاه الصفحة تلقائياً
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    }, [lang]);

    const toggleLang = () => setLang(prev => prev === 'ar' ? 'en' : 'ar');

    return (
        <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * 🪝 Hook لاستخدام اللغة في أي مكون
 * @returns {{ lang: string, setLang: Function, toggleLang: Function }}
 */
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
