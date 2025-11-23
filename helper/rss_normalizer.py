
#!/usr/bin/env python3
"""
RSS/Atom normalizer for event-like posts.

Inputs: One or more feed URLs.
Output: JSON array with fields:
  - title
  - date (ISO8601 in America/Vancouver)
  - description (plain text; first 1–2 paragraphs)
  - media: list[{type: image|video, url, caption?}]
  - source (domain)
  - link (canonical article URL)

Usage examples:
  python rss_normalizer.py \
    --feeds https://www.vancouverisawesome.com/rss/events-and-entertainment https://boredinvancouver.com/feed/ https://www.coastaljazz.ca/blog/feed/ \
    --fetch-articles \
    --max-items 5 \
    --out out.json

  # Just dump to stdout without following article links
  python rss_normalizer.py --feeds https://boredinvancouver.com/feed/
"""
import argparse
import json
import os
import sys
import time
import re
from typing import Optional
from urllib.parse import urlparse, urljoin

import requests
import feedparser
from bs4 import BeautifulSoup
from dateutil import parser as dateparser
from datetime import datetime
from zoneinfo import ZoneInfo

VAN_TZ = ZoneInfo("America/Vancouver")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 "
    "rss-normalizer/1.0 (+https://orangewhip.surf)"
)

def pick_largest_from_srcset(srcset: str) -> Optional[str]:
    """
    Given a srcset string, pick the largest-width candidate URL.
    """
    if not srcset:
        return None
    best = None
    best_width = -1
    for part in srcset.split(","):
        part = part.strip()
        if not part:
            continue
        # pattern: URL [space] Nw
        m = re.match(r"(\S+)\s+(\d+)w", part)
        if m:
            url, w = m.group(1), int(m.group(2))
            if w > best_width:
                best = url
                best_width = w
        else:
            # single URL with no width can be fallback
            if best is None:
                best = part.split()[0]
    return best

def text_first_paragraphs(html: str, max_paragraphs: int = 2) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    paras = [p.get_text(" ", strip=True) for p in soup.find_all(["p", "li"])]
    if not paras:
        # fallback to all text
        txt = soup.get_text(" ", strip=True)
        return txt[:500].strip()
    return "\n\n".join([p for p in paras if p][:max_paragraphs]).strip()

def extract_media_from_html(html: str, base_url: str) -> list[dict]:
    media = []
    if not html:
        return media
    soup = BeautifulSoup(html, "html.parser")

    # Helper to find nearby caption text
    def nearby_caption(node):
        # figcaption if inside figure
        fig = node.find_parent("figure")
        if fig:
            cap = fig.find("figcaption")
            if cap:
                return cap.get_text(" ", strip=True)
        # alt text as last resort for images
        if node.name == "img" and node.get("alt"):
            return node.get("alt")
        return None

    # Images
    for img in soup.find_all("img"):
        src = img.get("src")
        if not src:
            src = img.get("data-src") or img.get("data-original")
        srcset = img.get("srcset")
        if srcset:
            pick = pick_largest_from_srcset(srcset)
            if pick:
                src = pick
        if src:
            url = urljoin(base_url, src)
            media.append({"type": "image", "url": url, "caption": nearby_caption(img)})

    # Video (HTML5)
    for video in soup.find_all("video"):
        src = video.get("src")
        if not src:
            source = video.find("source")
            if source and source.get("src"):
                src = source.get("src")
        if src:
            url = urljoin(base_url, src)
            media.append({"type": "video", "url": url, "caption": nearby_caption(video)})

    # Embedded iframes (YouTube/Vimeo/etc.)
    for iframe in soup.find_all("iframe"):
        src = iframe.get("src")
        if src and src.startswith(("http://", "https://")):
            media.append({"type": "video", "url": src, "caption": nearby_caption(iframe)})

    # Deduplicate by URL while preserving order
    seen = set()
    deduped = []
    for m in media:
        if m["url"] in seen:
            continue
        seen.add(m["url"])
        deduped.append(m)
    return deduped

