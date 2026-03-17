import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Global language context for Arabic and English UI state.
const LanguageContext = createContext();

const arabicRegex = /[\u0600-\u06FF]/;
const skipSelector = 'script, style, noscript, textarea, code, pre, [data-no-auto-translate], .notranslate';

const translationCache = new Map();
const originalTextNodes = new WeakMap();
const originalAttrValues = new WeakMap();

async function translateTextToEnglish(text) {
    const normalized = (text || '').trim();
    if (!normalized || !arabicRegex.test(normalized)) return text;

    if (translationCache.has(normalized)) {
        return translationCache.get(normalized);
    }

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=en&dt=t&q=${encodeURIComponent(normalized)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Translation request failed');

        const data = await res.json();
        const translated = Array.isArray(data?.[0])
            ? data[0].map((part) => part?.[0] || '').join('')
            : normalized;

        translationCache.set(normalized, translated || normalized);
        return translated || normalized;
    } catch (error) {
        return normalized;
    }
}

function shouldSkipNode(node) {
    const parent = node?.parentElement;
    if (!parent) return true;
    return Boolean(parent.closest(skipSelector));
}

function collectArabicTextNodes(root = document.body) {
    const nodes = [];
    if (!root) return nodes;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();

    while (current) {
        const value = current.nodeValue || '';
        if (value.trim() && arabicRegex.test(value) && !shouldSkipNode(current)) {
            nodes.push(current);
        }
        current = walker.nextNode();
    }

    return nodes;
}

function collectArabicAttributeTargets(root = document.body) {
    const targets = [];
    if (!root) return targets;

    const elements = root.querySelectorAll('[placeholder], [title], [aria-label], [alt]');
    elements.forEach((el) => {
        if (el.closest(skipSelector)) return;

        ['placeholder', 'title', 'aria-label', 'alt'].forEach((attr) => {
            const value = el.getAttribute(attr);
            if (value && arabicRegex.test(value)) {
                targets.push({ el, attr, value });
            }
        });
    });

    return targets;
}

async function translateDomToEnglish(root = document.body) {
    const textNodes = collectArabicTextNodes(root);
    const attrTargets = collectArabicAttributeTargets(root);

    await Promise.all(textNodes.map(async (node) => {
        const original = node.nodeValue;
        if (!original) return;

        if (!originalTextNodes.has(node)) {
            originalTextNodes.set(node, original);
        }

        const translated = await translateTextToEnglish(original);
        if (translated && translated !== original) {
            node.nodeValue = translated;
        }
    }));

    await Promise.all(attrTargets.map(async ({ el, attr, value }) => {
        if (!originalAttrValues.has(el)) {
            originalAttrValues.set(el, {});
        }

        const attrs = originalAttrValues.get(el);
        if (!(attr in attrs)) {
            attrs[attr] = value;
        }

        const translated = await translateTextToEnglish(value);
        if (translated && translated !== value) {
            el.setAttribute(attr, translated);
        }
    }));
}

/**
 * Persist the selected language and share it with all child components.
 */
export function LanguageProvider({ children }) {
    // Default to Arabic unless a previous choice already exists in local storage.
    const [lang, setLang] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('lang') || 'ar';
        return 'ar';
    });

    const observerRef = useRef(null);
    const previousLangRef = useRef(lang);

    useEffect(() => {
        const previousLang = previousLangRef.current;
        localStorage.setItem('lang', lang);

        // Update the HTML language and text direction for accessibility and layout.
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;

        const isAdminRoute = window.location.pathname.startsWith('/admin');
        if (isAdminRoute) {
            previousLangRef.current = lang;
            return;
        }

        if (lang === 'en') {
            translateDomToEnglish(document.body);

            if (!observerRef.current) {
                const domObserver = new MutationObserver((mutations) => {
                    const roots = new Set([document.body]);

                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach((n) => {
                                if (n.nodeType === Node.ELEMENT_NODE) {
                                    roots.add(n);
                                }
                            });
                        }
                    });

                    roots.forEach((root) => {
                        translateDomToEnglish(root);
                    });
                });

                domObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                });

                observerRef.current = domObserver;
            }
        } else {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }

            // The source UI is Arabic-first, so reloading ensures exact original text.
            if (previousLang === 'en') {
                window.location.reload();
            }
        }

        previousLangRef.current = lang;
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
