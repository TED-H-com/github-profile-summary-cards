// Collects the numbers and writes the Pages site. Run by
// .github/workflows/ted-dashboard.yml as `node lib/ted/cli.js` after `npm run build`.
import {collectStats} from './collect';
import {writeSite} from './site';

function required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

export async function main(): Promise<void> {
    try {
        const token = required('GITHUB_TOKEN');
        const username = required('USERNAME');
        const excludeRepos = (process.env.EXCLUDE_REPOS || '')
            .split(',')
            .map(name => name.trim().toLowerCase())
            .filter(Boolean);
        const outDir = process.env.OUTPUT_DIR || 'site';

        const stats = await collectStats(token, username, {excludeRepos});
        const files = writeSite(stats, outDir);
        const {contributions, commits, pullRequests} = stats.totals;
        const sampled = stats.hours.reduce((sum, count) => sum + count, 0);
        console.log(
            `Wrote ${files.length} files for ${stats.login.toLowerCase()}: ${contributions} contributions, ` +
                `${commits} commits, ${pullRequests} pull requests, ${stats.languages.length} languages, ` +
                `${sampled} commits sampled for hours`
        );
    } catch (err) {
        // The message only: an axios error object carries the request headers.
        console.error((err as Error).message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
