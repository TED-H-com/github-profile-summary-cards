import { performance } from 'perf_hooks';
import { Card } from '../../src/templates/card';
import { ThemeMap } from '../../src/const/theme';
import { primeDataCache, resetKvHealthForTests } from '../../src/utils/data-cache';

// Mock fetch for KV operations
global.fetch = jest.fn();

describe('Performance Benchmarks - Profile bottlenecks & Optimizations', () => {
    beforeEach(() => {
        resetKvHealthForTests();
        process.env.KV_REST_API_URL = 'http://localhost';
        process.env.KV_REST_API_TOKEN = 'token';
        (global.fetch as jest.Mock).mockReset();
    });

    afterEach(() => {
        delete process.env.KV_REST_API_URL;
        delete process.env.KV_REST_API_TOKEN;
    });

    it('SVG generation latency - profile card rendering time is reduced (JSDOM shared)', () => {
        const theme = ThemeMap.get('default')!;
        const iterations = 100;

        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            const card = new Card(`Performance Test ${i}`, 800, 600, theme);
            card.toString();
        }
        const end = performance.now();

        const duration = end - start;
        const avgRenderTime = duration / iterations;

        console.log(`[OPTIMIZED] SVG Generation: ${duration.toFixed(2)}ms total for ${iterations} iterations (${avgRenderTime.toFixed(2)}ms avg/card)`);

        // We expect it to be very fast due to JSDOM sharing
        expect(duration).toBeLessThan(1500);
    });

    it('GraphQL query result caching - profile primeDataCache batching performance (POST mget)', async () => {
        const keys = Array.from({ length: 50 }, (_, i) => `key-${i}`);
        const mockResponses = keys.map(k => JSON.stringify({ at: Date.now(), data: { value: k } }));

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ result: mockResponses })
        });

        const start = performance.now();
        const primed = await primeDataCache(keys);
        const end = performance.now();

        const duration = end - start;
        console.log(`[OPTIMIZED] Cache Batching: ${duration.toFixed(2)}ms to prime ${keys.length} keys via POST`);

        expect(primed.size).toBe(50);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        expect(fetchCall[0]).toContain('/mget');
        expect(fetchCall[1].method).toBe('POST');
        expect(duration).toBeLessThan(500);
    });
});
