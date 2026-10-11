import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {collectStats} from '../../src/ted/collect';

const NOW = new Date('2026-10-11T12:00:00Z'); // a Sunday
const mock = new MockAdapter(axios);

interface Call {
    operation: string;
    variables: any;
}
type Handler = (variables: any, calls: Call[]) => unknown;

let calls: Call[] = [];

// Answers every GraphQL request by its operation name and records the calls.
// Unknown operations get a GraphQL error, never an HTTP error: those retry slowly.
function serve(handlers: Record<string, Handler>): void {
    calls = [];
    mock.onPost('https://api.github.com/graphql').reply(config => {
        const {query, variables} = JSON.parse(config.data);
        const operation = /query (Ted\w+)/.exec(query)![1];
        calls.push({operation, variables});
        const handler = handlers[operation];
        return [200, handler ? handler(variables, calls) : {errors: [{message: `unexpected ${operation}`}]}];
    });
}

function isoDate(time: number): string {
    return new Date(time).toISOString().slice(0, 10);
}

// The calendar GitHub returns for the past year: weeks run Sunday to Saturday,
// the first one starts mid-week and the last one is in progress.
function yearCalendar(
    count: (date: string) => number
): {contributionDays: {date: string; contributionCount: number}[]}[] {
    const weeks: {contributionDays: {date: string; contributionCount: number}[]}[] = [];
    for (let time = Date.UTC(2025, 9, 11); time <= Date.UTC(2026, 9, 11); time += 86400000) {
        const date = isoDate(time);
        if (weeks.length === 0 || new Date(time).getUTCDay() === 0) weeks.push({contributionDays: []});
        weeks[weeks.length - 1].contributionDays.push({date, contributionCount: count(date)});
    }
    return weeks;
}

function profile(overrides: Record<string, unknown> = {}, weeks = yearCalendar(() => 1)) {
    return {
        data: {
            user: {
                id: 'U1',
                login: 'TedDashH',
                name: 'Ted Huang',
                contributionsCollection: {
                    totalCommitContributions: 6815,
                    totalPullRequestContributions: 744,
                    contributionCalendar: {totalContributions: 13097, weeks}
                },
                ...overrides
            }
        }
    };
}

function repo(name: string, count: number, extra: Record<string, unknown> = {}) {
    return {
        repository: {
            name,
            nameWithOwner: `teddashh/${name}`,
            isPrivate: false,
            primaryLanguage: {name: 'TypeScript'},
            defaultBranchRef: {name: 'main'},
            ...extra
        },
        contributions: {totalCount: count}
    };
}

function repos(list: unknown[]) {
    return {data: {user: {contributionsCollection: {commitContributionsByRepository: list}}}};
}

function history(dates: string[], endCursor: string | null = null) {
    return {
        data: {
            repository: {
                defaultBranchRef: {
                    target: {
                        history: {
                            pageInfo: {hasNextPage: endCursor !== null, endCursor},
                            nodes: dates.map(authoredDate => ({authoredDate}))
                        }
                    }
                }
            }
        }
    };
}

const viewer = () => ({data: {viewer: {login: 'github-actions[bot]'}}});
const noRepos = () => repos([]);

afterEach(() => mock.reset());
afterAll(() => mock.restore());

