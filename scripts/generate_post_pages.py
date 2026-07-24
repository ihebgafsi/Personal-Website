#!/usr/bin/env python3
"""
Generates posts/<slug>.html, one static file per post in data/posts.json,
each carrying real per-post <title>, description, canonical link, and
Open Graph / Twitter Card meta tags, so a link to an individual post
actually renders a title/description/image preview when shared, instead
of the bare post.html template with no per-post information in its head.

Run after adding, editing, or removing a post:

    python3 scripts/generate_post_pages.py

This reads post.html itself as the template (whatever's currently in the
file, including any manual edits), so it always matches the real
template rather than a stale copy baked into this script. It injects a
<base href="../"> tag so every relative path in the template (css/js
links, the data/posts.json fetch, internal nav hrefs) resolves correctly
from one directory down.

Known limitation: OG image previews are only reliably rendered by most
platforms (X/Twitter, Facebook, LinkedIn) when the image is a raster
format (PNG/JPG). The site's post thumbnails are currently hand-drawn
SVGs, some crawlers (Slack, Discord) will show them fine, others may
silently drop the image and show text-only. If you want guaranteed
image previews everywhere, convert thumbnails to PNG, or point OG image
at a single PNG (e.g. images/profile.jpg, already used as the fallback
here for posts without a thumbnail).
"""
import json
import os
import re
import sys
from html import escape

SITE_URL = "https://ihebgafsi.tn"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OG_IMAGE = f"{SITE_URL}/images/profile.jpg"


def build_meta_block(post):
    slug = post["slug"]
    title = post["title"]
    summary = post.get("summary", "")
    url = f"{SITE_URL}/posts/{slug}.html"
    thumb = post.get("thumbnail")
    image_url = f"{SITE_URL}/{thumb}" if thumb else DEFAULT_OG_IMAGE

    return f"""<title>{escape(title)} \u00b7 Iheb Gafsi</title>
<meta name="description" content="{escape(summary)}">
<link rel="canonical" href="{url}">
<meta name="post-slug" content="{escape(slug)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{escape(title)}">
<meta property="og:description" content="{escape(summary)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image_url}">
<meta property="og:site_name" content="Iheb Gafsi">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(title)}">
<meta name="twitter:description" content="{escape(summary)}">
<meta name="twitter:image" content="{image_url}">
<base href="../">"""


def main():
    template_path = os.path.join(ROOT, "post.html")
    with open(template_path, encoding="utf-8") as f:
        template = f.read()

    # strip whatever <title> is currently in post.html, each generated
    # page gets its own via build_meta_block above
    template_no_title = re.sub(r"<title>.*?</title>\s*", "", template, count=1, flags=re.S)

    posts_path = os.path.join(ROOT, "data", "posts.json")
    with open(posts_path, encoding="utf-8") as f:
        data = json.load(f)
    posts = data.get("posts", [])

    out_dir = os.path.join(ROOT, "posts")
    os.makedirs(out_dir, exist_ok=True)

    written = 0
    for post in posts:
        meta_block = build_meta_block(post)
        page, count = re.subn(
            r'(<meta charset="utf-8">\s*)',
            r"\1" + meta_block.replace("\\", "\\\\") + "\n",
            template_no_title,
            count=1,
        )
        if count == 0:
            print(f"warning: could not find <meta charset> anchor for {post['slug']}, skipped", file=sys.stderr)
            continue
        out_path = os.path.join(out_dir, f"{post['slug']}.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(page)
        written += 1

    print(f"wrote {written} file(s) to {out_dir}")


if __name__ == "__main__":
    sys.exit(main())
