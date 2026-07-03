# Handoff: Orange Whip — Homepage Redesign

## Overview
This package documents a redesign of the homepage for **orangewhip.surf**, the site for Orange Whip, a Vancouver, BC surf-psych rock band. The redesign's goals: **sell tickets / drive people to shows**, **set a bold band image**, and **push merch**. The visual direction is **psychedelic surf meets loud poster type** — a warm near-black background, sunset-orange palette, heavy display lettering, a full-bleed surf hero photo, and animated gradient accents.

The single-page homepage scrolls through: **Nav → Hero → Marquee → Show Dates → Media (Listen/Watch/Photos) → Merch → About → Mailing List → Footer.**

## About the Design Files
The file in this bundle — `Orange Whip Home.dc.html` — is a **design reference created in HTML**. It is a prototype that demonstrates the intended look, layout, copy, and behavior. **It is not production code to copy directly.** (It uses a small in-house templating runtime, `support.js`, that you should NOT port — ignore the `{{ }}` holes, `<sc-for>`, `<sc-if>`, and `<x-import>` constructs; they are scaffolding, not part of the design.)

Your task is to **recreate this design in the target codebase's existing environment** (the current orangewhip.surf stack — appears to be a JS app with an admin/CMS layer), using its established components, routing, and styling patterns. Several values are **admin-configurable** (see the "Admin-Configurable Fields" section) — wire those to the existing admin panel rather than hardcoding them.

If no front-end environment exists to extend, implement in a modern React + CSS setup; the design translates directly to flexbox/grid with inline or module CSS.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and interactions are final. Recreate the UI pixel-faithfully using the codebase's existing libraries and patterns. Where the codebase already has a design system, prefer its primitives but match the values documented here.

> **Note on colors:** all colors are authored in **OKLCH**. Hex/RGB approximations are provided alongside for convenience, but OKLCH is the source of truth and is supported in all current browsers. Keep OKLCH if the codebase allows.

---

## Design Tokens

### Color
| Token | OKLCH | ~Hex | Usage |
|---|---|---|---|
| `--bg` (base) | `oklch(0.16 0.018 45)` | `#23190F` | Page background (warm near-black) |
| `--bg-gradient-top` | `oklch(0.27 0.06 45)` | `#4A3318` | Radial glow at top of page |
| `--text` | `oklch(0.95 0.015 80)` | `#F4F1EA` | Primary text (warm off-white) |
| `--text-dim` | `oklch(0.78 0.02 80)` | `#C4BEB2` | Secondary text |
| `--text-dimmer` | `oklch(0.6 0.02 80)` | `#928D83` | Footer / muted |
| `--accent` (primary) | `oklch(0.72 0.2 50)` | `#E8721C` | **Orange** — wordmark, buttons, links, highlights |
| `--accent-2` | `oklch(0.68 0.21 0)` | `#E14A55` | Pinkish-red — secondary blob, gradient end |
| `--accent-3` | `oklch(0.8 0.16 85)` | `#E6A92E` | Gold/yellow — eyebrow dots, section labels |
| `--on-accent` | `oklch(0.13 0.02 45)` | `#1C140A` | Text on orange buttons (near-black) |
| hairline / border | `oklch(0.95 0.015 80 / 0.1–0.18)` | white @ 8–18% | Dividers, card borders |
| surface fill | `oklch(0.95 0.015 80 / 0.035–0.08)` | white @ 3.5–8% | Card / row backgrounds |

The palette is **swappable** (3 presets). Default is **Sunset** (above). Alternates:
- **Acid Surf:** accent `oklch(0.72 0.2 50)`, accent-2 `oklch(0.78 0.13 195)`, accent-3 `oklch(0.85 0.18 130)`
- **Magenta Haze:** accent `oklch(0.67 0.25 352)`, accent-2 `oklch(0.6 0.2 300)`, accent-3 `oklch(0.76 0.19 48)`

### Typography
Three families, loaded as webfonts:
- **Cooper Hewitt** — **SemiBold (600) Italic only** — the **hero wordmark + nav/footer logo**. This is the brand voice; it echoes the band's heavy, rounded, slanted logo lettering. Not on Google Fonts; load via Fontsource: `https://cdn.jsdelivr.net/npm/@fontsource/cooper-hewitt@5/600-italic.css` (or self-host the Cooper Hewitt SemiBold Italic woff2). SIL OFL licensed.
- **Anton** — Google Fonts — all-caps **section headings** ("SHOW DATES", "MEDIA", "MERCH", "THE BAND") and date numerals. Tall poster-condensed.
- **Space Grotesk** — Google Fonts, weights 400/500/600/700 — **body text, nav, labels, buttons**.

