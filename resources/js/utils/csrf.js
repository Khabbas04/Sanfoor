/**
 * Read the CSRF token from Laravel's XSRF-TOKEN cookie.
 * This ensures the token is always up-to-date even after Inertia navigations
 * where the session is regenerated (e.g., login/register).
 */
export function getCsrfToken() {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export function csrfHeaders(extra = {}) {
    const token = getCsrfToken();
    return {
        'X-Requested-With': 'XMLHttpRequest',
        // We use X-XSRF-TOKEN because the token from the cookie is encrypted.
        // Laravel expects the encrypted token in this header.
        ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        ...extra,
    };
}
