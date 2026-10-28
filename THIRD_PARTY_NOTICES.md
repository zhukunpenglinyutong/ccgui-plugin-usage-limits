# Third-Party Notices

This plugin's interaction design references a third-party project, and it
uses one third-party icon set plus two provider trademarks. No code, image,
sprite or other asset from TokenTracker is included in this repository or in
the built `main.js` / `styles.css`. The notice and license text below are
reproduced as required by each source's license.

## TokenTracker

- Upstream: https://github.com/xiufengsun/tokentracker
- Version referenced: **1.4.15** (commit `4cf3e2125b8e274d03b7210c2fd0e1124e23f987`, short `4cf3e212`)
- License: MIT (see below)

What was referenced (information architecture and interaction ideas only;
all wording, visuals and code in this plugin are original — built on CC GUI's
own design tokens and `@ccgui/plugin-ui` components, with the CC GUI app icon
used as the status mark — so no third-party artwork is reproduced):

| Area | What was referenced |
|---|---|
| Menu-bar summary / popover | A compact "today" figure in the menu bar that opens a summary panel with today / rolling-period totals and per-provider limit rows. |
| Limits page | One card per subscription provider with a bar per rate-limit window, a pace marker (time progress through the window), reset countdowns, and signed-out / expired / rate-limited states. |
| Dashboard | Period tabs (day / week / month / year / all / custom), share-style summary cards per engine, a calendar heatmap, a stacked usage trend, and a daily detail table. |

What was deliberately **not** reused:

- The **Clawd** mascot and every other mascot / desktop-pet sprite, frame or
  animation (including the RunCat frames and the vendored `bot` morphing
  engine TokenTracker itself credits to third parties). The mark shown in this
  plugin's status chip is the CC GUI app icon, i.e. this project's own artwork.
- Brand logos are used **only** as provider labels (see below), never as
  TokenTracker assets.
- The **3D heatmap**; this plugin only has a flat calendar heatmap.
- **React Bits `ElectricLogo`** and any other component under the Commons
  Clause.
- **Brand logos** (provider marks, the Devin mark, etc.). Providers are shown
  with plain letter tiles in CC GUI chart colors.
- **Telemetry**, analytics, cloud sync, leaderboards and any network
  reporting. This plugin uploads nothing.
- TokenTracker's log parsers, price handling and CLI integrations: usage is
  computed by the CC GUI host (SDK `usage.read` / `limits.read`); the plugin
  only displays it.

```
MIT License

Copyright (c) 2026 xiufengsun

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Provider marks (LobeHub icons)

The Claude and OpenAI (Codex) logo paths in `src/ui/ProviderMark.tsx` come from
[@lobehub/icons-static-svg](https://github.com/lobehub/lobe-icons) 1.95.0, the
same icon set the CC GUI model picker uses. The package declares the MIT
license:

```
MIT License

Copyright (c) LobeHub

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**Trademarks**: Claude and the Anthropic mark belong to Anthropic PBC; OpenAI
and the OpenAI mark belong to OpenAI. They appear here only to identify which
CLI's subscription quota a row refers to. This plugin is not affiliated with,
endorsed by, or sponsored by either company.

## Lucide icons

The icon geometry in `src/ui/icons.tsx` (refresh, check, bell, chevrons, …)
is SVG path data from [Lucide](https://lucide.dev) (as shipped in
`lucide-react` 0.562.0, the icon set the CC GUI host uses), inlined because
Tier-1 plugins cannot import the host's icon package.

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2023 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2025.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The MIT License (MIT) (for portions derived from Feather)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Names and marks

Claude and Claude Code are trademarks of Anthropic PBC; Codex and ChatGPT are
trademarks of OpenAI. Names are used only to identify the CLIs and services
whose local data CC GUI reads. This plugin is not affiliated with, endorsed by
or sponsored by those companies, nor by the TokenTracker project — it is not
an official TokenTracker release and is not published by TokenTracker's
author.
