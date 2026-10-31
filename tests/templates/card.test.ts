import {Card, TITLE_LINE_HEIGHT} from '../../src/templates/card';
import {ThemeMap} from '../../src/const/theme';

describe('Card', () => {
    const theme = ThemeMap.get('default')!;

    it('renders with default parameters', () => {
        const card = new Card('Default Title', 1280, 1024, theme);
        const svgString = card.toString();

        expect(svgString).toContain('<svg');
        expect(svgString).toContain('width="1280"');
        expect(svgString).toContain('height="1024"');
        expect(svgString).toContain(`viewBox="0 0 1280 1024"`);
        expect(svgString).toContain('Default Title');
        expect(svgString).toContain('fill: ' + theme.title);
        expect(svgString).toContain('fill="' + theme.background + '"');
        expect(svgString).toContain('stroke="' + theme.stroke + '"');

        // Single line body offset
        expect(svgString).toContain('transform="translate(0,40)"');
    });

    it('renders empty title correctly without text elements', () => {
        const card = new Card('', 400, 300, theme);
        const svgString = card.toString();

        expect(svgString).not.toContain('<text');
        // Empty title body offset
        expect(svgString).toContain('transform="translate(0,40)"');
    });

    it('renders multi-line titles correctly', () => {
        const card = new Card('Line 1\nLine 2\nLine 3', 500, 400, theme);
        const svgString = card.toString();

        expect(svgString).toContain('Line 1');
        expect(svgString).toContain('Line 2');
        expect(svgString).toContain('Line 3');

        // Check for multiple text elements
        const textCount = (svgString.match(/<text/g) || []).length;
        expect(textCount).toBe(3);

        // Check dynamic body offset based on TITLE_LINE_HEIGHT
        const expectedOffset = 40 + (3 - 1) * TITLE_LINE_HEIGHT;
        expect(svgString).toContain(`transform="translate(0,${expectedOffset})"`);
    });

    it('returns the svg root node via getSVG', () => {
        const card = new Card('Title', 200, 200, theme);
        const svgNode = card.getSVG();

        expect(svgNode.empty()).toBe(false);
        // It returns the translated g wrapper inside the main svg
        expect(svgNode.node()?.tagName.toLowerCase()).toBe('g');
        expect(svgNode.attr('transform')).toBe('translate(0,40)');
    });
});
