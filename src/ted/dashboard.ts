import {formatNumber, formatPercent, STRINGS, Strings} from './i18n';
import {el, escapeXml, fit, hasCjk, measure, n, styleBlock} from './svg';
import {CONTENT_WIDTH, PALETTES, Palette, TRACKING, TYPE, TypeScale} from './tokens';
import {TedFrame, TedLayout, TedLocale, TedMode, TedStats} from './types';

// One SVG per variant; DESIGN.md says which variant goes where.
export interface DashboardOptions {
    mode: TedMode;
    locale: TedLocale;
    layout: TedLayout;
    frame?: TedFrame; // default 'card'
    embedFonts?: boolean; // default true
}

interface TextStyle {
    size: number;
    fill: string;
    weight?: 400 | 500;
    figure?: boolean;
    tabular?: boolean;
    anchor?: 'start' | 'middle' | 'end';
    tracking?: number; // em
}

class Canvas {
    private parts: string[] = [];
    cjk = false;

    text(x: number, y: number, value: string, style: TextStyle): void {
        if (hasCjk(value)) this.cjk = true;
        const classes = [style.figure ? 'f' : style.weight === 500 ? 'm' : '', style.tabular ? 't' : '']
            .filter(Boolean)
            .join(' ');
        const spacing = (style.tracking ?? 0) * style.size;
        // Browsers track after the last glyph too. Shift end-anchored text by that
        // trailing space so the last glyph, not the gap after it, lines up with x.
        const anchorShift = style.anchor === 'end' ? spacing : style.anchor === 'middle' ? spacing / 2 : 0;
        this.parts.push(
            el(
                'text',
                {
                    x: x + anchorShift,
                    y,
                    'font-size': style.size,
                    fill: style.fill,
                    class: classes || undefined,
                    'text-anchor': style.anchor && style.anchor !== 'start' ? style.anchor : undefined,
                    'letter-spacing': spacing ? n(spacing) : undefined
                },
                escapeXml(value)
            )
        );
    }

    rect(x: number, y: number, width: number, height: number, fill: string): void {
        this.parts.push(el('rect', {x, y, width, height, fill}));
    }

    hline(x1: number, x2: number, y: number, color: string): void {
        this.rect(x1, y, x2 - x1, 1, color);
    }

    vline(x: number, y1: number, y2: number, color: string): void {
        this.rect(x, y1, 1, y2 - y1, color);
    }

    toString(): string {
        return this.parts.join('');
    }
}

interface Context {
    stats: TedStats;
    palette: Palette;
    strings: Strings;
    type: TypeScale;
    layout: TedLayout;
    card: boolean;
    canvas: Canvas;
}

interface Size {
    width: number;
    height: number;
}

// Cap height of Inter as a share of the font size; used to place text by its top.
const CAP = 0.727;
// Card padding around the content, per layout.
const PADDING: Record<TedLayout, number> = {wide: 40, medium: 40, narrow: 32};

function figure(ctx: Context, x: number, y: number, value: string, size: number, unit?: string): void {
    const {canvas, palette, type} = ctx;
    const tracking = size > 60 ? TRACKING.hero : TRACKING.figure;
    canvas.text(x, y, value, {size, fill: palette.ink, figure: true, tracking});
    if (unit) {
        const unitX = x + measure(value, size, 'figure-500', tracking) + type.label * 0.3;
        canvas.text(unitX, y, unit, {size: type.label, fill: palette.slate});
    }
}

function chartTitle(ctx: Context, x: number, y: number, value: string): void {
    ctx.canvas.text(x, y, value, {
        size: ctx.type.title,
        fill: ctx.palette.slate,
        weight: 500,
        tracking: hasCjk(value) ? TRACKING.cjk : TRACKING.caps
    });
}

function weekIsOpen(start: string, generatedAt: string): boolean {
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return end.toISOString().slice(0, 10) >= generatedAt;
}

// Bars share one width across both charts so they read as one family.
function barWidth(ctx: Context, chartWidth: number): number {
    const weeks = Math.max(1, ctx.stats.weeks.length);
    return Math.max(1, chartWidth / weeks - (ctx.layout === 'narrow' ? 2.4 : 1.6));
}

