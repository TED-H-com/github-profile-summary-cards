import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {writeSite} from '../../src/ted/site';
import {main} from '../../src/ted/cli';
import {TedStats} from '../../src/ted/types';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {allVariants} from '../../src/ted/variants';

const fixturePath = path.join(__dirname, 'fixture-teddashh.json');
const fixture: TedStats = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

describe('site generation and CLI', () => {
    let mock: MockAdapter;
    let outDir: string;
    let originalEnv: NodeJS.ProcessEnv;
    let originalExit: typeof process.exit;

    beforeAll(() => {
        mock = new MockAdapter(axios);
    });

    beforeEach(() => {
        outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ted-site-'));
        originalEnv = process.env;
        process.env = {...originalEnv};

        originalExit = process.exit;
        const exitSpy: any = jest.fn(code => {
            throw new Error(`process.exit called with ${code}`);
        });
        process.exit = exitSpy;

        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        fs.rmSync(outDir, {recursive: true, force: true});
        process.env = originalEnv;
        process.exit = originalExit;
        mock.reset();
        jest.restoreAllMocks();
    });

    afterAll(() => {
        mock.restore();
    });

    it('writeSite generates the correct files', () => {
        const written = writeSite(fixture, outDir);

        expect(fs.existsSync(path.join(outDir, '.nojekyll'))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true);
        expect(fs.existsSync(path.join(outDir, 'teddashh/stats.json'))).toBe(true);

        const statsStr = fs.readFileSync(path.join(outDir, 'teddashh/stats.json'), 'utf8');
        expect(JSON.parse(statsStr)).toEqual(fixture);

        const indexHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
        expect(indexHtml).not.toMatch(/<script/);
        expect(indexHtml).toMatch(/<a href="teddashh\/stats\.json">stats\.json<\/a>/);

        let variantsCount = 0;
        for (const v of allVariants()) {
            const vp = `${v.locale}/${v.frame}-${v.layout}-${v.mode}.svg`;
            expect(fs.existsSync(path.join(outDir, 'teddashh', vp))).toBe(true);
            expect(indexHtml).toMatch(
                new RegExp(`<a href="teddashh\\/${vp.replace(/\\/g, '\\\\')}">${vp.replace(/\\/g, '\\\\')}<\\/a>`)
            );
            variantsCount++;
        }
        expect(variantsCount).toBe(18);

        // Phones get the narrow card; the Chinese files sit in their own list.
        expect(indexHtml).toMatch(
            /<source media="\(max-width: 640px\)"[^>]*srcset="teddashh\/en\/card-narrow-light\.svg">/
        );
        expect(indexHtml).toMatch(/<h1>[^<]+<\/h1>/);
        const lists = indexHtml.match(/<ul>[\s\S]*?<\/ul>/g)!;
        expect(lists).toHaveLength(2);
        expect(lists[0].match(/<li>/g)).toHaveLength(10); // stats.json and the English files
        expect(lists[0]).not.toMatch(/zh-TW/);
        expect(lists[1].match(/<li>/g)).toHaveLength(9);
        expect(lists[1].match(/<li><a href="teddashh\/zh-TW\//g)).toHaveLength(9);
        expect(written.length).toBe(1 + 1 + 1 + 18); // .nojekyll, index.html, stats.json, 18 variants

        const sortedWritten = [...written].sort();
        expect(written).toEqual(sortedWritten);
    });

    it('main() succeeds with mocked HTTP and OUTPUT_DIR', async () => {
        process.env.GITHUB_TOKEN = 'fake-token';
        process.env.USERNAME = 'teddashh';
        process.env.OUTPUT_DIR = outDir;

        mock.onPost('https://api.github.com/graphql').reply(config => {
            const query = JSON.parse(config.data).query;
            if (query.includes('query TedViewer')) {
                return [200, {data: {viewer: {login: 'other-user'}}}];
            }
            if (query.includes('query TedProfile')) {
                return [
                    200,
                    {
                        data: {
                            user: {
                                id: 'U_1',
                                login: 'teddashh',
                                name: 'Ted Huang',
                                contributionsCollection: {
                                    totalCommitContributions: 10,
                                    totalPullRequestContributions: 2,
                                    contributionCalendar: {
                                        totalContributions: 12,
                                        weeks: []
                                    }
                                }
                            }
                        }
                    }
                ];
            }
            if (query.includes('query TedRepos')) {
                return [
                    200,
                    {
                        data: {
                            user: {
                                contributionsCollection: {
                                    commitContributionsByRepository: []
                                }
                            }
                        }
                    }
                ];
            }
            return [200, {}];
        });

        await main();

        expect(fs.existsSync(path.join(outDir, 'index.html'))).toBe(true);
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Wrote 21 files for teddashh'));
    });

    it('main() prints error and exits if token is missing', async () => {
        delete process.env.GITHUB_TOKEN;

        await expect(main()).rejects.toThrow('process.exit called with 1');
        expect(console.error).toHaveBeenCalledWith('Missing required environment variable: GITHUB_TOKEN');
    });
});
