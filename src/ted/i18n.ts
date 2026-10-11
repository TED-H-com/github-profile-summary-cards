import {TedLocale} from './types';

// Every Chinese character the cards can show lives in this file:
// scripts/ted/build_fonts.py scans it to build the Noto Sans TC subset. Rebuild the
// fonts after changing any zh-TW string. Uppercase English is written out here,
// not left to CSS, so the SVG text matches what screen readers get.

export interface Strings {
    kicker: (login: string) => string;
    window: string;
    updated: (isoDate: string) => string;
    contributions: string;
    commits: string;
    pullRequests: string;
    activeDays: string;
    longestStreak: string;
    days: string; // unit after the streak figure
    byWeek: string;
    byHour: string;
    languages: string;
    other: string;
    month: (index: number) => string;
    title: (who: string) => string;
    summary: (values: {[key: string]: string}) => string;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const STRINGS: Record<TedLocale, Strings> = {
    en: {
        kicker: login => `GITHUB / ${login.toUpperCase()}`,
        window: 'Past 12 months',
        updated: isoDate => {
            const [y, m, d] = isoDate.split('-').map(Number);
            return `Updated ${MONTHS_EN[m - 1]} ${d}, ${y}`;
        },
        contributions: 'Contributions',
        commits: 'Commits',
        pullRequests: 'Pull requests',
        activeDays: 'Active days',
        longestStreak: 'Longest streak',
        days: 'days',
        byWeek: 'CONTRIBUTIONS BY WEEK',
        byHour: 'COMMITS BY HOUR, UTC',
        languages: 'TOP LANGUAGES',
        other: 'Other',
        month: index => MONTHS_EN[index],
        title: who => `${who} on GitHub, past 12 months`,
        summary: v =>
            `${v.contributions} contributions, ${v.commits} commits, ${v.pullRequests} pull requests, ` +
            `${v.activeDays} active days, longest streak ${v.longestStreak} days. Top languages: ${v.languages}.`
    },
    'zh-TW': {
        kicker: login => `GITHUB / ${login.toUpperCase()}`,
        window: '過去 12 個月',
        updated: isoDate => `${isoDate.replace(/-/g, '.')} 更新`,
        contributions: '貢獻',
        commits: 'Commit',
        pullRequests: 'Pull Request',
        activeDays: '活躍天數',
        longestStreak: '最長連續',
        days: '天',
        byWeek: '每週貢獻',
        byHour: 'Commit 時段（UTC）',
        languages: '主要語言',
        other: '其他',
        month: index => `${index + 1} 月`,
        title: who => `${who} 過去 12 個月的 GitHub 動態`,
        summary: v =>
            `${v.contributions} 次貢獻、${v.commits} 個 Commit、${v.pullRequests} 個 Pull Request，` +
            `活躍 ${v.activeDays} 天，最長連續 ${v.longestStreak} 天。主要語言：${v.languages}。`
    }
};

export function formatNumber(value: number): string {
    return Math.round(value).toLocaleString('en-US');
}

export function formatPercent(share: number): string {
    if (share > 0 && share < 0.001) return '<0.1%';
    return `${(share * 100).toFixed(1)}%`;
}
