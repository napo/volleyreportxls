<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# Social preview

`public/social-preview.png` (1280 × 640) is the image shown when the site or the
repository is shared. It is rendered from `social-preview.html` in a browser at
1280 × 640, with next to it:

- `og-logo.png`: `src/assets/volleyreportxls-logo.png`;
- `og-form-1.png`: page 1 of `docs/examples/modulo-rilevazione.pdf` at 110 dpi;
- `og-tab-crop.png`: the scoresheet card of the example match (top part, 2× screenshot);
- the Montserrat and Roboto `latin-wght-normal.woff2` files from `node_modules/@fontsource-variable`.

On GitHub the same image is set by hand in *Settings → General → Social preview*.

## Shared reports

`public/share-preview.png` (1280 × 640) is the image of a shared report: the
links start with `report.volleyserve.it/r/`, a page (`public/r/index.html`)
with its own title and image that goes on to the app keeping the part after
`#`, which link previews never see. It is rendered from `share-preview.html`
in the same way, with `og-logo.png`, the two fonts and:

- `og-eval.png`: the card “Evaluations by skill” of a shared match (2× screenshot);
- `og-trend.png`: the card “Trend by set” of the same match (2× screenshot).

No team or athlete names: the preview is the same for every shared report.
