#!/usr/bin/env python3
"""
Regenerates sitemap.xml from data/posts.json plus the site's static
pages. Run after adding, editing, or removing a post, same convention
as scripts/generate_feed.py:

    python3 scripts/generate_sitemap.py

Lists each post at its static posts/<slug>.html URL (see
scripts/generate_post_pages.py), since that's the canonical, indexable
address for an individual post now, not post.html?slug=...
"""
import json
import os
import sys
from datetime import datetime, timezone

SITE_URL = "https://ihebgafsi.tn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_PAGES = ["", "research.html", "publications.html", "background.html", "blog.html"]


def main():
    posts_path = os.path.join(ROOT, "data", "posts.json")
    with open(posts_path, encoding="utf-8") as f:
        data = json.load(f)
    posts = data.get("posts", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    urls = []
    for page in STATIC_PAGES:
        urls.append(f"""  <url>
    <loc>{SITE_URL}/{page}</loc>
    <lastmod>{today}</lastmod>
  </url>""")

    for post in posts:
        urls.append(f"""  <url>
    <loc>{SITE_URL}/posts/{post['slug']}.html</loc>
    <lastmod>{today}</lastmod>
  </url>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>
"""
    out_path = os.path.join(ROOT, "sitemap.xml")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(xml)

    print(f"wrote {out_path} with {len(urls)} url(s)")


if __name__ == "__main__":
    sys.exit(main())
