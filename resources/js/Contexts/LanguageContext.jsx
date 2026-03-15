import React, { createContext, useContext, useState, useEffect } from 'react';

// Global language context for Arabic and English UI state.
const LanguageContext = createContext();

/**
 * Persist the selected language and share it with all child components.
 */
export function LanguageProvider({ children }) {
    // Default to Arabic unless a previous choice already exists in local storage.
    const [lang, setLang] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('lang') || 'ar';
        return 'ar';
    });

    useEffect(() => {
        localStorage.setItem('lang', lang);

        // Update the HTML language and text direction for accessibility and layout.
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    }, [lang]);

    // Toggle between the two supported interface languages.
    const toggleLang = () => setLang(prev => prev === 'ar' ? 'en' : 'ar');

    return (
        <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

/**
 * Read the language context from any child component.
 */
export function useLanguage() {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }

    return context;
}