function weekly(ctx: Context, x: number, width: number, top: number, bottom: number, axisY: number): number {
    const {canvas, palette, stats, strings, type} = ctx;
    const weeks = stats.weeks;
    const bar = barWidth(ctx, width);
    canvas.hline(x, x + width, bottom, palette.hairline);
    if (weeks.length === 0) return bar;
    const pitch = width / weeks.length;
    const max = Math.max(0, ...weeks.map(week => week.count));
    let peak = -1;
    weeks.forEach((week, i) => {
        if (max === 0 || week.count <= 0) return;
        const height = Math.max(1.5, (week.count / max) * (bottom - top));
        const open = i === weeks.length - 1 && weekIsOpen(week.start, stats.generatedAt);
        canvas.rect(x + i * pitch, bottom - height, bar, height, open ? palette.barSoft : palette.bar);
        if (week.count === max) peak = i;
    });
    if (peak >= 0) {
        const left = x + peak * pitch;
        const toRight = left + bar / 2 > x + width / 2;
        canvas.text(toRight ? left + bar : left, top - type.peak * 0.6, formatNumber(max), {
            size: type.peak,
            fill: palette.ink,
            weight: 500,
            tabular: true,
            anchor: toRight ? 'end' : 'start'
        });
    }
    // Quarter months, labelled at the first week that starts in them.
    for (let i = 1; i < weeks.length; i++) {
        const month = Number(weeks[i].start.slice(5, 7)) - 1;
        const previous = Number(weeks[i - 1].start.slice(5, 7)) - 1;
        if (month === previous || month % 3 !== 0) continue;
        const label = strings.month(month);
        const left = x + i * pitch;
        const overflow = left + measure(label, type.axis) > x + width;
        canvas.text(overflow ? x + width : left, axisY, label, {
            size: type.axis,
            fill: palette.slate,
            anchor: overflow ? 'end' : 'start'
        });
    }
    return bar;
}

function hourly(ctx: Context, x: number, width: number, top: number, bottom: number, axisY: number, bar: number): void {
    const {canvas, palette, stats, type} = ctx;
    const hours = stats.hours.slice(0, 24);
    const pitch = width / 24;
    const barWidth = Math.min(bar, pitch - 1.6);
    canvas.hline(x, x + width, bottom, palette.hairline);
    const max = Math.max(0, ...hours);
    hours.forEach((count, hour) => {
        if (max === 0 || count <= 0) return;
        const height = Math.max(1.5, (count / max) * (bottom - top));
        canvas.rect(x + hour * pitch, bottom - height, barWidth, height, palette.bar);
    });
    for (const hour of [0, 6, 12, 18]) {
        canvas.text(x + hour * pitch, axisY, String(hour).padStart(2, '0'), {
            size: type.axis,
            fill: palette.slate,
            tabular: true
        });
    }
}

function languages(ctx: Context, x: number, width: number, firstY: number, pitch: number, nameWidth: number): void {
    const {canvas, palette, stats, strings, type} = ctx;
    const sorted = [...stats.languages].filter(language => language.count > 0).sort((a, b) => b.count - a.count);
    const total = sorted.reduce((sum, language) => sum + language.count, 0);
    if (total === 0) return;
    const rows = sorted.slice(0, 4).map(language => ({name: language.name, count: language.count}));
    const rest = sorted.slice(4).reduce((sum, language) => sum + language.count, 0);
    if (rest > 0) rows.push({name: strings.other, count: rest});
    const size = type.language;
    const barHeight = ctx.layout === 'narrow' ? 6 : 4;
    const barX = x + nameWidth;
    const barLength = width - nameWidth - measure('100.0%', size) - size;
    rows.forEach((row, i) => {
        const y = firstY + i * pitch;
        const share = row.count / total;
        const barY = y - size * 0.34 - barHeight / 2;
        canvas.text(x, y, fit(row.name, size, nameWidth - size * 0.7), {size, fill: palette.ink});
        canvas.rect(barX, barY, barLength, barHeight, palette.track);
        canvas.rect(barX, barY, Math.max(2, share * barLength), barHeight, palette.bar);
        canvas.text(x + width, y, formatPercent(share), {size, fill: palette.slate, tabular: true, anchor: 'end'});
    });
}