Type scale (clamp = responsive min/preferred/max):
| Role | Font | Size | Weight | Style | Notes |
|---|---|---|---|---|---|
| Hero wordmark | Cooper Hewitt | `clamp(64px,14vw,210px)` | 600 | italic | line-height 0.92; layered dark text-shadow (see Hero) |
| Section heading | Anton | `clamp(40px,7vw,84px)` | 400 | — | uppercase, line-height 0.92 |
| Nav / footer logo | Cooper Hewitt | 28px / 32px | 600 | italic | accent color |
| Nav links | Space Grotesk | 14px | 600 | — | uppercase, letter-spacing 0.06em |
| Section sub-label (eyebrow) | Space Grotesk | 13px | 700 | — | uppercase, letter-spacing 0.16em, accent-3 |
| Body / lead | Space Grotesk | 16–20px | 400 | — | line-height 1.5–1.6 |
| Buttons | Space Grotesk | 12–16px | 700 | — | uppercase, letter-spacing 0.03–0.08em |
| Date numerals | Anton | 32–40px | 400 | — | line-height 0.85 |

### Spacing, Radius, Shadow
- **Content max-widths:** 1240px (nav, hero, media, merch, footer), 1100px (shows, about, mailing list). Centered, `padding: … 28px`.
- **Section vertical padding:** ~40–70px top, 50–60px bottom.
- **Border radius:** pills/buttons `999px`; cards/tiles `12–18px`; CTA block `24px`; inputs `12px`.
- **Shadows:** soft accent glow on primary buttons `0 14px 40px -14px <accent>`; subtle card lift on hover `translateY(-2px to -4px)`.
- **Hairlines:** `1px solid oklch(0.95 0.015 80 / 0.1)`.

---

## Screens / Views

This is a **single-page** layout. Each section below is a block in the scroll. Smooth-scroll anchor navigation between them (`html { scroll-behavior: smooth }`, `section { scroll-margin-top: 88px }` to clear the sticky nav).

### 0. Page chrome / background (global)
- Background: radial gradient `radial-gradient(120% 80% at 50% -10%, oklch(0.27 0.06 45) 0%, oklch(0.16 0.018 45) 55%)` over the base color.
- **Three animated decorative blobs** (radial-gradient circles, blurred 40–60px, opacity 0.3–0.5, in the three accent colors) drifting slowly (`@keyframes` translate+scale, 18–26s loops). Pointer-events none, `z-index: 0`.
- **Film-grain overlay** (toggleable, default ON): fixed full-screen SVG `feTurbulence` noise, `opacity: 0.07`, `mix-blend-mode: overlay`, `z-index: 60`, pointer-events none.
- Content sits at `z-index: 10`; nav at `z-index: 50`.

### 1. Navigation (sticky header)
- **Layout:** sticky top, `backdrop-filter: blur(14px)`, background `oklch(0.16 0.018 45 / 0.72)`, bottom hairline. Inner row max-width 1240px, `padding: 14px 28px`, flex space-between.
- **Left:** logo wordmark "Orange Whip" — Cooper Hewitt 600 italic, 28px, accent color, with `text-shadow: 0 2px 0 oklch(0.16 0.018 45)`. Links to `#top`.
- **Right (desktop, ≥761px):** horizontal links, gap 30px — **Shows** (`#shows`), **Media** (`#media`), **Merch** (`#merch`), **About** (`#about`). Space Grotesk 600, 14px, uppercase, letter-spacing 0.06em, color = `--text`.
  - **There is NO "Tickets" button in the nav** (it was intentionally removed).
- **Mobile (≤760px):** links hidden; show a hamburger button (`☰`, 1px bordered, radius 10px). Tapping toggles a vertical dropdown panel of the same four links (each `padding: 12px 0`, uppercase); tapping a link closes the menu.

### 2. Hero
- **Layout:** centered column, max-width 1240px, `padding: 70px 28px 40px`. `position: relative; z-index: 10`.
- **Background image (admin-configurable):** a **full-bleed photo layer** behind the hero — `position: absolute; top:0; left:0; right:0; height: min(105vh, 940px); z-index: 1; overflow: hidden`. Contains an `<img>` (`width/height 100%`, `object-fit: cover`) plus a **legibility gradient overlay** on top: `linear-gradient(180deg, oklch(0.16 0.018 45 / 0.45) 0%, oklch(0.16 0.018 45 / 0.62) 55%, oklch(0.16 0.018 45) 100%)` — fades the photo into the page background at the bottom.
  - Default image: `assets/surfer0b.png` (included). **When the admin field is empty, hide this layer** and fall back to the animated gradient/blobs.
  - The image sits *behind* the hero text (text is `z-index: 10`, image layer `z-index: 1`).
