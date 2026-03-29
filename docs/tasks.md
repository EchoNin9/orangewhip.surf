# orangewhip.surf — Task Log

Tracks completed and pending UI/backend improvement tasks.

---

## Completed

### Session: 2026-03-28

#### 1. Homepage UX — Reorder, Performance, Skeletons ✅
**Commit:** `00e5c2f` — `ui: reorder homepage sections, improve performance and loading UX`

- Moved Upcoming Shows section above Latest News on homepage
- Replaced 3 sequential `await` API calls with `Promise.allSettled` (parallel) — ~200–600ms faster
- Replaced spinner with skeleton loading cards matching real content layout
- Converted all routes except `HomePage` to `React.lazy()` — reduces initial JS bundle
- Moved Google Fonts from CSS `@import` (render-blocking) to HTML `<link rel="preconnect">` + `<link rel="stylesheet">`
- Added `loading="lazy"` to below-fold images
- Extracted shared animation presets into `src/utils/motion.ts` (`stagger`, `fadeUp`, `viewportOnce`, `EASE_OUT`)

---

#### 2. WebP Image Optimization ✅
**Commit:** `e6b7f21` — `feat: add WebP image optimization with medium-size variants`

- **Thumb Lambda** (`src/lambda/thumb/handler.py`): generates WebP thumbnail (300px) and WebP medium (800px) in addition to existing JPEG thumbnail; stores keys `thumbnailWebpKey` / `mediumWebpKey` in DynamoDB
- **API Lambda** (`src/lambda/api/handler.py`): presigns `thumbnailWebp` and `mediumUrl` URLs and returns them in media/show/update responses
- **Frontend**: new `OptimizedImg` component (`src/utils/OptimizedImg.tsx`) renders `<picture>` with WebP `<source>` + JPEG fallback; applied to shows, media, updates, and homepage

---

#### 3. Cache-Control Headers ✅
**Commit:** `ccd51b0` — `feat: add Cache-Control headers to API GET responses`

- Extended `response.py` `ok()` with a `cache` parameter
- All public GET endpoints set `Cache-Control: public, max-age=N, stale-while-revalidate=N`
- Private/write endpoints set `Cache-Control: no-store`
- Homepage batch endpoint cached for 120s

---

#### 4. Homepage Batch Endpoint + Pagination ✅
**Commits:** `19f4706` + `9726a25`

- New `/homepage` API endpoint returns branding, pinned update, and 3 upcoming shows in a single request (3 DynamoDB queries instead of 3 round-trips)
- Backwards-compatible pagination on `/media`, `/updates`, `/press`: returns raw array when no `limit` param; returns `{items, total, limit, offset}` envelope when `limit` provided
- Frontend `HomePage` tries `/homepage` first; falls back to 3 parallel calls if endpoint unavailable

---

#### 5. Deploy Backend (Lambda) ✅
**Commit:** `9726a25` — all prior commits already on `origin/develop`

- Confirmed all 5 commits deployed successfully to staging via GitHub Actions (`Deploy Staging` workflow)
- `/homepage` endpoint, WebP generation, caching headers, and pagination all live on staging

---

#### 6. UI Polish — Page Transitions, Grain, Hover Effects ✅
**Commit:** `9472d41` — `ui: add page transitions, grain texture, enhanced card hovers and gradient dividers`

- **Page transitions**: new `PageTransition` component wraps routes; `AnimatePresence mode="wait"` in `AppLayout` for smooth fade+slide between pages
- **Grain texture**: SVG `fractalNoise` overlay at 3% opacity on hero section for atmospheric depth
- **Radial gradient overlays**: dual warm-orange radial gradients on hero for depth
- **Glassmorphism secondary button**: hero secondary CTA uses `bg-white/5 backdrop-blur-sm` with hover lift
- **Card hover effects**: lift (`-translate-y-0.5`) + shadow (`shadow-primary-500/5`) + border glow on all cards (homepage shows, news card, empty-state nav cards, ShowsPage cards)
- **Image zoom on hover**: show thumbnails scale up `scale-105` on hover
- **Animated arrow links**: "View All Shows →" arrow translates right on hover
- **Gradient dividers**: replaced solid `border-t border-secondary-800` with `from-transparent via-secondary-700 to-transparent` gradient lines on homepage and footer
- **Footer**: gradient separators, cleaner inner-border treatment
- **motion.ts**: added `scaleIn`, `fadeUpStaggered` variants and exported `GRAIN_SVG` constant for reuse across pages

---

#### 7. Re-process Existing Images for WebP Thumbnails ✅
**Script:** `scripts/backfill-webp-thumbs.sh`

- Created backfill script that scans DynamoDB for `MEDIA#` items missing `thumbnailWebpKey`
- Invokes `ows-thumb` Lambda async (`InvocationType=Event`) for each item with direct invocation payload
- Supports dry-run mode (default) and `--execute` flag
- Results: 13 images processed, all now have `thumbnailWebpKey` + `mediumWebpKey` (1 small image under 800px got thumb only, no medium — expected)

---

### Session: 2026-03-29

#### 8. Fix Video Thumbnail Generation (ffmpeg) ✅
**Commit:** `188f773` — `fix: replace MediaConvert with ffmpeg for video thumbnails`

**Root cause diagnosed:** MediaConvert was rejecting every video thumbnail job with:
> `BadRequestException: The only outputs in your job are Frame capture to JPEG. You must include at least one output that has full video.`

All 6 of 7 existing videos had no thumbnail. One had a JPEG from before.

**Fix:**
- Replaced MediaConvert with a statically-linked ffmpeg Lambda layer
- CI builds the layer by downloading ffmpeg amd64 static binary from johnvansickle.com and zipping as `infra/build/ffmpeg_layer.zip`
- New `_generate_video_thumbnail()` in `thumb/handler.py`:
  - Downloads video to `/tmp` via `s3.download_fileobj`
  - Runs `ffmpeg -ss 1 -frames:v 1` to extract a single frame (retries at `ss 0` for very short clips)
  - Uses Pillow to generate JPEG thumb (300px) + WebP thumb (300px)
  - Writes both keys to DynamoDB — fully synchronous, no EventBridge callback needed
- Attached ffmpeg layer to `ows-thumb` Lambda alongside existing Pillow layer in Terraform
- Kept EventBridge rule as no-op for any in-flight MediaConvert events
- Updated `backfill-webp-thumbs.sh` to also process video-type items (not just images)
- Backfilled all 7 existing videos — all now have JPEG + WebP thumbnails confirmed in DynamoDB

---

## Pending / Backlog

### CloudFront for Media Bucket
Images are served via time-limited S3 presigned URLs — no CDN caching. Adding CloudFront in front of the media bucket would provide:
- Persistent, cacheable URLs (no expiry)
- Edge caching for faster global image delivery
- Ability to use signed cookies/policies for private content

### More UI Polish (Additional)
Patterns available from funkedupshift codebase not yet applied:
- Masonry grid layout for MediaPage (CSS `columns-*` with `break-inside-avoid`)
- `whileInView` staggered animations on MediaPage and UpdatesPage grids
- Stat counter animation (`useCountUp` hook with requestAnimationFrame)
- Accordion expand/collapse with smooth height animation in mobile nav
