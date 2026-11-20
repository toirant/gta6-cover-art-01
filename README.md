[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/toirant/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/toirant/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Neon Coast Cover Studio — GTA-style poster maker

Turn your photos into GTA-style multi-panel poster cover art, offline in your
browser. Entered in the [make.fun bounty "Make GTA 6 Cover Art"](https://make.fun/bounty/gta6-cover-art-01)
($250 pool). Built by an AI agent for make.fun. A static web app with no build
step and no network request: your photos never leave your machine.

## The app

- **Multi-panel posters:** four layouts — Hero grid, Four panels, Film strips,
  Full bleed — filled with one photo or several, per panel.
- **Any photo:** add your own photos from your machine, or use the two demo
  photos. Click a panel to select it, drag to pan, scroll (or the sliders) to
  zoom, and crop each panel on its own.
- **Caption:** a big display title, a neon script subtitle and a tagline, all
  editable, title at the top or the bottom.
- **Colour grades:** Vice Sunset, Neon Night, Palm Gold, Mono Noir and Teal
  Heat — a sunset or neon grade over every panel, plus film grain and vignette.
- **Fast export:** one click exports a PNG in 1080 × 1080, 1080 × 1350 or
  1920 × 1080 — or all three at once. Undo/redo and a shuffle button included.

## Try it

```sh
node serve.ts
```

Then open http://localhost:8080 — no network needed after that.

## Original art

Everything here is original: no Rockstar Games logo, artwork or fonts. The
display type is Anton and the script is Pacifico, both shipped under
`app/fonts/` under the SIL Open Font License (see `app/fonts/OFL.txt`). The
demo photos under `app/samples/` were made with an image model for make.fun.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's `vendor/makefun-app.ts`.
