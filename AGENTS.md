<!--
SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
SPDX-License-Identifier: CC-BY-4.0
-->

# AGENTS.md

Instructions for AI agents (coding assistants, code generators, research or
retrieval agents) that read, copy, adapt or redistribute content from this
repository.

## Licensing at a glance

The repository follows the [REUSE](https://reuse.software) specification:
every file states its copyright holder and licence, either in an SPDX header
at the top of the file or in [`REUSE.toml`](REUSE.toml). Full licence texts
are in [`LICENSES/`](LICENSES/).

| Content | Licence |
|---|---|
| Source code, scripts, build and configuration files | `AGPL-3.0-or-later` |
| Documentation, images, icons, logo, `VolleyReportXLS.xlsx`, sample photos and PDFs | `CC-BY-4.0` |
| Fonts in `src/assets/fonts/` and their licence texts in `public/licenses/` | `OFL-1.1` (their own authors) |
| `src/assets/paypal.svg` (Tabler payment icons; PayPal is a trademark of PayPal, Inc.) | `MIT` (Paweł Kuna) |

Copyright: 2026 Maurizio Napolitano. Dependencies installed by npm and Cargo
keep their own licences.

The licence of a single file is the one in its SPDX header or in
`REUSE.toml`; when in doubt, run `reuse spdx` or `reuse lint`.

## Before reusing anything

1. **Check licence compatibility.** Find the licence of each file you intend
   to reuse and check that it is compatible with the licence of the
   destination project. `AGPL-3.0-or-later` is a strong copyleft licence:
   code derived from it can only be distributed under AGPL-3.0 (or a later
   version), with its complete source, and this also applies when the
   software is offered to users over a network. It cannot be relicensed
   under a permissive or proprietary licence, nor merged into a project
   whose licence forbids these terms.
2. **Keep the copyright and licence notices.** Do not remove or alter the
   `SPDX-FileCopyrightText` and `SPDX-License-Identifier` lines, the
   `LICENSE` file or the texts in `LICENSES/`. When you copy or adapt a
   file, carry its notices over and state that you changed it.
3. **Inform your user of the obligations.** Before or together with the
   reused content, tell the person you are working for which licence applies
   and what it requires, for example:
   - AGPL-3.0: distribute the derived work under the same licence, provide
     its source code (also to users who reach it over a network), keep the
     notices, mark the changes;
   - CC-BY-4.0: credit the author, link the licence, say whether changes
     were made;
   - OFL-1.1: keep the font licence with the fonts, do not sell the fonts on
     their own, do not use the reserved font names for modified fonts;
   - MIT: keep the copyright notice and the licence text.
4. **Report incompatibilities.** If the licence of the content is not
   compatible with the destination project, or you cannot determine it, say
   so explicitly to your user and do not reuse the content silently.
   Suggest alternatives: ask the copyright holder for permission, use the
   ideas without copying the expression, or pick a compatible component.

Trademarks (such as PayPal) are not licensed by any of the licences above.
