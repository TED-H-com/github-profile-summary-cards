import request, {assertNoGraphQLErrors, GraphQLError, isTooExpensive} from '../utils/request';
import {TedLanguage, TedStats, TedWeek} from './types';

export interface CollectOptions {
    excludeRepos?: string[]; // lowercased; matches a repository's "name" or "owner/name"
    now?: Date; // injectable clock for tests
    maxRepos?: number; // repositories sampled for the hour chart
    maxCommitsPerRepo?: number;
}

interface Headers {
    Authorization: string;
}

interface CalendarDay {
    date: string;
    contributionCount: number;
}

interface CalendarWeek {
    contributionDays: CalendarDay[];
}

interface RepoContribution {
    repository: {
        name: string;
        nameWithOwner: string;
        isPrivate: boolean;
        primaryLanguage: {name: string} | null;
        defaultBranchRef: {name: string} | null;
    };
    contributions: {totalCount: number};
}

// No from/to: GitHub then uses the past year, the same window the profile page shows.
const PROFILE_QUERY = `
query TedProfile($login: String!) {
  user(login: $login) {
    id login name
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const REPOS_QUERY = `
query TedRepos($login: String!, $from: DateTime, $to: DateTime) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { name nameWithOwner isPrivate primaryLanguage { name } defaultBranchRef { name } }
        contributions { totalCount }
      }
    }
  }
}`;

const HISTORY_QUERY = `
query TedHistory($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $after: String) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(first: 100, after: $after, since: $since, until: $until, author: {id: $authorId}) {
            pageInfo { hasNextPage endCursor }
            nodes { authoredDate }
          }
        }
      }
    }
  }
}`;

const DAY_MS = 24 * 60 * 60 * 1000;

async function graphql(headers: Headers, query: string, variables: Record<string, unknown> = {}): Promise<any> {
    const res = await request(headers, {query, variables});
    assertNoGraphQLErrors(res, 'GitHub GraphQL request failed');
    return res.data.data;
}

// With the profile owner's own token GitHub counts private repositories too. The
// workflow's GITHUB_TOKEN sees what any visitor sees, so that is the only one allowed.
async function refuseOwnerToken(headers: Headers, username: string): Promise<void> {
    let login: string | undefined;
    try {
        login = (await graphql(headers, 'query TedViewer { viewer { login } }')).viewer?.login;
    } catch {
        return; // installation tokens may have no viewer
    }
    if (login && login.toLowerCase() === username.toLowerCase()) {
        throw new Error(
            "Refusing to run with the profile owner's token, which can see private contributions. " +
                'Use the workflow GITHUB_TOKEN.'
        );
    }
}

function yearBefore(now: Date): Date {
    const date = new Date(now.getTime());
    date.setUTCFullYear(date.getUTCFullYear() - 1);
    return date;
}

// GitHub's cost estimator can reject a busy year outright, while two half-year
// windows pass. A repository active in both halves comes back twice and is summed.
async function fetchRepos(headers: Headers, username: string, now: Date): Promise<RepoContribution[]> {
    const fetchWindow = async (from: string | null, to: string | null): Promise<RepoContribution[]> =>
        (await graphql(headers, REPOS_QUERY, {login: username, from, to})).user.contributionsCollection
            .commitContributionsByRepository;
    try {
        return await fetchWindow(null, null);
    } catch (err) {
        if (!isTooExpensive(err)) throw err;
    }
    const from = yearBefore(now);
    const middle = new Date((from.getTime() + now.getTime()) / 2);
    const halves = await Promise.all([
        fetchWindow(from.toISOString(), middle.toISOString()),
        fetchWindow(new Date(middle.getTime() + 1000).toISOString(), now.toISOString())
    ]);
    const merged = new Map<string, RepoContribution>();
    for (const item of halves.flat()) {
        const seen = merged.get(item.repository.nameWithOwner);
        if (seen) seen.contributions.totalCount += item.contributions.totalCount;
        else merged.set(item.repository.nameWithOwner, {...item, contributions: {...item.contributions}});
    }
    return [...merged.values()];
}

function languagesOf(repos: RepoContribution[]): TedLanguage[] {
    const counts = new Map<string, number>();
    for (const {repository, contributions} of repos) {
        const name = repository.primaryLanguage?.name;
        if (name) counts.set(name, (counts.get(name) ?? 0) + contributions.totalCount);
    }
    return [...counts]
        .map(([name, count]) => ({name, count}))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Authored time rather than committed time, since squash and rebase merges rewrite
// the latter. Each date only bumps a UTC hour; the author's offset goes no further.
async function sampleHours(
    headers: Headers,
    nameWithOwner: string,
    variables: {authorId: string; since: string; until: string},
    maxCommits: number,
    hours: number[]
): Promise<void> {
    const [owner, name] = nameWithOwner.split('/');
    let after: string | null = null;
    let counted = 0;
    while (counted < maxCommits) {
        let history: any;
        try {
            const data = await graphql(headers, HISTORY_QUERY, {...variables, owner, name, after});
            history = data.repository?.defaultBranchRef?.target?.history;
        } catch (err) {
            if ((err as GraphQLError).isRateLimit) throw err;
            return; // a renamed or broken repository only costs its own sample
        }
        if (!history) return;
        for (const node of history.nodes.slice(0, maxCommits - counted)) {
            hours[new Date(node.authoredDate).getUTCHours()] += 1;
            counted += 1;
        }
        if (!history.pageInfo.hasNextPage) return;
        after = history.pageInfo.endCursor;
    }
}

function weeksOf(weeks: CalendarWeek[]): TedWeek[] {
    return weeks
        .filter(week => week.contributionDays.length > 0)
        .slice(-52)
        .map(week => ({
            start: week.contributionDays[0].date,
            count: week.contributionDays.reduce((sum, day) => sum + day.contributionCount, 0)
        }));
}

// A streak needs consecutive dates, not just consecutive entries.
function activity(days: CalendarDay[]): {activeDays: number; longestStreak: number} {
    let activeDays = 0;
    let longestStreak = 0;
    let streak = 0;
    let previous = NaN;
    for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
        const time = Date.parse(`${day.date}T00:00:00Z`);
        if (day.contributionCount > 0) {
            activeDays += 1;
            streak = time - previous === DAY_MS ? streak + 1 : 1;
            longestStreak = Math.max(longestStreak, streak);
        } else {
            streak = 0;
        }
        previous = time;
    }
    return {activeDays, longestStreak};
}

export async function collectStats(token: string, username: string, options: CollectOptions = {}): Promise<TedStats> {
    const {excludeRepos = [], now = new Date(), maxRepos = 25, maxCommitsPerRepo = 1000} = options;
    const headers = {Authorization: `bearer ${token}`};
    await refuseOwnerToken(headers, username);

    const user = (await graphql(headers, PROFILE_QUERY, {login: username})).user;
    if (!user) throw new Error(`GitHub user not found: ${username}`);
    const collection = user.contributionsCollection;
    const calendar = collection.contributionCalendar;

    // Private repositories cannot show up with the workflow token; drop them anyway.
    const excluded = new Set(excludeRepos.map(name => name.toLowerCase()));
    const repos = (await fetchRepos(headers, username, now)).filter(
        ({repository}) =>
            !repository.isPrivate &&
            !excluded.has(repository.name.toLowerCase()) &&
            !excluded.has(repository.nameWithOwner.toLowerCase())
    );

    const hours: number[] = new Array(24).fill(0);
    const sampled = repos
        .filter(({repository}) => repository.defaultBranchRef)
        .sort((a, b) => b.contributions.totalCount - a.contributions.totalCount)
        .slice(0, maxRepos);
    const window = {authorId: user.id, since: yearBefore(now).toISOString(), until: now.toISOString()};
    for (let i = 0; i < sampled.length; i += 4) {
        await Promise.all(
            sampled
                .slice(i, i + 4)
                .map(({repository}) => sampleHours(headers, repository.nameWithOwner, window, maxCommitsPerRepo, hours))
        );
    }

    const weeks: CalendarWeek[] = calendar.weeks;
    return {
        login: user.login,
        ...(user.name ? {name: user.name} : {}),
        generatedAt: now.toISOString().slice(0, 10),
        totals: {
            contributions: calendar.totalContributions,
            commits: collection.totalCommitContributions,
            pullRequests: collection.totalPullRequestContributions,
            ...activity(weeks.flatMap(week => week.contributionDays))
        },
        weeks: weeksOf(weeks),
        hours,
        languages: languagesOf(repos)
    };
}
