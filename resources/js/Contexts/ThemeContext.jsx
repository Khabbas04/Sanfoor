import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Global theme context for dark and light mode state.
const ThemeContext = createContext();

const skipAutoDarkSelector = 'script, style, noscript, iframe, canvas, svg, img, video, picture, source, [data-no-auto-dark], .no-auto-dark';

function parseRgb(color) {
    const match = color?.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (!match) return null;
    return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] !== undefined ? Number(match[4]) : 1,
    };
}

function luminance({ r, g, b }) {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function withAlpha(r, g, b, a = 1) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function markAndSet(el, key, prop, value) {
    const attrName = `data-auto-dark-orig-${key}`;
    if (!el.hasAttribute(attrName)) {
        el.setAttribute(attrName, el.style[prop] || '');
    }
    el.style[prop] = value;
    el.setAttribute('data-auto-dark', '1');
}

function applyAutoDarkToElement(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest(skipAutoDarkSelector)) return;

    const styles = window.getComputedStyle(el);

    const bg = parseRgb(styles.backgroundColor);
    const hasGradientOrImage = styles.backgroundImage && styles.backgroundImage !== 'none';
    if (bg && bg.a > 0.02 && !hasGradientOrImage) {
        const bgLum = luminance(bg);
        if (bgLum > 0.9) {
            markAndSet(el, 'bg', 'backgroundColor', withAlpha(15, 23, 42, Math.max(bg.a, 0.95)));
        } else if (bgLum > 0.75) {
            markAndSet(el, 'bg', 'backgroundColor', withAlpha(30, 41, 59, Math.max(bg.a, 0.9)));
        } else if (bgLum > 0.6) {
            markAndSet(el, 'bg', 'backgroundColor', withAlpha(51, 65, 85, Math.max(bg.a, 0.86)));
        }
    }

    const fg = parseRgb(styles.color);
    if (fg) {
        const fgLum = luminance(fg);
        if (fgLum < 0.45) {
            markAndSet(el, 'color', 'color', withAlpha(226, 232, 240, fg.a || 1));
        }
    }

    const border = parseRgb(styles.borderColor);
    const borderWidth = parseFloat(styles.borderTopWidth || '0');
    if (border && borderWidth > 0) {
        const borderLum = luminance(border);
        if (borderLum > 0.6) {
            markAndSet(el, 'border', 'borderColor', withAlpha(148, 163, 184, 0.28));
        }
    }
}

function applyAutoDark(root = document.body) {
    if (!root) return;

    if (root instanceof HTMLElement) {
        applyAutoDarkToElement(root);
        root.querySelectorAll('*').forEach((el) => applyAutoDarkToElement(el));
    } else if (root === document.body) {
        document.body.querySelectorAll('*').forEach((el) => applyAutoDarkToElement(el));
    }
}

function restoreAutoDark() {
    const elements = document.querySelectorAll('[data-auto-dark="1"]');

    elements.forEach((el) => {
        if (!(el instanceof HTMLElement)) return;

        const bg = el.getAttribute('data-auto-dark-orig-bg');
        const color = el.getAttribute('data-auto-dark-orig-color');
        const border = el.getAttribute('data-auto-dark-orig-border');

        if (bg !== null) {
            el.style.backgroundColor = bg;
            el.removeAttribute('data-auto-dark-orig-bg');
        }
        if (color !== null) {
            el.style.color = color;
            el.removeAttribute('data-auto-dark-orig-color');
        }
        if (border !== null) {
            el.style.borderColor = border;
            el.removeAttribute('data-auto-dark-orig-border');
        }

        el.removeAttribute('data-auto-dark');
    });
}

export function ThemeProvider({ children }) {
    // Initialize from local storage first, defaulting to light mode (false) if not set.
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            return saved === 'dark';
        }
        return false;
    });

    const observerRef = useRef(null);

    useEffect(() => {
        const root = window.document.documentElement;
        const isAdminRoute = window.location.pathname.startsWith('/admin');

        // Keep the DOM class and local storage value in sync with the selected theme.
        if (isDark) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');

            if (!isAdminRoute) {
                root.classList.add('user-auto-dark');
                applyAutoDark(document.body);

                if (!observerRef.current) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            mutation.addedNodes.forEach((node) => {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    applyAutoDark(node);
                                }
                            });
                        });
                    });

                    observer.observe(document.body, {
                        childList: true,
                        subtree: true,
                    });

                    observerRef.current = observer;
                }
            }
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');

            root.classList.remove('user-auto-dark');
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            restoreAutoDark();
        }

        if (isDark && isAdminRoute) {
            root.classList.remove('user-auto-dark');
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            restoreAutoDark();
        }
    }, [isDark]);

    // Expose a single toggle helper to consuming components.
    const toggleTheme = () => setIsDark(prev => !prev);

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme, setIsDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}
