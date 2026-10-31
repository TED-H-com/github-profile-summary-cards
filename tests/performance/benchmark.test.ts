import { performance } from 'perf_hooks';
import { Card } from '../../src/templates/card';
import { ThemeMap } from '../../src/const/theme';
import { withDataCache, primeDataCache, resetKvHealthForTests } from '../../src/utils/data-cache';

// Mock fetch for KV operations
global.fetch = jest.fn();

describe('Performance Benchmarks', () => {
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

    it('SVG generation latency - profile card rendering time', () => {
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

        console.log(`SVG Generation: ${duration.toFixed(2)}ms total for ${iterations} iterations (${avgRenderTime.toFixed(2)}ms avg/card)`);

        // Assert that rendering 100 basic cards takes less than 2000ms
        expect(duration).toBeLessThan(2000);
    });

    it('GraphQL query result caching - profile primeDataCache batching performance', async () => {
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
        console.log(`Cache Batching: ${duration.toFixed(2)}ms to prime ${keys.length} keys`);

        expect(primed.size).toBe(50);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(duration).toBeLessThan(500);
    });
});