describe('collectStats', () => {
    it('maps the calendar and the totals', async () => {
        serve({TedViewer: viewer, TedProfile: () => profile(), TedRepos: noRepos});
        const stats = await collectStats('token', 'teddashh', {now: NOW});

        expect(Object.keys(stats)).toEqual(['login', 'name', 'generatedAt', 'totals', 'weeks', 'hours', 'languages']);
        expect(stats.login).toBe('TedDashH');
        expect(stats.name).toBe('Ted Huang');
        expect(stats.generatedAt).toBe('2026-10-11');
        expect(stats.totals).toEqual({
            contributions: 13097,
            commits: 6815,
            pullRequests: 744,
            activeDays: 366,
            longestStreak: 366
        });
        expect(stats.weeks).toHaveLength(52);
        for (const week of stats.weeks) expect(new Date(`${week.start}T00:00:00Z`).getUTCDay()).toBe(0);
        expect(stats.weeks[0]).toEqual({start: '2025-10-19', count: 7});
        expect(stats.weeks[51]).toEqual({start: '2026-10-11', count: 1});
        expect(stats.hours).toEqual(new Array(24).fill(0));
    });

    it('leaves out an empty name', async () => {
        serve({TedViewer: viewer, TedProfile: () => profile({name: ''}), TedRepos: noRepos});
        const stats = await collectStats('token', 'teddashh', {now: NOW});
        expect('name' in stats).toBe(false);
    });

    it('counts active days, and a zero day or a missing date ends a streak', async () => {
        const days = [
            ['2026-01-01', 1],
            ['2026-01-02', 2],
            ['2026-01-03', 3],
            ['2026-01-04', 0],
            ['2026-01-05', 1],
            ['2026-01-06', 1],
            ['2026-01-07', 1],
            ['2026-01-08', 1],
            // 2026-01-09 is missing
            ['2026-01-10', 1],
            ['2026-01-11', 1],
            ['2026-01-12', 1]
        ] as const;
        const weeks = [
            {contributionDays: days.slice(6).map(([date, contributionCount]) => ({date, contributionCount}))},
            {contributionDays: days.slice(0, 6).map(([date, contributionCount]) => ({date, contributionCount}))}
        ];
        serve({TedViewer: viewer, TedProfile: () => profile({}, weeks), TedRepos: noRepos});
        const stats = await collectStats('token', 'teddashh', {now: NOW});
        expect(stats.totals.activeDays).toBe(10);
        expect(stats.totals.longestStreak).toBe(4);
    });

    it('builds languages from public repositories that are not excluded', async () => {
        serve({
            TedViewer: viewer,
            TedProfile: () => profile(),
            TedRepos: () =>
                repos([
                    repo('secret', 500, {isPrivate: true, primaryLanguage: {name: 'Rust'}}),
                    repo('hidden', 400, {primaryLanguage: {name: 'Rust'}}),
                    repo('elsewhere', 300, {nameWithOwner: 'someone/elsewhere', primaryLanguage: {name: 'Rust'}}),
                    repo('notes', 100, {primaryLanguage: null}),
                    repo('web', 30, {primaryLanguage: {name: 'Go'}}),
                    repo('cli', 15, {primaryLanguage: {name: 'Go'}}),
                    repo('scripts', 45, {primaryLanguage: {name: 'Python'}}),
                    repo('kit', 45, {primaryLanguage: {name: 'C'}})
                ]),
            TedHistory: () => history([])
        });
        const stats = await collectStats('token', 'teddashh', {
            now: NOW,
            excludeRepos: ['hidden', 'someone/elsewhere']
        });
        expect(stats.languages).toEqual([
            {name: 'C', count: 45},
            {name: 'Go', count: 45},
            {name: 'Python', count: 45}
        ]);
        const queried = calls.filter(call => call.operation === 'TedHistory').map(call => call.variables.name);
        expect(queried).not.toContain('secret');
        expect(queried).not.toContain('hidden');
        expect(queried).not.toContain('elsewhere');
    });

    it('samples UTC hours from the busiest repositories only', async () => {
        serve({
            TedViewer: viewer,
            TedProfile: () => profile(),
            TedRepos: () =>
                repos([
                    repo('main-app', 100),
                    repo('gone', 50),
                    repo('small', 10),
                    repo('empty', 200, {defaultBranchRef: null})
                ]),
            TedHistory: variables => {
                if (variables.name === 'gone') return {data: {repository: null}};
                if (!variables.after) return history(['2026-10-04T23:30:00-07:00', '2026-10-05T06:45:00Z'], 'c1');
                return history(['2026-10-05T07:00:00+02:00']);
            }
        });
        const stats = await collectStats('token', 'teddashh', {now: NOW, maxRepos: 2});

        const expected = new Array(24).fill(0);
        expected[6] = 2; // 23:30 at -07:00 is 06:30 UTC
        expected[5] = 1; // 07:00 at +02:00 is 05:00 UTC
        expect(stats.hours).toEqual(expected);

        const historyCalls = calls.filter(call => call.operation === 'TedHistory');
        expect(historyCalls.map(call => call.variables.name).sort()).toEqual(['gone', 'main-app', 'main-app']);
        expect(historyCalls.find(call => call.variables.after === 'c1')).toBeDefined();
        expect(historyCalls[0].variables).toMatchObject({
            owner: 'teddashh',
            authorId: 'U1',
            since: '2025-10-11T12:00:00.000Z',
            until: '2026-10-11T12:00:00.000Z'
        });

        const json = JSON.stringify(stats);
        expect(json).not.toMatch(/main-app|gone|small|empty|-07:00|\+02:00/);
    });

    it('stops paging a repository at maxCommitsPerRepo', async () => {
        serve({
            TedViewer: viewer,
            TedProfile: () => profile(),
            TedRepos: () => repos([repo('main-app', 100)]),
            TedHistory: () => history(['2026-10-05T01:00:00Z', '2026-10-05T02:00:00Z', '2026-10-05T03:00:00Z'], 'c1')
        });
        const stats = await collectStats('token', 'teddashh', {now: NOW, maxCommitsPerRepo: 2});
        expect(stats.hours.reduce((sum, count) => sum + count, 0)).toBe(2);
        expect(calls.filter(call => call.operation === 'TedHistory')).toHaveLength(1);
    });

    it("refuses the profile owner's token", async () => {
        serve({TedViewer: () => ({data: {viewer: {login: 'TedDashH'}}}), TedProfile: () => profile()});
        await expect(collectStats('token', 'teddashh', {now: NOW})).rejects.toThrow(
            "Refusing to run with the profile owner's token"
        );
        expect(calls.map(call => call.operation)).toEqual(['TedViewer']);
    });

    it('carries on when the viewer query fails', async () => {
        serve({
            TedViewer: () => ({errors: [{message: 'Resource not accessible by integration'}]}),
            TedProfile: () => profile(),
            TedRepos: noRepos
        });
        const stats = await collectStats('token', 'teddashh', {now: NOW});
        expect(stats.totals.contributions).toBe(13097);
    });

    it('splits the year in two when GitHub finds the query too expensive', async () => {
        serve({
            TedViewer: viewer,
            TedProfile: () => profile(),
            TedRepos: variables => {
                if (variables.from === null) return {errors: [{message: 'Resource limits for this query exceeded'}]};
                if (variables.to === NOW.toISOString()) return repos([repo('main-app', 30), repo('docs', 5)]);
                return repos([repo('main-app', 70)]);
            },
            TedHistory: () => history([])
        });
        const stats = await collectStats('token', 'teddashh', {now: NOW});
        expect(stats.languages).toEqual([{name: 'TypeScript', count: 105}]);

        const windows = calls.filter(call => call.operation === 'TedRepos').map(call => call.variables);
        expect(windows).toHaveLength(3);
        expect(windows[1].from).toBe('2025-10-11T12:00:00.000Z');
        expect(windows[2].to).toBe('2026-10-11T12:00:00.000Z');
        expect(Date.parse(windows[2].from) - Date.parse(windows[1].to)).toBe(1000);
    });

    it('fails the run on a rate limit while sampling hours', async () => {
        serve({
            TedViewer: viewer,
            TedProfile: () => profile(),
            TedRepos: () => repos([repo('main-app', 100)]),
            TedHistory: () => ({errors: [{type: 'RATE_LIMITED', message: 'API rate limit exceeded'}]})
        });
        await expect(collectStats('token', 'teddashh', {now: NOW})).rejects.toThrow('API rate limit exceeded');
    });

    it('rejects an unknown user', async () => {
        serve({TedViewer: viewer, TedProfile: () => ({data: {user: null}})});
        await expect(collectStats('token', 'nobody', {now: NOW})).rejects.toThrow('GitHub user not found: nobody');
    });
});