function header(ctx: Context, x: number, y: number, width: number, metaY: number): void {
    const {canvas, palette, stats, strings, type} = ctx;
    canvas.text(x, y, strings.kicker(stats.login), {
        size: type.kicker,
        fill: palette.slate,
        weight: 500,
        tracking: TRACKING.caps
    });
    const meta = `${strings.window} · ${strings.updated(stats.generatedAt)}`;
    if (metaY === y) {
        canvas.text(x + width, y, meta, {size: type.meta, fill: palette.slate, anchor: 'end'});
    } else {
        canvas.text(x, metaY, meta, {size: type.meta, fill: palette.slate});
    }
}

interface Cell {
    value: string;
    label: string;
    unit?: string;
}

function cells(ctx: Context): Cell[] {
    const {stats, strings} = ctx;
    const totals = stats.totals;
    return [
        {value: formatNumber(totals.contributions), label: strings.contributions},
        {value: formatNumber(totals.commits), label: strings.commits},
        {value: formatNumber(totals.pullRequests), label: strings.pullRequests},
        {value: formatNumber(totals.activeDays), label: strings.activeDays},
        {value: formatNumber(totals.longestStreak), label: strings.longestStreak, unit: strings.days}
    ];
}

// Wide and medium: a header line, the five figures in a ruled strip like
// ted-h.com's proof strip, then three charts side by side.
function drawWide(ctx: Context): Size {
    const {canvas, palette, strings, type, card, layout} = ctx;
    const padding = card ? PADDING[layout] : 0;
    const contentWidth = CONTENT_WIDTH[layout];
    const x0 = padding;
    const top = card ? 58 : Math.ceil(type.kicker * CAP) + 2;
    header(ctx, x0, top, contentWidth, top);

    const ruleTop = top + 26;
    const figureY = ruleTop + 24 + Math.round(type.figure * CAP);
    const labelY = figureY + Math.round(type.label * 1.8);
    const ruleBottom = labelY + 23;
    canvas.hline(x0, x0 + contentWidth, ruleTop, palette.hairline);
    canvas.hline(x0, x0 + contentWidth, ruleBottom, palette.hairline);
    const column = contentWidth / 5;
    const inset = layout === 'wide' ? 28 : 24;
    cells(ctx).forEach((cell, i) => {
        const x = i === 0 ? x0 : x0 + i * column + inset;
        if (i > 0) canvas.vline(x0 + i * column, ruleTop + 1, ruleBottom, palette.hairline);
        figure(ctx, x, figureY, cell.value, type.figure, cell.unit);
        canvas.text(x, labelY, cell.label, {size: type.label, fill: palette.slate});
    });

    const gutter = layout === 'wide' ? 48 : 40;
    const chartWidth = (contentWidth - 2 * gutter) / 3;
    const chartX = [0, 1, 2].map(i => x0 + i * (chartWidth + gutter));
    const titleY = ruleBottom + 44;
    const plotTop = titleY + 30;
    const plotBottom = plotTop + 88;
    const axisY = plotBottom + Math.round(type.axis * 1.7);
    chartTitle(ctx, chartX[0], titleY, strings.byWeek);
    const bar = weekly(ctx, chartX[0], chartWidth, plotTop, plotBottom, axisY);
    chartTitle(ctx, chartX[1], titleY, strings.byHour);
    hourly(ctx, chartX[1], chartWidth, plotTop, plotBottom, axisY, bar);
    chartTitle(ctx, chartX[2], titleY, strings.languages);
    languages(ctx, chartX[2], chartWidth, axisY - 4 * 24, 24, layout === 'wide' ? 120 : 104);

    return {width: contentWidth + 2 * padding, height: axisY + (card ? 38 : 5)};
}

