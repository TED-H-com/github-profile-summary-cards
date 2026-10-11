import {ADVANCES, FONT_FACES} from './fonts.generated';
import {FIGURE_STACK, TEXT_STACK} from './tokens';

export type Face = 'text-400' | 'text-500' | 'figure-500';

const CJK = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/;

export function hasCjk(value: string): boolean {
    return CJK.test(value);
}

export function escapeXml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Two decimals at most, so the markup stays short and stable between runs.
export function n(value: number): string {
    return String(Math.round(value * 100) / 100);
}

type AttrValue = string | number | undefined;

export function el(tag: string, attrs: {[name: string]: AttrValue}, children = ''): string {
    const attrText = Object.entries(attrs)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => ` ${name}="${typeof value === 'number' ? n(value) : escapeXml(value as string)}"`)
        .join('');
    return children === '' ? `<${tag}${attrText}/>` : `<${tag}${attrText}>${children}</${tag}>`;
}

// Approximate rendered width in viewBox units: advance widths without kerning.
// CJK characters are one em wide in Noto Sans TC. Browsers add letter-spacing
// after every character, the last one included, and so does this.
export function measure(value: string, size: number, face: Face = 'text-400', tracking = 0): number {
    const advances = ADVANCES[face];
    let width = 0;
    for (const ch of value) {
        const advance = advances[ch] ?? ADVANCES['text-400'][ch] ?? (hasCjk(ch) ? 1 : 0.6);
        width += advance * size + tracking * size;
    }
    return width;
}

// Shortens a label with an ellipsis until it fits maxWidth.
export function fit(value: string, size: number, maxWidth: number, face: Face = 'text-400'): string {
    if (measure(value, size, face) <= maxWidth) return value;
    const chars = Array.from(value);
    while (chars.length > 1 && measure(chars.join('') + '\u2026', size, face) > maxWidth) chars.pop();
    return chars.join('').trimEnd() + '\u2026';
}

export function styleBlock(withCjk: boolean, embedFonts: boolean): string {
    const faces = embedFonts
        ? FONT_FACES.filter(face => withCjk || face.family !== 'Ted Noto TC')
              .map(
                  face =>
                      `@font-face{font-family:'${face.family}';font-style:normal;font-weight:${face.weight};` +
                      `src:url(data:font/woff2;base64,${face.woff2}) format('woff2')}`
              )
              .join('')
        : '';
    return (
        faces +
        `text{font-family:${TEXT_STACK};font-weight:400;font-synthesis:none;font-kerning:normal;text-rendering:geometricPrecision}` +
        '.m{font-weight:500}' +
        `.f{font-family:${FIGURE_STACK};font-weight:500}` +
        '.t{font-variant-numeric:tabular-nums}'
    );
}
