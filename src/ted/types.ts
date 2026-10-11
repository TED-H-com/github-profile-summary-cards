// Data for the Ted design dashboard. Everything covers the past 12 months of
// public GitHub activity, except where a field says otherwise.

export interface TedWeek {
    start: string; // ISO date of the week's first day (Sunday, like GitHub's calendar)
    count: number;
}

export interface TedLanguage {
    name: string;
    count: number; // commits in repositories whose primary language this is
}

export interface TedStats {
    login: string;
    name?: string;
    generatedAt: string; // YYYY-MM-DD in the configured time zone
    totals: {
        contributions: number;
        commits: number;
        pullRequests: number;
        activeDays: number;
        longestStreak: number;
    };
    weeks: TedWeek[]; // oldest first; the last week may still be in progress
    hours: number[]; // commits per hour of the day, UTC, 0 to 23
    languages: TedLanguage[];
}

export type TedMode = 'light' | 'dark';
export type TedLocale = 'en' | 'zh-TW';
// wide renders at about 1,000px, medium at 750 to 850px, narrow on phones.
export type TedLayout = 'wide' | 'medium' | 'narrow';
// card draws its own box; bare is transparent and unpadded, for a page that
// supplies the box itself.
export type TedFrame = 'card' | 'bare';