// Narrow: the header on two lines, contributions as the hero figure, the other
// four in a 2 x 2 grid, then the charts stacked.
function drawNarrow(ctx: Context): Size {
    const {canvas, palette, strings, type, card} = ctx;
    const padding = card ? PADDING.narrow : 0;
    const contentWidth = CONTENT_WIDTH.narrow;
    const x0 = padding;
    const top = card ? 66 : Math.ceil(type.kicker * CAP) + 2;
    const metaY = top + 32;
    header(ctx, x0, top, contentWidth, metaY);

    const [hero, ...rest] = cells(ctx);
    const ruleTop = metaY + 28;
    const heroY = ruleTop + 26 + Math.round(type.hero * CAP);
    const heroLabelY = heroY + Math.round(type.label * 1.65);
    canvas.hline(x0, x0 + contentWidth, ruleTop, palette.hairline);
    figure(ctx, x0, heroY, hero.value, type.hero, hero.unit);
    canvas.text(x0, heroLabelY, hero.label, {size: type.label, fill: palette.slate});

    let rowTop = heroLabelY + 28;
    const gridTop = rowTop;
    const half = contentWidth / 2;
    canvas.hline(x0, x0 + contentWidth, rowTop, palette.hairline);
    for (let row = 0; row < 2; row++) {
        const figureY = rowTop + 24 + Math.round(type.figure * CAP);
        const labelY = figureY + Math.round(type.label * 1.6);
        rest.slice(row * 2, row * 2 + 2).forEach((cell, i) => {
            const x = i === 0 ? x0 : x0 + half + 28;
            figure(ctx, x, figureY, cell.value, type.figure, cell.unit);
            canvas.text(x, labelY, cell.label, {size: type.label, fill: palette.slate});
        });
        rowTop = labelY + 26;
        canvas.hline(x0, x0 + contentWidth, rowTop, palette.hairline);
    }
    canvas.vline(x0 + half, gridTop + 1, rowTop, palette.hairline);

    const weekTitleY = rowTop + 64;
    const weekTop = weekTitleY + 44;
    const weekBottom = weekTop + 132;
    const weekAxisY = weekBottom + 30;
    chartTitle(ctx, x0, weekTitleY, strings.byWeek);
    const bar = weekly(ctx, x0, contentWidth, weekTop, weekBottom, weekAxisY);

    const languageTitleY = weekAxisY + 76;
    const firstLanguageY = languageTitleY + 48;
    chartTitle(ctx, x0, languageTitleY, strings.languages);
    languages(ctx, x0, contentWidth, firstLanguageY, 38, 190);

    const hourTitleY = firstLanguageY + 4 * 38 + 78;
    const hourTop = hourTitleY + 28;
    const hourBottom = hourTop + 112;
    const hourAxisY = hourBottom + 30;
    chartTitle(ctx, x0, hourTitleY, strings.byHour);
    hourly(ctx, x0, contentWidth, hourTop, hourBottom, hourAxisY, bar);

    return {width: contentWidth + 2 * padding, height: hourAxisY + (card ? 46 : 6)};
}

function summary(stats: TedStats, strings: Strings): string {
    const totals = stats.totals;
    const top = [...stats.languages]
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(language => language.name)
        .join(', ');
    return strings.summary({
        contributions: formatNumber(totals.contributions),
        commits: formatNumber(totals.commits),
        pullRequests: formatNumber(totals.pullRequests),
        activeDays: formatNumber(totals.activeDays),
        longestStreak: formatNumber(totals.longestStreak),
        languages: top
    });
}

export function renderDashboard(stats: TedStats, options: DashboardOptions): string {
    const frame = options.frame ?? 'card';
    const palette = PALETTES[options.mode];
    const strings = STRINGS[options.locale];
    const ctx: Context = {
        stats,
        palette,
        strings,
        type: TYPE[options.layout],
        layout: options.layout,
        card: frame === 'card',
        canvas: new Canvas()
    };
    const {width, height} = options.layout === 'narrow' ? drawNarrow(ctx) : drawWide(ctx);
    const box = ctx.card
        ? el('rect', {
              x: 0.5,
              y: 0.5,
              width: width - 1,
              height: height - 1,
              rx: 11.5,
              fill: palette.background,
              stroke: palette.border
          })
        : '';
    const body =
        el('title', {id: 'gpsc-title'}, escapeXml(strings.title(stats.name || stats.login))) +
        el('desc', {id: 'gpsc-desc'}, escapeXml(summary(stats, strings))) +
        el('style', {}, styleBlock(ctx.canvas.cjk, options.embedFonts ?? true)) +
        box +
        ctx.canvas.toString();
    return el(
        'svg',
        {
            xmlns: 'http://www.w3.org/2000/svg',
            width,
            height,
            viewBox: `0 0 ${n(width)} ${n(height)}`,
            role: 'img',
            'aria-labelledby': 'gpsc-title gpsc-desc'
        },
        body
    );
}
