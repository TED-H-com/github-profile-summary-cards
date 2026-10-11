import {JSDOM} from 'jsdom';
import {renderVariants, allVariants, variantPath} from '../../src/ted/variants';
import {renderDashboard} from '../../src/ted/dashboard';
import {TedStats} from '../../src/ted/types';
import * as fs from 'fs';
import * as path from 'path';

const fixturePath = path.join(__dirname, 'fixture-teddashh.json');
const fixture: TedStats = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

describe('dashboard renderer', () => {
    it('allVariants gives 18 unique paths, card frames come in light and dark, bare only light', () => {
        const variants = allVariants();
        expect(variants.length).toBe(18);
        const paths = new Set(variants.map(variantPath));
        expect(paths.size).toBe(18);

        const cardModes = new Set(variants.filter(v => v.frame === 'card').map(v => v.mode));
        expect(cardModes).toEqual(new Set(['light', 'dark']));

        const bareModes = new Set(variants.filter(v => v.frame === 'bare').map(v => v.mode));
        expect(bareModes).toEqual(new Set(['light']));
    });

    it('every variant parses as XML', () => {
        const variants = renderVariants(fixture);
        for (const v of variants) {
            const dom = new JSDOM(v.svg, {contentType: 'image/svg+xml'});
            const doc = dom.window.document;
            expect(doc.documentElement.tagName).toBe('svg');
            expect(doc.querySelector('parsererror')).toBeNull();
            expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy();
            expect(doc.documentElement.getAttribute('role')).toBe('img');
            expect(doc.querySelector('title')).toBeTruthy();
            expect(doc.querySelector('desc')).toBeTruthy();
        }
    });

    it('contains no NaN, Infinity or undefined outside the style element', () => {
        const variants = renderVariants(fixture);
        for (const v of variants) {
            const noStyle = v.svg.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            expect(noStyle).not.toMatch(/NaN/);
            expect(noStyle).not.toMatch(/Infinity/);
            expect(noStyle).not.toMatch(/undefined/);
        }
    });

    it('font-face includes Noto TC for zh-TW variants only, and embedFonts: false works', () => {
        const variants = allVariants();
        for (const v of variants) {
            const svg = renderDashboard(fixture, v);
            if (v.locale === 'zh-TW') {
                expect(svg).toMatch(/@font-face\s*\{\s*font-family:\s*'Ted Noto TC'/);
            } else {
                expect(svg).not.toMatch(/@font-face\s*\{\s*font-family:\s*'Ted Noto TC'/);
            }
        }

        const noFontSvg = renderDashboard(fixture, {...variants[0], locale: 'zh-TW', embedFonts: false} as any);
        expect(noFontSvg).not.toMatch(/@font-face/);
    });

    it('escapes name in title so SVG still parses', () => {
        const escapedFixture: TedStats = {...fixture, name: 'A <b> & "c"'};
        const svg = renderDashboard(escapedFixture, {locale: 'en', frame: 'card', layout: 'medium', mode: 'light'});
        const dom = new JSDOM(svg, {contentType: 'image/svg+xml'});
        const doc = dom.window.document;
        expect(doc.querySelector('parsererror')).toBeNull();
    });

    it('empty data renders without NaN and parses', () => {
        const emptyData: TedStats = {
            ...fixture,
            totals: {contributions: 0, commits: 0, pullRequests: 0, activeDays: 0, longestStreak: 0},
            weeks: [],
            hours: new Array(24).fill(0),
            languages: []
        };
        const variants = renderVariants(emptyData);
        for (const v of variants) {
            const noStyle = v.svg.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            expect(noStyle).not.toMatch(/NaN/);
            const dom = new JSDOM(v.svg, {contentType: 'image/svg+xml'});
            const doc = dom.window.document;
            expect(doc.querySelector('parsererror')).toBeNull();
        }
    });

    it('lists the top languages in the description the way each language writes a list', () => {
        const top = [...fixture.languages]
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(language => language.name);
        const desc = (stats: TedStats, locale: 'en' | 'zh-TW'): string =>
            new JSDOM(renderDashboard(stats, {locale, frame: 'card', layout: 'medium', mode: 'light'}), {
                contentType: 'image/svg+xml'
            }).window.document.querySelector('desc')!.textContent ?? '';
        expect(desc(fixture, 'en')).toMatch(new RegExp(`days\\. Top languages: ${top.join(', ')}\\.$`));
        expect(desc(fixture, 'zh-TW')).toMatch(new RegExp(`天。主要語言：${top.join('、')}。$`));

        const none: TedStats = {...fixture, languages: []};
        expect(desc(none, 'en')).toMatch(/days\.$/);
        expect(desc(none, 'en')).not.toContain('Top languages');
        expect(desc(none, 'zh-TW')).toMatch(/天。$/);
        expect(desc(none, 'zh-TW')).not.toContain('主要語言');
    });

    it('shortens a long language name on the card but keeps it whole in the description', () => {
        const name = 'ThisIsAVeryLongLanguageNameThatShouldBeTruncatedSoItDoesNotBreakTheLayout';
        const longData: TedStats = {...fixture, languages: [{name, count: 100}]};
        for (const layout of ['wide', 'medium', 'narrow'] as const) {
            const svg = renderDashboard(longData, {locale: 'en', frame: 'card', layout, mode: 'light'});
            const texts = Array.from(
                new JSDOM(svg, {contentType: 'image/svg+xml'}).window.document.querySelectorAll('text')
            );
            const label = texts.map(text => text.textContent ?? '').find(text => text.startsWith('ThisIs'));
            expect(label).toMatch(/^ThisIs\w+\u2026$/);
            expect(label!.length).toBeLessThan(name.length);
            // Screen readers get the full name from the description.
            expect(svg).toMatch(new RegExp(`<desc[^>]*>[^<]*${name}`));
        }
    });
});
