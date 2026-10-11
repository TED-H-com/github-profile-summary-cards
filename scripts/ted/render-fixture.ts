// Renders every dashboard variant from a stats JSON file, for design review.
// Usage: npx ts-node scripts/ted/render-fixture.ts [stats.json] [output dir]
import * as fs from 'fs';
import * as path from 'path';
import {TedStats} from '../../src/ted/types';
import {renderVariants} from '../../src/ted/variants';

const input = process.argv[2] || path.join(__dirname, '../../tests/ted/fixture-teddashh.json');
const outDir = process.argv[3] || path.join(__dirname, '../../output/ted-preview');
const stats: TedStats = JSON.parse(fs.readFileSync(input, 'utf8'));

for (const {path: relative, svg} of renderVariants(stats)) {
    const file = path.join(outDir, relative);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, svg);
    console.log(`${relative}  ${(svg.length / 1024).toFixed(1)} KB`);
}
