import {TedLayout, TedMode} from './types';

// Light colors are ted-h.com's (ink, slate, hairline); dark colors are the dark
// profile banner's in teddashh/teddashh. DESIGN.md explains each role.
export interface Palette {
    background: string;
    border: string;
    hairline: string;
    ink: string;
    slate: string;
    bar: string;
    barSoft: string;
    track: string;
}

export const PALETTES: Record<TedMode, Palette> = {
    light: {
        background: '#ffffff',
        border: '#e7eaf0',
        hairline: '#e7eaf0',
        ink: '#030303',
        slate: '#676f7b',
        bar: '#030303',
        barSoft: '#c8cdd4',
        track: '#eef0f4'
    },
    dark: {
        background: '#0a0a0a',
        border: '#2a2a2a',
        hairline: '#262626',
        ink: '#fafafa',
        slate: '#a1a1a1',
        bar: '#fafafa',
        barSoft: '#525252',
        track: '#1f1f1f'
    }
};

// The embedded subsets come first. The rest is ted-h.com's own stack, which takes
// over if a renderer ignores embedded fonts.
export const TEXT_STACK =
    "'Ted Inter','Ted Noto TC',Inter,'Noto Sans TC',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif";
export const FIGURE_STACK =
    "'Ted Inter Display','Ted Inter',Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// Type sizes in viewBox units. An SVG scales with the column it sits in, so each
// layout is sized for the width it usually renders at: wide about 0.9x (the
// ted-h.com card on a desktop), medium about 0.85x (a desktop GitHub profile, or
// ted-h.com on a tablet), narrow about 0.55x (a phone).
export interface TypeScale {
    kicker: number;
    meta: number;
    hero: number;
    figure: number;
    label: number;
    title: number;
    axis: number;
    language: number;
    peak: number;
}

export const TYPE: Record<TedLayout, TypeScale> = {
    wide: {kicker: 13.5, meta: 14, hero: 31, figure: 31, label: 14.5, title: 13.5, axis: 13, language: 14.5, peak: 13},
    medium: {
        kicker: 14,
        meta: 14.5,
        hero: 36,
        figure: 36,
        label: 16,
        title: 14,
        axis: 13.5,
        language: 15.5,
        peak: 13.5
    },
    narrow: {kicker: 19, meta: 20, hero: 76, figure: 48, label: 21, title: 19, axis: 18, language: 21, peak: 18}
};

// Content width of each layout in viewBox units; a card adds its padding around it.
export const CONTENT_WIDTH: Record<TedLayout, number> = {wide: 1100, medium: 920, narrow: 536};

// Tracking in em. Uppercase Latin labels get the ted-h.com eyebrow tracking; CJK
// labels stay almost untracked, since wide tracking breaks up Chinese words.
export const TRACKING = {
    caps: 0.16,
    cjk: 0.04,
    figure: -0.035,
    hero: -0.04
};
