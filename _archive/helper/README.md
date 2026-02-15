
# RSS Normalizer

A small Python CLI to normalize RSS/Atom feeds into a consistent JSON format focused on event-like posts.

## What it extracts
- title
- date (converted to America/Vancouver in ISO8601 when present)
- description (first 1–2 paragraphs of text)
- media (up to 3 inline assets: images or videos with URLs and optional captions)
- source (domain)
- link (article URL)

## Install
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Usage
```bash
# Default feeds (the three you provided), no article scraping:
python rss_normalizer.py

# Follow article links to extract inline media if the feed doesn't include them (e.g., Vancouver Is Awesome):
python rss_normalizer.py --fetch-articles

# Limit items and write to a file:
python rss_normalizer.py --max-items 30 --out out.json

# Custom feeds:
python rss_normalizer.py --feeds https://example.com/feed.xml https://othersite.com/rss

# Push directly to Sanity (requires env vars or CLI args):
SANITY_PROJECT_ID=yourProject SANITY_TOKEN=yourToken python rss_normalizer.py \
  --fetch-articles \
  --max-items 25 \
  --push-sanity
```

## Notes & Tips
- The `--fetch-articles` option requests each article page when the feed lacks images/videos.
- The scraper is polite: it uses a small delay between requests; adjust with `--delay` if needed.
- If you want more than 3 media assets per item, tweak the `media = media[:3]` line.
- Make sure your downstream renderer sanitizes HTML (we only output text/URLs here).
- Respect each site's Terms of Use and robots.txt.
