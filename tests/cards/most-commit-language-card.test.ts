import {
    createCommitsPerLanguageCard,
    getCommitsLanguageSVGWithThemeName
} from '../../src/cards/most-commit-language-card';
import {
    getCommitLanguageAllYears,
    getContributionYears,
    CommitLanguages,
    CommitLanguageInfo
} from '../../src/github-api/commits-per-language';
import {writeThemedCards} from '../../src/utils/card-generation';

jest.mock('../../src/github-api/commits-per-language');
jest.mock('../../src/utils/card-generation');

describe('most-commit-language-card', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should create card properly with parsed layout components', async () => {
        const langMap = new Map<string, CommitLanguageInfo>();
        langMap.set('TypeScript', new CommitLanguageInfo('TypeScript', '#000000', 10));
        langMap.set('JavaScript', new CommitLanguageInfo('JavaScript', '#f1e05a', 20));

        (getContributionYears as jest.Mock).mockResolvedValue([2024]);
        (getCommitLanguageAllYears as jest.Mock).mockResolvedValue({
            getLanguageMap: () => langMap
        });

        await createCommitsPerLanguageCard('user', [], 'token');

        expect(getContributionYears).toHaveBeenCalledWith('user', 'token');
        expect(getCommitLanguageAllYears).toHaveBeenCalledWith('user', [], 'token', [], [2024]);
        expect(writeThemedCards).toHaveBeenCalled();
    });

    it('should generate SVG for a theme and layout coordinates', async () => {
        const langMap = new Map<string, CommitLanguageInfo>();
        langMap.set('TypeScript', new CommitLanguageInfo('TypeScript', '#000000', 10));
        langMap.set('JavaScript', new CommitLanguageInfo('JavaScript', '#f1e05a', 20));

        (getContributionYears as jest.Mock).mockResolvedValue([2024]);
        (getCommitLanguageAllYears as jest.Mock).mockResolvedValue({
            getLanguageMap: () => langMap
        });

        const svg = await getCommitsLanguageSVGWithThemeName('user', 'default', [], 'token');

        expect(svg).toContain('Top Languages by Commit');
        expect(svg).toContain('TypeScript');
        expect(svg).toContain('JavaScript');
        expect(svg).toContain('<path');
        expect(svg).toContain('transform="translate');
    });

    it('should handle zero commits', async () => {
        const langMap = new Map<string, CommitLanguageInfo>();

        (getContributionYears as jest.Mock).mockResolvedValue([2024]);
        (getCommitLanguageAllYears as jest.Mock).mockResolvedValue({
            getLanguageMap: () => langMap
        });

        const svg = await getCommitsLanguageSVGWithThemeName('user', 'default', [], 'token');

        expect(svg).toContain('There are no');
        expect(svg).toContain('commits to show');
        expect(svg).toContain('<path');
    });

    it('should throw error for unknown theme', async () => {
        await expect(
            getCommitsLanguageSVGWithThemeName('user', 'unknown_theme', [], 'token')
        ).rejects.toThrow('Theme does not exist');
    });
});
