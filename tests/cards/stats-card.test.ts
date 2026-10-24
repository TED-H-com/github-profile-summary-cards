import {createStatsCard, getStatsSVGWithThemeName} from '../../src/cards/stats-card';
import {getProfileDetails} from '../../src/github-api/profile-details';
import {getContributionTotals} from '../../src/utils/contribution-history';
import {writeThemedCards} from '../../src/utils/card-generation';

jest.mock('../../src/github-api/profile-details');
jest.mock('../../src/utils/contribution-history');
jest.mock('../../src/utils/card-generation');

describe('stats-card', () => {
    const TOKEN = 'dummy_token';
    const USERNAME = 'testuser';

    beforeEach(() => {
        jest.resetAllMocks();

        (getProfileDetails as jest.Mock).mockResolvedValue({
            totalStars: 42,
            totalPullRequestContributions: 15,
            totalIssueContributions: 10,
            totalRepositoryContributions: 5,
            contributionYears: [2024, 2023]
        });

        (getContributionTotals as jest.Mock).mockResolvedValue({
            totalCommitContributions: 1000
        });
    });

    describe('createStatsCard', () => {
        it('fetches stats and writes themed cards', async () => {
            const options = {theme: 'default'};
            await createStatsCard(USERNAME, TOKEN, options);

            expect(getProfileDetails).toHaveBeenCalledWith(USERNAME, TOKEN);
            expect(getContributionTotals).toHaveBeenCalledWith(USERNAME, [2024, 2023], TOKEN);

            expect(writeThemedCards).toHaveBeenCalledWith('3-stats', expect.any(Function), options);
        });
    });

    describe('getStatsSVGWithThemeName', () => {
        it('throws an error for invalid theme', async () => {
            await expect(getStatsSVGWithThemeName(USERNAME, 'invalid-theme', TOKEN)).rejects.toThrow(
                'Theme does not exist'
            );
        });

        it('returns SVG string for a valid theme', async () => {
            const svgString = await getStatsSVGWithThemeName(USERNAME, 'default', TOKEN);

            // Verifies the correct API requests were made
            expect(getProfileDetails).toHaveBeenCalledWith(USERNAME, TOKEN);
            expect(getContributionTotals).toHaveBeenCalledWith(USERNAME, [2024, 2023], TOKEN);

            // Verifies the content of the generated SVG
            expect(svgString).toContain('Stats');
            expect(svgString).toContain('Total Stars:');
            expect(svgString).toContain('42');
            expect(svgString).toContain('Total Commits:');
            expect(svgString).toContain('1.0k'); // abbreviateNumber(1000, 1) = 1.0k
            expect(svgString).toContain('Total PRs:');
            expect(svgString).toContain('15');
            expect(svgString).toContain('Total Issues:');
            expect(svgString).toContain('10');
            expect(svgString).toContain('Contributed to:');
            expect(svgString).toContain('5');
        });

        it('passes hideLogo correctly to the template', async () => {
            const svgWithLogo = await getStatsSVGWithThemeName(USERNAME, 'default', TOKEN, undefined, false);
            const svgWithoutLogo = await getStatsSVGWithThemeName(USERNAME, 'default', TOKEN, undefined, true);

            // Simple proxy for hideLogo - template drops the icon when hideLogo=true
            // (Assuming the logo is the only path in the header or similar, but
            // for brevity we just verify it runs successfully.)
            expect(svgWithLogo).toBeDefined();
            expect(svgWithoutLogo).toBeDefined();
            expect(svgWithLogo.length).toBeGreaterThan(svgWithoutLogo.length); // Without logo it should be smaller
        });
    });
});
