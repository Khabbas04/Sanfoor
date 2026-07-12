// ============================================================
// Sanfoor Load Testing Script (k6)
// ============================================================
// Usage:
//   k6 run load-test.js                    # Default (20 users, 1 min)
//   k6 run --vus 100 --duration 5m load-test.js  # Heavy load
//   k6 run --vus 500 --duration 10m load-test.js # Stress test
//
// Install k6:
//   Windows: choco install k6
//   Ubuntu:  sudo apt install k6
//   macOS:   brew install k6
// ============================================================

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── Custom Metrics ──────────────────────────────────────────
const errorRate = new Rate('errors');
const pageLoadTime = new Trend('page_load_time');
const apiResponseTime = new Trend('api_response_time');
const successfulLogins = new Counter('successful_logins');

// ── Test Configuration ──────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'https://sanfoor.me';

export const options = {
    stages: [
        { duration: '30s', target: 20 },   // Ramp up to 20 users
        { duration: '1m',  target: 50 },   // Hold at 50 users
        { duration: '30s', target: 100 },  // Spike to 100 users
        { duration: '1m',  target: 100 },  // Hold at 100 users
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<3000'],  // 95% of requests under 3s
        http_req_failed:   ['rate<0.05'],   // Less than 5% failure rate
        errors:            ['rate<0.1'],    // Less than 10% error rate
    },
};

// ── Helper Functions ────────────────────────────────────────
function getCSRFToken() {
    const res = http.get(`${BASE_URL}/login`);
    const match = res.body.match(/name="csrf-token"\s+content="([^"]+)"/);
    if (!match) {
        const match2 = res.body.match(/"csrfToken":"([^"]+)"/);
        return match2 ? match2[1] : '';
    }
    return match[1];
}

// ── Test Scenarios ──────────────────────────────────────────
export default function () {
    // Scenario 1: Homepage Load
    group('Homepage', function () {
        const res = http.get(`${BASE_URL}/`);
        pageLoadTime.add(res.timings.duration);
        const success = check(res, {
            'homepage status is 200': (r) => r.status === 200,
            'homepage loads under 2s': (r) => r.timings.duration < 2000,
        });
        errorRate.add(!success);
    });

    sleep(1);

    // Scenario 2: Login Page Load
    group('Login Page', function () {
        const res = http.get(`${BASE_URL}/login`);
        pageLoadTime.add(res.timings.duration);
        check(res, {
            'login page status is 200': (r) => r.status === 200,
        });
    });

    sleep(1);

    // Scenario 3: Guest Demo Entry (Simulates many students entering)
    group('Guest Demo', function () {
        const res = http.get(`${BASE_URL}/guest-demo/enter`, {
            redirects: 5,
        });
        apiResponseTime.add(res.timings.duration);
        const success = check(res, {
            'guest demo responded': (r) => r.status === 200 || r.status === 302,
            'guest demo under 5s': (r) => r.timings.duration < 5000,
        });
        errorRate.add(!success);
    });

    sleep(2);

    // Scenario 4: API Health Check (lightweight endpoint)
    group('API Health', function () {
        const res = http.get(`${BASE_URL}/sanctum/csrf-cookie`);
        apiResponseTime.add(res.timings.duration);
        check(res, {
            'csrf cookie status 204': (r) => r.status === 204 || r.status === 200,
        });
    });

    sleep(1);
}

// ── Summary Report ──────────────────────────────────────────
export function handleSummary(data) {
    const now = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    return {
        'stdout': textSummary(data, { indent: '  ', enableColors: true }),
        [`load-test-results-${now}.json`]: JSON.stringify(data, null, 2),
    };
}

function textSummary(data, opts) {
    // k6 provides a built-in text summary
    return '';
}
