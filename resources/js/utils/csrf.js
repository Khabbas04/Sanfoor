/**
 * Read the CSRF token from the page meta tag or Laravel's XSRF-TOKEN cookie.
 */
export function getCsrfToken() {
    if (typeof document === 'undefined') {
        return null;
    }

    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (meta) {
        return meta;
    }

    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function csrfHeaders(extra = {}) {
    const token = getCsrfToken();
    return {
        'X-Requested-With': 'XMLHttpRequest',
        ...(token ? { 'X-CSRF-TOKEN': token } : {}),
        ...extra,
    };
}
