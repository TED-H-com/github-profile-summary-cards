import {getProfileDetailsSVGWithThemeName} from '../../src/cards/profile-details-card';
import {ThemeMap} from '../../src/const/theme';
import {getProfileDetails} from '../../src/github-api/profile-details';
import {getContributionTotals} from '../../src/utils/contribution-history';

jest.mock('../../src/github-api/profile-details');
jest.mock('../../src/utils/contribution-history');

describe('Profile Details Card SVG Generation', () => {
    const USERNAME = 'jules';
    const TOKEN = 'fake_token';

    beforeEach(() => {
        jest.resetAllMocks();

        (getProfileDetails as jest.Mock).mockResolvedValue({
            name: 'Jules Engineer',
            email: 'jules@example.com',
            contributionYears: [2024],
            totalPublicRepos: 42,
            totalStars: 100,
            totalPullRequestContributions: 5,
            totalIssueContributions: 5,
            totalRepositoryContributions: 2,
            contributions: [
                {date: new Date('2024-01-01'), contributionCount: 5},
                {date: new Date('2024-02-01'), contributionCount: 10}
            ],
            createdAt: '2020-01-01T00:00:00Z'
        });

        (getContributionTotals as jest.Mock).mockResolvedValue({
            totalContributions: 1337
        });
    });

    it('should generate a valid SVG schema', async () => {
        const svg = await getProfileDetailsSVGWithThemeName(USERNAME, 'default', TOKEN);

        // Check for basic SVG elements
        expect(svg).toContain('<svg');
        expect(svg).toContain('</svg>');
        expect(svg).toContain('<g');
        expect(svg).toContain('<rect');
        expect(svg).toContain('<text');
        expect(svg).toContain('<path');
        expect(svg).toContain('class="gpsc-item"');
        expect(svg).toContain('class="gpsc-chart"');
    });

    it('should correctly map default (light) theme colors', async () => {
        const svg = await getProfileDetailsSVGWithThemeName(USERNAME, 'default', TOKEN);
        const theme = ThemeMap.get('default')!;

        // Default theme properties check
        expect(svg).toContain(`fill="${theme.background}"`); // Background
        expect(svg).toContain(`fill="${theme.icon}"`); // Icon
        expect(svg).toContain(`style="fill: ${theme.text};`); // Text
        expect(svg).toContain(`stroke="${theme.chart}"`); // Chart Line
        expect(svg).toContain(`fill="${theme.chart}"`); // Chart Fill
        expect(svg).toContain(`stroke="${theme.stroke}"`); // Border/Stroke
    });

    it('should correctly map dark theme colors', async () => {
        const svg = await getProfileDetailsSVGWithThemeName(USERNAME, 'dark', TOKEN);
        const theme = ThemeMap.get('dark')!;

        // Dark theme properties check
        expect(svg).toContain(`fill="${theme.background}"`); // Background
        expect(svg).toContain(`fill="${theme.icon}"`); // Icon
        expect(svg).toContain(`style="fill: ${theme.text};`); // Text
        expect(svg).toContain(`stroke="${theme.chart}"`); // Chart Line
        expect(svg).toContain(`fill="${theme.chart}"`); // Chart Fill
        expect(svg).toContain(`stroke="${theme.stroke}"`); // Border/Stroke
    });

    it('should correctly calculate and display contribution metrics', async () => {
        const svg = await getProfileDetailsSVGWithThemeName(USERNAME, 'default', TOKEN);

        // Name
        expect(svg).toContain('Jules Engineer');

        // Contributions from mock (1337 abbreviated to 1.34k based on abbreviateNumber(..., 2))
        expect(svg).toContain('1.34k Contributions on GitHub');

        // Public repos from mock
        expect(svg).toContain('42 Public Repos');

        // Joined at format based on mock createdAt
        // The JoinedAt string is dynamic based on Date.now().
        // We'll just check for 'Joined GitHub' and 'ago'.
        expect(svg).toMatch(/Joined GitHub .* ago/);

        // Email from mock
        expect(svg).toContain('jules@example.com');
    });
});
