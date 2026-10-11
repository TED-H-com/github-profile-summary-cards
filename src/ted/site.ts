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

// A plain page at the Pages root that shows the card and lists every file.
function indexHtml(login: string, title: string, files: string[]): string {
    const items = files.map(file => `<li><a href="${login}/${file}">${file}</a></li>`).join('\n');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;padding:48px 24px 64px;background:#fff;color:#030303;font:15px/1.6 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
main{max-width:1000px;margin:0 auto}
h1{margin:0 0 24px;font-size:13px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:#676f7b}
img{display:block;width:100%;height:auto}
ul{margin:32px 0 0;padding:0;list-style:none;columns:2;font-size:14px}
a{color:inherit}
@media (prefers-color-scheme: dark){body{background:#0a0a0a;color:#fafafa}h1{color:#a1a1a1}}
</style>
</head>
<body>
<main>
<h1>GitHub / ${login}</h1>
<picture>
<source media="(prefers-color-scheme: dark)" srcset="${login}/en/card-medium-dark.svg">
<img src="${login}/en/card-medium-light.svg" alt="${title}">
</picture>
<ul>
${items}
</ul>
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
