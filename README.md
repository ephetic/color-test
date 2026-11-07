# color-test

Web app to find personal hue boundaries between **blue/green** and **red/orange** at full saturation and brightness, with a display calibration wizard so results are more comparable across devices.

## v0 (this repo)

- Calibration wizard (brightness, contrast, gamma) applied to all rendered colors via canvas/CSS
- Bisection quiz UI (see `mock-up.jpg`)
- Results stored in `localStorage`

## v1 (planned)

- Multi-parameter discrimination curve in color space (parameters TBD)

## Development

```bash
bun install
bun run dev
```

## Deploy to GitHub Pages

The app is built with base path `/color-test/` for [ephetic/color-test](https://github.com/ephetic/color-test).

```bash
bun install
GITHUB_PAGES=true bun run build
# push dist via gh-pages branch:
bun run deploy
```

Enable GitHub Pages on the repo: **Settings → Pages → Deploy from branch `gh-pages` / root**.

Or use the workflow in `.github/workflows/deploy.yml` on push to `main`.