def fetch_article_html(url: str, timeout: int = 15) -> Optional[str]:
    try:
        resp = requests.get(url, headers={"User-Agent": UA}, timeout=timeout)
        if resp.status_code != 200:
            return None
        return resp.text
    except requests.RequestException:
        return None

def extract_article_body(html: str) -> str:
    """
    Try common article containers; fall back to full document.
    """
    soup = BeautifulSoup(html, "html.parser")
    candidates = [
        ".entry-content",
        "article",
        "main",
        ".article__body",
        ".post-content",
        ".content",
    ]
    for sel in candidates:
        node = soup.select_one(sel)
        if node and node.get_text(strip=True):
            return str(node)
    return str(soup.body or soup)

def normalize_entry(entry, source_domain: str, follow_article: bool, delay: float) -> dict:
    title = entry.get("title", "").strip()
    link = entry.get("link") or ""

    # Date candidates
    date_val = entry.get("published") or entry.get("updated") or entry.get("created") or ""
    date_iso = None
    if date_val:
        try:
            dt = dateparser.parse(date_val)
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=ZoneInfo("UTC"))
            dt = dt.astimezone(VAN_TZ)
            date_iso = dt.isoformat()
        except Exception:
            date_iso = None

    # Content html from feed (content:encoded -> entry.content[0].value)
    content_html = ""
    if entry.get("content"):
        try:
            content_html = entry.content[0].value
        except Exception:
            pass
    if not content_html:
        content_html = entry.get("summary", "")

    description = text_first_paragraphs(content_html, 2)
    media = extract_media_from_html(content_html, base_url=link or f"https://{source_domain}")

    # Fall back to article scrape when requested and media missing
    if follow_article and (not media):
        if link:
            time.sleep(delay)
            article_html = fetch_article_html(link)
            if article_html:
                body_html = extract_article_body(article_html)
                # Prefer a fresher description if original was empty/short
                if len(description) < 40:
                    candidate_desc = text_first_paragraphs(body_html, 2)
                    if candidate_desc:
                        description = candidate_desc
                media = extract_media_from_html(body_html, base_url=link)

    # Keep just first 3 media items to avoid overload
    media = media[:3]

    out = {
        "title": title,
        "date": date_iso,
        "description": description,
        "media": media,
        "source": source_domain,
        "link": link,
    }
    return out

def parse_feed(url: str, follow_article: bool, max_items: int, delay: float) -> list[dict]:
    fp = feedparser.parse(url)
    source = urlparse(url).netloc
    results = []
    for entry in fp.entries[:max_items]:
        item = normalize_entry(entry, source_domain=source, follow_article=follow_article, delay=delay)
        # Deduplicate by link/title combo
        key = (item["link"], item["title"])
        if key not in {(r["link"], r["title"]) for r in results}:
            results.append(item)
    return results

def push_to_sanity(items: list[dict], *, project_id: str, dataset: str, token: str, doc_prefix: str, doc_datetime: datetime) -> tuple[str, int]:
    """
    Create or replace a Sanity document with the normalized items.
    """
    if not project_id or not dataset or not token:
        raise RuntimeError("Missing Sanity configuration.")

    slug_value = f"{doc_prefix}-{doc_datetime.date().isoformat()}"
    doc_id = slug_value
    generated_at = datetime.now(VAN_TZ)

    payload_items = []
    for item in items:
        media_payload = []
        for media in item.get("media", []):
            media_payload.append(
                {
                    "_type": "dailyMedia",
                    "kind": media.get("type"),
                    "url": media.get("url"),
                    "caption": media.get("caption"),
                }
            )

        entry = {
            "_type": "dailyItem",
            "title": item.get("title"),
            "description": item.get("description"),
            "link": item.get("link"),
            "source": item.get("source"),
            "publishedAt": item.get("date"),
        }
        if media_payload:
            entry["media"] = media_payload

        payload_items.append(entry)

    document = {
        "_id": doc_id,
        "_type": "daily",
        "title": f"Daily Roundup — {doc_datetime.date().isoformat()}",
        "slug": {"_type": "slug", "current": slug_value},
        "date": doc_datetime.isoformat(),
        "generatedAt": generated_at.isoformat(),
        "items": payload_items,
    }

    mutate_url = f"https://{project_id}.api.sanity.io/v2024-01-01/data/mutate/{dataset}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {"mutations": [{"createOrReplace": document}]}

    try:
        response = requests.post(mutate_url, headers=headers, json=body, timeout=30)
    except requests.RequestException as exc:
        raise RuntimeError(f"Sanity request failed: {exc}") from exc

    if not response.ok:
        raise RuntimeError(f"Sanity mutation failed: {response.status_code} {response.text}")

    return doc_id, len(payload_items)

