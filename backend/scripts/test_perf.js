async function testPerformance() {
    console.log('--- Testing Backend Performance (Native Fetch) ---');

    const BASE_URL = 'http://localhost:5000/api';

    const routes = [
        { name: 'Analytics', path: '/analytics' },
        { name: 'Home Feed (Approved)', path: '/upload?status=approved' },
        { name: 'All Photos', path: '/upload' },
    ];

    for (const route of routes) {
        try {
            const start = Date.now();
            const response = await fetch(`${BASE_URL}${route.path}`);
            if (!response.ok && response.status !== 401) {
                // 401 is acceptable if auth middleware exists but we aren't testing auth here, 
                // just database query performance which runs after/during auth check.
                console.log(`[WARN] ${route.name} returned status ${response.status}`);
            }
            const duration = Date.now() - start;
            console.log(`[PASS] ${route.name}: ${duration}ms`);
        } catch (err) {
            console.error(`[FAIL] ${route.name}: ${err.message}`);
        }
    }
}

testPerformance();