- **Spinning sun:** behind the wordmark, a large conic-gradient disc (accent→accent-3→accent-2), opacity 0.16, blurred, slowly rotating (`@keyframes spin 60s linear`), `z-index: -1` within the hero.
- **Eyebrow pill:** centered. White-on-glass pill (`oklch(0.95 0.015 80 / 0.07)` bg, 1px border, radius 999px, `padding: 8px 16px`). Contains a glowing gold dot (`--accent-3`, 8px, box-shadow glow) + text "Vancouver, BC · Surf-Psych Rock" (13px, 600, uppercase, letter-spacing 0.08em).
- **Wordmark H1:** "Orange<br>Whip" — Cooper Hewitt 600 italic, `clamp(64px,14vw,210px)`, line-height 0.92, color `--accent`, centered, with layered drop shadow: `text-shadow: 0.035em 0.045em 0 oklch(0.14 0.02 45), 0.06em 0.08em 0 oklch(0.14 0.02 45 / 0.5)`.
- **Lead paragraph:** centered, max-width 560px, `clamp(16px,2.2vw,20px)`, color `oklch(0.86 0.02 80)`. Copy: *"Reverb-drenched riffs and sunburnt melodies from the Pacific Northwest. Catch the wave live this summer."*
- **CTA buttons (row, centered, gap 14px, wrap):**
  - **Primary** — label **admin-configurable**, default **"Listen Now"**. Solid orange (`--accent` bg, `--on-accent` text), 700, 16px, uppercase, pill, `padding: 16px 32px`, glow shadow. Links to `#media`. Hover: `translateY(-2px) scale(1.02)`.
  - **Secondary** — label **admin-configurable**, default **"Shop Merch"**. Transparent with 1.5px white-30% border, `--text` text, same sizing. Links to `#merch`. Hover: border → `--accent-3`, `translateY(-2px)`.
- **Next-show ribbon:** below CTAs, max-width 760px, glass card (white @ 5% bg, 1px border, radius 18px, `padding: 18px 22px`, backdrop-blur). Left: big Anton date (month in `--accent-3`, day in white) + "NEXT SHOW" label + venue (700, 18px) + city (dim, 14px). Right: pill button "ALL DATES" → `#shows` (hover fills orange).

### 3. Marquee strip
- Full-width band, top & bottom hairlines, **solid `--accent` (orange) background**, `padding: 14px 0`, `overflow: hidden`. Margin `50px 0`.
- A horizontally scrolling track (`@keyframes` translateX 0 → -50%, 26s linear, infinite), content duplicated so it loops seamlessly.
- Items: Anton 24px, uppercase, color `--on-accent` (near-black), separated by `✦` glyphs at 40% opacity. Copy: *"New single \"Sundowner\" out now"*, *"Summer tour on sale"*, *"Merch restocked"* (repeated).

### 4. Show Dates  (`#shows`)
- **Heading:** "Show<br>Dates" — Anton, `clamp(40px,7vw,84px)`, uppercase, line-height 0.92. "Dates" in `--accent`. *(Note: this section is titled "Show Dates", not "Tour Dates".)*
- Beside heading: a dim helper paragraph (max-width 340px, 15px): *"Doors usually 8pm. Grab tickets early — most rooms are small and these go fast."*
- **List:** rounded container (radius 18px, 1px border, overflow hidden), rows separated by 2px gaps. Each **row** is a grid `grid-template-columns: 96px 1fr auto`, `align-items: center`, gap 20px, `padding: 20px 24px`, background white @ 3.5% (hover → white @ 7%):
  - **Col 1 — date:** Anton, month (15px, letter-spacing 0.1em, `--accent-3`) over day (32px, white), line-height 0.85.
  - **Col 2 — venue/city:** venue (700, 18px) + city/note (dim, 14px). Note (e.g. support act, "EP release") appended after `·`.
  - **Col 3 — button:** **every row shows an identical orange "Details" button** — `--accent` bg, `--on-accent` text, 700, 12.5px, uppercase, letter-spacing 0.08em, pill, `padding: 11px 18px`, `white-space: nowrap`. (Earlier variants had Tickets/Free/Sold-Out states; these were unified to a single orange **Details** button.)
