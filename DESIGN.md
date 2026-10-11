# DESIGN.md: Ted's GitHub dashboard

This file covers the dashboard in `src/ted/` only. The upstream cards and their themes are unchanged.
Code: `src/ted/tokens.ts` holds every value below, `src/ted/dashboard.ts` draws the card,
`src/ted/variants.ts` lists the files it produces.

## 1. Visual theme and atmosphere

A quiet, editorial data card in the style of [ted-h.com](https://ted-h.com): white or near-black surface,
black ink, one gray for everything secondary, hairline rules instead of boxes. The numbers carry the card:
five figures in a ruled strip, like the proof strip on the ted-h.com homepage, then three small charts.
It is monochrome on purpose, so the language colors, icons and trophies of the upstream cards are gone.
It should read like a page in an annual report, not a game screen.

## 2. Color palette and roles

| Role | Light | Dark | Used for |
|---|---|---|---|
| background | `#ffffff` | `#0a0a0a` | card surface; the bare frame has none |
| border | `#e7eaf0` | `#2a2a2a` | card outline, 1px |
| hairline | `#e7eaf0` | `#262626` | rules, column dividers, chart baselines |
| ink | `#030303` | `#fafafa` | figures, language names, the peak value |
| slate | `#676f7b` | `#a1a1a1` | kicker, meta line, labels, axes, percentages |
| bar | `#030303` | `#fafafa` | chart bars, language shares |
| barSoft | `#c8cdd4` | `#525252` | the week still in progress |
| track | `#eef0f4` | `#1f1f1f` | the empty part of a language bar |

Light values are ted-h.com's ink, slate and hairline. Dark values follow the dark banner in the profile README.
There are no other colors. Add a role here before adding a hex value anywhere.

## 3. Typography rules

| Face | Family in the SVG | Used for |
|---|---|---|
| Inter 400 and 500 | `Ted Inter` | labels, kicker, meta, axes, language rows |
| Inter Display 500 | `Ted Inter Display` | the figures |
| Noto Sans TC 400 and 500 | `Ted Noto TC` | Chinese text, embedded in zh-TW files only |

An SVG shown as an image cannot load web fonts, so subsets are embedded as base64 woff2 (about 30 KB per
English file, 50 KB per Chinese one). Subsetting changes a font, and the OFL keeps the original names for the
original fonts, so the subsets carry their own names. Licenses are in `fonts/`. After changing any zh-TW
string, rebuild the subsets with `scripts/ted/build_fonts.py`.

Sizes in viewBox units, per layout (wide / medium / narrow):

| Role | Wide | Medium | Narrow | Weight |
|---|---|---|---|---|
| kicker | 13.5 | 14 | 19 | 500, caps |
| meta | 14 | 14.5 | 20 | 400 |
| hero figure | | | 76 | 500 Display |
| figure | 31 | 36 | 48 | 500 Display |
| label | 14.5 | 16 | 21 | 400 |
| chart title | 13.5 | 14 | 19 | 500, caps |
| axis | 13 | 13.5 | 18 | 400, tabular |
| language row | 14.5 | 15.5 | 21 | 400; percentage tabular |
| peak value | 13 | 13.5 | 18 | 500, tabular |

Tracking: English caps 0.16em (the ted-h.com eyebrow), Chinese labels 0.04em, figures -0.035em, the hero
figure -0.04em. English caps are written out in `i18n.ts` rather than made by CSS, so the text matches what a
screen reader gets. Only weights 400 and 500 exist; `font-synthesis` is off.

## 4. Component stylings

- **Header.** Kicker `GITHUB / LOGIN` on the left, the meta line `Past 12 months · Updated <date>` on the
  right. The narrow layout puts the meta line under the kicker.
- **Figure strip.** Hairlines above and below, five equal columns split by vertical hairlines. Figure in ink,
  label in slate under it. The streak gets a unit (`days`, `天`) after the figure in label size. The narrow
  layout shows contributions as a hero figure and the other four in a 2 x 2 grid.
- **Contributions by week.** 52 bars of equal width on a hairline baseline. The tallest bar gets its value
  above it. The week still in progress is barSoft. Month labels only where a quarter starts.
- **Commits by hour.** 24 bars, the same width as the weekly bars so the two charts read as one family.
  Labels 00, 06, 12 and 18. Always UTC, and the title says so.
- **Top languages.** The four largest shares of commits, plus Other. Name, a 4px bar on a track (6px in
  narrow), the percentage right-aligned with one decimal. Long names are shortened with an ellipsis.
- **Frames.** `card`: background, 1px border, radius 12, padding 40 (32 in narrow), for the GitHub profile.
  `bare`: no background, border or padding, for a host page that draws its own card.

## 5. Layout principles

| Layout | Content width | Card file | Bare file | Renders at about |
|---|---|---|---|---|
| wide | 1100 | 1180 x 402 | 1100 x 323 | 0.9x, ted-h.com on a desktop |
| medium | 920 | 1000 x 409 | 920 x 331 | 0.85x, a desktop GitHub profile, ted-h.com on a tablet |
| narrow | 536 | 600 x 1348 | 536 x 1258 | 0.55x, a phone |

An SVG scales with the column it sits in, so one drawing cannot serve every width. Each layout is drawn for
the width it usually renders at, which keeps labels near the same pixel size everywhere.

- Five figure columns with a 28 (wide) or 24 (medium) inset; three chart columns with 48 or 40 gutters.
- Text is placed by Inter's cap height (0.727 em), so figures sit evenly between their rules.
- Rules are 1-unit rectangles, never strokes, so they stay crisp at any scale.
- Whitespace separates groups; nothing is boxed inside the card.

## 6. Depth and elevation

None inside the SVG: no shadows, gradients, rounded bars or animation. Hairlines and space do the work.
The host page may add depth. On ted-h.com the wrapping link lifts 2px with a soft shadow on hover, like the
site's other cards.

## 7. Do's and don'ts

Do:
- Let the numbers be the only emphasis.
- Show public data only. The workflow runs with its own `GITHUB_TOKEN`, which sees what any visitor sees,
  and the collector refuses the profile owner's token.
- Add every new string in both locales, then rebuild the fonts.
- Check text collisions in both locales; Chinese labels are shorter, English ones longer.

Don't:
- Add language colors, icons, emoji, gradients or animation.
- Put a city, a time zone or a private repository on a card, in `stats.json` or in the logs.
- Track Chinese like English caps.
- Stretch one layout across every width. Pick the variant per breakpoint (section 8).

## 8. Responsive behavior

Files live at `https://teddashh.github.io/github-profile-summary-cards/<login>/<locale>/<frame>-<layout>-<mode>.svg`,
with `<locale>` `en` or `zh-TW`. Cards come in light and dark; bare files in light only.

- **GitHub profile README.** `<picture>` with card files: narrow when the window is 1100px or narrower,
  medium above that, each in light and dark through `prefers-color-scheme`.
- **ted-h.com homepage.** Bare files inside the site's own card: narrow below 768px (centered, at most
  460px wide), medium from 768 to 991.98px, wide from 992px.
- The SVG has `role="img"` with a title and a description that spells out the numbers, so screen readers
  get the content without the charts.

## 9. Agent prompt guide

Tokens: `PALETTES` (eight roles), `TYPE[layout]`, `TRACKING`, `CONTENT_WIDTH`, `PADDING` (40 / 40 / 32).
Faces for measuring text: `text-400`, `text-500`, `figure-500`.

Example requests:
1. "Add a Reviews figure." New strings in both locales, rebuild fonts, add a cell in `cells()`. The strip
   becomes six columns: keep the insets and check medium at 820px for collisions.
2. "Add a dark bare variant for a dark host page." Add `dark` to `MODES.bare` in `variants.ts`. Nothing else
   changes.
3. "Show the past 6 months." Change the window in the collector and the `window` and `title` strings; the
   weekly chart takes whatever weeks it gets.

Before calling a change done, run `npx ts-node scripts/ted/render-fixture.ts` and look at the SVGs at 390,
820 and 1440px wide in Chromium and WebKit: no collisions, figures aligned with their labels, nothing clipped.
