# App font — Inter (self-hosted)

Font stack: `'Inter', 'SF Pro Text', 'UniversLTPro-55Roman', sans-serif`
(declared in `src/index.css` `@font-face` + `body`, and in `src/App.tsx` AntD theme token).

## Primary — Inter (WOFF2)
Chosen because it's heavily hinted for screens and renders cleanly on Windows
(DirectWrite/ClearType). Four real weights → no faux bolding.

| File               | CSS weight | Tailwind class  |
| ------------------ | ---------- | --------------- |
| `Inter-400.woff2`  | 400        | `font-normal`   |
| `Inter-500.woff2`  | 500        | `font-medium`   |
| `Inter-600.woff2`  | 600        | `font-semibold` |
| `Inter-700.woff2`  | 700        | `font-bold`     |

Source: Fontsource (Inter, latin subset). Self-hosted → works offline.

## Fallback — SF Pro Text (WOFF)
Kept in place so it can be compared or promoted. SF Pro's web conversions lack
Windows hinting, so small text / thin strokes (e.g. lowercase "t") render
unevenly on Windows — that's why Inter is primary.

`SFProTextR.woff` (400), `SFProTextM.woff` (500), `SFProTextSB.woff` (600), `SFProTextB.woff` (700).

## Switching fonts
Reorder the family list in `src/index.css` `body` and `src/App.tsx` `fontFamily`.
Univers LT Pro is a name-only fallback (no files shipped); drop its `.woff2`
files here and move it first to use it.