- **Sample data (6 shows):** Jul 03 The Cobalt, Vancouver BC · Jul 18 Rickshaw Theatre, Vancouver BC (w/ The Tides) · Aug 02 Lucky Bar, Victoria BC · Aug 15 Habitat, Kelowna BC · Sep 05 Biltmore Cabaret, Vancouver BC (EP release) · Sep 20 The Pearl, Vancouver BC. Replace with real/CMS data.

### 5. Media  (`#media`)
Section heading "Media" (Anton). Three labeled sub-blocks, each introduced by an **eyebrow label** (Space Grotesk 700, 13px, uppercase, letter-spacing 0.16em, `--accent-3`) followed by a hairline rule that fills remaining width.

**5a. Listen** — grid `minmax(0,300px) 1fr`, gap 32px:
- **Left:** square album-art tile (placeholder; 1:1, radius 16px, diagonal hatch placeholder bg, 1px border). Below it: album title **"Crème De La Mer"** (Cooper Hewitt 600 italic, 22px, `--accent`) + "2026 · Self-released" (dim, 14px).
  - **Streaming buttons:** a **single horizontal row** (`display: flex; gap: 8px`), **three equal-width buttons** (`flex: 1 1 0; min-width: 0`), evenly spaced: **Spotify** (orange — `--accent` bg, `--on-accent` text), **Youtube** and **Soundcloud** (glass — white @ 8% bg, white text, 1px border). All: 700, 12px, uppercase, `padding: 11px 8px`, radius 11px, centered.
- **Right:** tracklist — rows with Anton track number (`--accent-3`/dim), an orange ▶ glyph, title (600, 16px), and right-aligned tabular duration. Rows divided by bottom hairlines, hover white @ 3%. Sample tracks: 01 Sundowner 3:24 · 02 Riptide Radio 2:58 · 03 Saltwater Sunday 4:11 · 04 Neon Undertow 3:46 · 05 Last Good Wave 5:02.

**5b. Watch** — grid `repeat(auto-fill, minmax(300px, 1fr))`, gap 20px. Each **video card:** 16:9 thumbnail (placeholder, radius 14px, 1px border, hover border → accent) with a centered circular play button (54px, dark glass, 1.5px white-70% border, ▶) and a bottom-right duration chip (dark glass, radius 7px). Below: title (700, 16px) + meta (dim, 13px). Samples: "Sundowner (Official Video)" 3:24 · "Live at The Cobalt" 4:02 · "Studio Session: Riptide Radio" 5:18.

**5c. Photos** — grid `repeat(auto-fill, minmax(180px, 1fr))`, gap 14px. Uniform **square** tiles (1:1, radius 12px, 1px border, hatch placeholder, hover `scale(1.02)` + accent border). 6 placeholders: live shot, band portrait, crowd, backstage, on tour, soundcheck.
- Below grid: a text link "See all media →" (`--accent`, 700, 14px, uppercase) pointing to the full `/media` page.

### 6. Merch  (`#merch`)
- Header row: "Merch" (Anton) + right-aligned link "Visit full store →" (`--accent`).
- Grid `repeat(auto-fill, minmax(220px, 1fr))`, gap 22px. Each **product card** (anchor): square image tile (1:1, radius 16px, hatch placeholder, 1px border; hover `translateY(-4px)` + accent border) with an optional top-left tag pill (`--accent-3` bg, near-black text, e.g. "New", "Vinyl", "Limited"). Below tile: name (700, 16px) + price (Anton, 18px, `--accent`), space-between.
- Samples: Tour Tee '26 $30 (New) · Sundowner LP $28 (Vinyl) · Surf Cap $25 · Gig Poster $15 (Limited).

### 7. About  (`#about`)
- Grid `1fr minmax(0,420px)`, gap 40px, align-items center.
- **Left:** heading "The<br>Band" (Anton; "Band" in `--accent`). Two paragraphs (18px then 16px, max-width 48ch). Copy:
  - *"Orange Whip started in a damp East Van practice space chasing one thing: the sound of the last good wave before the fog rolls in. Equal parts surf twang, fuzz-pedal psych, and late-night garage swagger."*
  - *"Four records, a hundred sweaty rooms, and zero plans to slow down. Bring earplugs."*
  - Two outline pill links: "Press Kit", "Booking" (hover border → accent).
- **Right:** 4:5 portrait placeholder tile (radius 18px, hatch, 1px border).

