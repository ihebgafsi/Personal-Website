#!/usr/bin/env python3
"""
Regenerates feed.xml from data/posts.json.

Run this after adding, editing, or removing a post:

    python3 scripts/generate_feed.py

There's no build step or CI hook doing this automatically, run it by
hand and commit the updated feed.xml alongside your posts.json change.
"""
import json
import os
import sys
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

SITE_URL = "https://ihebgafsi.tn"
SITE_TITLE = "Iheb Gafsi"
SITE_DESCRIPTION = "Notes on geometric deep learning, representation learning, and applied research."

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def parse_post_date(date_str):
    """Posts store dates as 'YYYY.MM', month precision only. RSS needs a
    full timestamp, so this uses the 1st of that month at midnight UTC.
    Feed item ordering (most recent first) still comes from posts.json's
    own array order, not from this timestamp, so month-level precision
    here doesn't affect what order readers see items in."""
    try:
        year, month = date_str.split(".")
        return datetime(int(year), int(month), 1, tzinfo=timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def main():
    posts_path = os.path.join(ROOT, "data", "posts.json")
    with open(posts_path, encoding="utf-8") as f:
        data = json.load(f)
    posts = data.get("posts", [])

    now = datetime.now(timezone.utc)

    items = []
    for post in posts:
        link = f"{SITE_URL}/post.html?slug={post['slug']}"
        pub_date = format_datetime(parse_post_date(post.get("date", "")))
        items.append(f"""    <item>
      <title>{escape(post['title'])}</title>
      <link>{escape(link)}</link>
      <guid isPermaLink="false">{escape(post['slug'])}</guid>
      <pubDate>{pub_date}</pubDate>
      <description>{escape(post.get('summary', ''))}</description>
    </item>""")

    feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>{escape(SITE_TITLE)}</title>
    <link>{escape(SITE_URL)}</link>
    <description>{escape(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>{format_datetime(now)}</lastBuildDate>
{chr(10).join(items)}
  </channel>
</rss>
"""

    out_path = os.path.join(ROOT, "feed.xml")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(feed)

    print(f"wrote {out_path} with {len(posts)} item(s)")


if __name__ == "__main__":
    sys.exit(main())