def main():
    parser = argparse.ArgumentParser(description="Normalize RSS/Atom feeds into event-like JSON.")
    parser.add_argument("--feeds", nargs="+", required=False, help="One or more feed URLs.")
    parser.add_argument("--fetch-articles", action="store_true", help="Follow article links to extract inline media if feed lacks it.")
    parser.add_argument("--max-items", type=int, default=50, help="Max entries per feed to process.")
    parser.add_argument("--delay", type=float, default=0.8, help="Delay (seconds) between article fetches when scraping.")
    parser.add_argument("--out", type=str, default=None, help="Write JSON to this file instead of stdout.")
    parser.add_argument("--push-sanity", action="store_true", help="Create or replace a Sanity document with the normalized output.")
    parser.add_argument("--sanity-project-id", type=str, help="Sanity project ID (falls back to SANITY_PROJECT_ID env).")
    parser.add_argument("--sanity-dataset", type=str, help="Sanity dataset (falls back to SANITY_DATASET env or defaults to 'production').")
    parser.add_argument("--sanity-token", type=str, help="Sanity API token (falls back to SANITY_TOKEN env).")
    parser.add_argument("--sanity-doc-prefix", type=str, default="daily", help="Prefix for the Sanity document ID/slug (default: daily).")
    parser.add_argument("--sanity-date", type=str, help="Override ISO date (YYYY-MM-DD or ISO datetime) for the Sanity document.")
    args = parser.parse_args()

    default_feeds = [
        "https://www.vancouverisawesome.com/rss",
        "https://boredinvancouver.com/feed/",
        "https://www.coastaljazz.ca/blog/feed/",
    ]
    feeds = args.feeds or default_feeds

    all_items = []
    seen = set()
    for url in feeds:
        items = parse_feed(url, follow_article=args.fetch_articles, max_items=args.max_items, delay=args.delay)
        for it in items:
            key = (it["link"], it["title"])
            if key in seen:
                continue
            seen.add(key)
            all_items.append(it)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(all_items, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(all_items)} items to {args.out}")
    else:
        json.dump(all_items, sys.stdout, ensure_ascii=False, indent=2)

    if args.push_sanity:
        sanity_project = args.sanity_project_id or os.environ.get("SANITY_PROJECT_ID")
        sanity_dataset = args.sanity_dataset or os.environ.get("SANITY_DATASET") or "production"
        sanity_token = args.sanity_token or os.environ.get("SANITY_TOKEN")

        if not sanity_project or not sanity_token:
            print("Missing Sanity project ID/token for --push-sanity.", file=sys.stderr)
            sys.exit(1)

        if args.sanity_date:
            try:
                doc_datetime = datetime.fromisoformat(args.sanity_date)
            except ValueError as exc:
                print(f"Invalid --sanity-date value: {exc}", file=sys.stderr)
                sys.exit(1)
            if doc_datetime.tzinfo is None:
                doc_datetime = doc_datetime.replace(tzinfo=VAN_TZ)
            else:
                doc_datetime = doc_datetime.astimezone(VAN_TZ)
        else:
            doc_datetime = datetime.now(VAN_TZ)

        try:
            doc_id, item_count = push_to_sanity(
                all_items,
                project_id=sanity_project,
                dataset=sanity_dataset,
                token=sanity_token,
                doc_prefix=args.sanity_doc_prefix,
                doc_datetime=doc_datetime,
            )
        except RuntimeError as exc:
            print(str(exc), file=sys.stderr)
            sys.exit(1)

        print(f"Pushed {item_count} items to Sanity document '{doc_id}'.")

if __name__ == "__main__":
    main()