### 8. Mailing List
- Centered card, max-width 1100px, radius 24px, `padding: clamp(32px,5vw,60px)`, **background `linear-gradient(135deg, var(--accent), var(--accent-2))`** (warm orange→red). Text is near-black on the gradient.
- Heading "Don't miss a show" (Anton, `clamp(32px,5.5vw,60px)`, near-black). Sub: *"Tour dates, new music, and first dibs on tickets — straight to your inbox."*
- **Form:** email input (dark fill `oklch(0.16 0.02 45 / 0.92)`, radius 12px, `padding: 16px 18px`) + "Sign Up" button (near-black bg, off-white text, 700, radius 12px). On submit: replace form with confirmation "You're on the list ✦ See you out there" (Anton, near-black).

### 9. Footer
- Max-width 1240px, top hairline, `padding-top: 34px`.
- Left: "Orange Whip" wordmark (Cooper Hewitt 600 italic, 32px, `--accent`).
- Right: social text links (Instagram, YouTube, TikTok, Spotify) — 600, 14px, uppercase, dim; hover → accent.
- Below: copyright line (13px, dimmer): "© 2026 Orange Whip · Vancouver, BC · Booking: hello@orangewhip.surf".

---

## Interactions & Behavior
- **Smooth-scroll** anchor nav between sections; sticky header with `scroll-margin-top: 88px` on sections.
- **Mobile menu:** hamburger toggles a dropdown; selecting a link closes it. Breakpoint **760px** (≤760 = mobile, ≥761 = desktop).
- **Marquee:** infinite horizontal auto-scroll (26s), content duplicated for a seamless loop.
- **Background blobs:** continuous slow drift (translate+scale, 18–26s); **spinning sun** rotates 60s. **Respect `prefers-reduced-motion`** — disable these in the codebase.
- **Hovers:** buttons lift (`translateY`) and/or gain glow/border-accent; cards lift and gain accent borders; nav/footer links shift to accent color. Transitions ~0.15–0.2s.
- **Mailing-list form:** prevent default submit, validate a non-empty email, then swap to the confirmation message. Wire to the real mailing-list provider in the codebase.
- **Hero image legibility:** the gradient overlay guarantees text contrast over any photo, bright or dark — keep it regardless of the chosen image.

## State Management
Minimal client state:
- `menuOpen` (boolean) — mobile nav dropdown.
- `email` (string) + `sent` (boolean) — mailing-list form.
- Theme/`palette` (enum: Sunset | Acid Surf | Magenta Haze) — drives the three accent vars. Default **Sunset**. Implement as CSS custom properties on a root wrapper so a single switch re-themes everything.
- `showGrain` (boolean) — film-grain overlay on/off. Default **on**.

Data the page renders (move to CMS/API): shows[], tracks[], videos[], photos[], merch[]. Shapes are evident from the samples above.

## Admin-Configurable Fields
The current site already exposes admin settings; bind these design hooks to it:
- **Hero background image** — image URL/upload. Empty → fall back to animated gradient hero.
- **Primary CTA label** (default "Listen Now") and its link target (default `#media`).
- **Secondary CTA label** (default "Shop Merch") and its link target (default `#merch`).
- (Recommended to also expose) palette preset and grain toggle, shows/media/merch collections.

## Assets
- `assets/surfer0b.png` — the default hero background photo (surfer in a wave at sunset, supplied by the client). Square (~2048²). **Note:** this particular file has the band name baked into the image on the lower-right; the client accepted it as-is for now. For production, prefer a clean (text-free) hero photo so it doesn't compete with the site's own wordmark. Served via the admin's hero-image field.
- All other imagery (album art, video thumbnails, photo gallery, merch shots, band portrait) are **labeled placeholders** in the prototype — replace with real assets/CMS media.
- Fonts: Cooper Hewitt (Fontsource/self-host), Anton + Space Grotesk (Google Fonts). Anton is also used as a fallback display face; the brand face is Cooper Hewitt SemiBold Italic.

## Files
- `Orange Whip Home.dc.html` — the full homepage design reference (open in a browser to view the live prototype; ignore the `support.js` templating internals).
- `assets/surfer0b.png` — default hero image.

## Screenshots
High-fidelity renders of each section (desktop, ~924px wide) are in `screenshots/`:
- `01-desktop.png` — Nav + Hero (full-bleed surf photo, wordmark, eyebrow pill, CTAs)
- `02-desktop.png` — Show Dates (date rows + orange "Details" buttons)
- `03-desktop.png` — Media › Listen (Crème De La Mer album + tracklist; Spotify/Youtube/Soundcloud button row below the art)
- `04-desktop.png` — Media › Watch (video cards)
- `05-desktop.png` — Media › Photos (square gallery grid)
- `06-desktop.png` — Merch (product grid with tag pills)
- `07-desktop.png` — About (band bio + portrait)
- `08-desktop.png` — Mailing list (gradient CTA) + Footer

