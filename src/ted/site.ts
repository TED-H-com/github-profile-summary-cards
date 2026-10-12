import * as fs from 'fs';
import * as path from 'path';
import {STRINGS} from './i18n';
import {TedStats} from './types';
import {renderVariants} from './variants';

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// A plain page at the Pages root: the card, then every file, English and data on
// the left, Chinese on the right. Phones get the narrow card.
function indexHtml(login: string, title: string, files: string[]): string {
    const list = (names: string[]): string =>
        names.map(file => `<li><a href="${login}/${file}">${file}</a></li>`).join('\n');
    const zh = files.filter(file => file.startsWith('zh-TW/'));
    const rest = files.filter(file => !file.startsWith('zh-TW/'));
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;padding:48px 24px 64px;background:#fff;color:#030303;font:15px/1.6 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
main{max-width:1000px;margin:0 auto}
h1{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
img{display:block;width:100%;height:auto}
h2{margin:48px 0 8px;font-size:13px;font-weight:500;letter-spacing:.16em;color:#676f7b}
p{margin:0 0 20px;color:#676f7b}
.files{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0 32px}
ul{margin:0;padding:0;list-style:none;font-size:14px}
li{padding:2px 0;white-space:nowrap}
a{color:inherit}
@media (max-width:640px){body{padding:32px 20px 48px}picture{display:block;max-width:460px;margin:0 auto}}
@media (prefers-color-scheme: dark){body{background:#0a0a0a;color:#fafafa}h2,p{color:#a1a1a1}}
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<picture>
<source media="(max-width: 640px) and (prefers-color-scheme: dark)" width="600" height="1348" srcset="${login}/en/card-narrow-dark.svg">
<source media="(max-width: 640px)" width="600" height="1348" srcset="${login}/en/card-narrow-light.svg">
<source media="(prefers-color-scheme: dark)" srcset="${login}/en/card-medium-dark.svg">
<img src="${login}/en/card-medium-light.svg" width="1000" height="409" alt="${title}">
</picture>
<h2>FILES</h2>
<p>Rebuilt every day from public GitHub data. Hours are in UTC.</p>
<div class="files">
<ul>
${list(rest)}
</ul>
<ul>
${list(zh)}
</ul>
</div>
</main>
</body>
</html>
`;
}

// Writes .nojekyll, index.html, <login>/stats.json and the 18 SVGs under outDir,
// and returns their paths relative to outDir, sorted.
export function writeSite(stats: TedStats, outDir: string): string[] {
    const login = stats.login.toLowerCase();
    const files: {path: string; content: string}[] = [
        {path: 'stats.json', content: JSON.stringify(stats, null, 2) + '\n'},
        ...renderVariants(stats).map(variant => ({path: variant.path, content: variant.svg}))
    ];
    const written = ['.nojekyll', 'index.html'];
    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
    for (const file of files) {
        const target = path.join(outDir, login, file.path);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, file.content);
        written.push(`${login}/${file.path}`);
    }
    const title = escapeHtml(STRINGS.en.title(stats.name || stats.login));
    const index = indexHtml(
        escapeHtml(login),
        title,
        files.map(file => escapeHtml(file.path))
    );
    fs.writeFileSync(path.join(outDir, 'index.html'), index);
    return written.sort();
}
