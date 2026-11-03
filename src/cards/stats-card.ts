import {ThemeMap, ThemeColorOverride, resolveTheme} from '../const/theme';
import {Icon} from '../const/icon';
import {abbreviateNumber} from 'js-abbreviation-number';
import {getProfileDetails} from '../github-api/profile-details';
import {getContributionTotals} from '../utils/contribution-history';
import {createStatsCard as statsCard} from '../templates/stats-card';
import {CardGenerationOptions, writeThemedCards} from '../utils/card-generation';

/**
 * Creates the "Stats" card and writes it to disk.
 *
 * @param {string} username - The GitHub username.
 * @param {string} token - The GitHub API token.
 * @param {CardGenerationOptions} [options={}] - Optional generation options (e.g., theme, animation).
 * @returns {Promise<void>}
 */
export const createStatsCard = async function (username: string, token: string, options: CardGenerationOptions = {}) {
    const statsData = await getStatsData(username, token);
    // use 3- prefix for sort in preview
    writeThemedCards('3-stats', themeName => getStatsSVG(statsData, themeName), options);
};

/**
 * Generates the SVG string for the "Stats" card with a specific theme.
 *
 * @param {string} username - The GitHub username.
 * @param {string} themeName - The name of the theme to apply.
 * @param {string} token - The GitHub API token.
 * @param {ThemeColorOverride} [override] - Optional color overrides for the theme.
 * @param {boolean} [hideLogo=false] - Whether to hide the GitHub logo on the card.
 * @returns {Promise<string>} The generated SVG string.
 */
export const getStatsSVGWithThemeName = async function (
    username: string,
    themeName: string,
    token: string,
    override?: ThemeColorOverride,
    hideLogo = false
) {
    if (!ThemeMap.has(themeName)) throw new Error('Theme does not exist');
    const statsData = await getStatsData(username, token);
    return getStatsSVG(statsData, themeName, override, hideLogo);
};

const getStatsSVG = function (
    StatsData: {index: number; icon: string; name: string; value: string}[],
    themeName: string,
    override?: ThemeColorOverride,
    hideLogo = false
) {
    const title = 'Stats';
    const svgString = statsCard(`${title}`, StatsData, resolveTheme(themeName, override), hideLogo);
    return svgString;
};

const getStatsData = async function (
    username: string,
    token: string
): Promise<{index: number; icon: string; name: string; value: string}[]> {
    const profileDetails = await getProfileDetails(username, token);
    const totalStars = profileDetails.totalStars;
    const totalPullRequestContributions = profileDetails.totalPullRequestContributions;
    const totalIssueContributions = profileDetails.totalIssueContributions;
    const totalRepositoryContributions = profileDetails.totalRepositoryContributions;

    // Full history everywhere — per-year results are cached (past years are
    // immutable), so the web service can afford the same semantics as the Action.
    const {totalCommitContributions} = await getContributionTotals(username, profileDetails.contributionYears, token);

    const statsData = [
        {
            index: 0,
            icon: Icon.STAR,
            name: 'Total Stars:',
            value: `${abbreviateNumber(totalStars, 1)}`
        },
        {
            index: 1,
            icon: Icon.COMMIT,
            name: 'Total Commits:',
            value: `${abbreviateNumber(totalCommitContributions, 1)}`
        },
        {
            index: 2,
            icon: Icon.PULL_REQUEST,
            name: 'Total PRs:',
            value: `${abbreviateNumber(totalPullRequestContributions, 1)}`
        },
        {
            index: 3,
            icon: Icon.ISSUE,
            name: 'Total Issues:',
            value: `${abbreviateNumber(totalIssueContributions, 1)}`
        },
        {
            index: 4,
            icon: Icon.REPOS,
            name: 'Contributed to:',
            value: `${abbreviateNumber(totalRepositoryContributions, 1)}`
        }
    ];
    return statsData;
};
