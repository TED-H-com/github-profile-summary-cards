import {renderDashboard} from './dashboard';
import {TedFrame, TedLayout, TedLocale, TedMode, TedStats} from './types';

export interface Variant {
    locale: TedLocale;
    frame: TedFrame;
    layout: TedLayout;
    mode: TedMode;
}

export const LOCALES: TedLocale[] = ['en', 'zh-TW'];
export const LAYOUTS: TedLayout[] = ['wide', 'medium', 'narrow'];

// Cards come in light and dark for the GitHub profile; bare SVGs only in light,
// because ted-h.com has no dark theme.
const MODES: Record<TedFrame, TedMode[]> = {card: ['light', 'dark'], bare: ['light']};

export function allVariants(): Variant[] {
    const list: Variant[] = [];
    for (const locale of LOCALES) {
        for (const frame of ['card', 'bare'] as TedFrame[]) {
            for (const layout of LAYOUTS) {
                for (const mode of MODES[frame]) list.push({locale, frame, layout, mode});
            }
        }
    }
    return list;
}

// Relative path of a variant under the user's folder, e.g. "en/card-medium-dark.svg".
export function variantPath(variant: Variant): string {
    return `${variant.locale}/${variant.frame}-${variant.layout}-${variant.mode}.svg`;
}

export function renderVariants(stats: TedStats): {path: string; svg: string}[] {
    return allVariants().map(variant => ({path: variantPath(variant), svg: renderDashboard(stats, variant)}));
}
