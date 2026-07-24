/*
  Reads the JSON files in /data and fills in the containers on each page.
  No build step, no dependencies beyond the CDN libraries loaded in each
  HTML page's <head>: KaTeX everywhere (for math in any JSON-driven text),
  and on post.html additionally marked (markdown), Mermaid (diagrams),
  Plotly (charts), and highlight.js (code blocks).

  Each render function fails quietly into the container with a short
  message if the fetch does not work, most commonly because the page is
  being opened directly as a file:// URL instead of through a server.
*/

async function loadData(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error("failed to load " + path);
  return res.json();
}

function showError(container, path) {
  container.innerHTML =
    '<p class="dim">Could not load ' + path + '. If you are viewing this ' +
    'file directly from disk, serve the folder with a local server instead ' +
    '(for example <code>python3 -m http.server</code>) since browsers block ' +
    'fetch requests from file:// URLs.</p>';
}

/* ---------------------------------------------
   Theme toggle. A tiny inline script in each page's <head> already reads
   localStorage and sets data-theme="dark" on <html> before first paint,
   so there is no flash of the wrong theme. This function wires up the
   visible switch, keeps aria-pressed in sync, and re-syncs the
   highlight.js stylesheet (the one thing that can't just react to a CSS
   variable change) whenever the theme flips.
--------------------------------------------- */

function initThemeToggle(buttonId) {
  const btn = document.getElementById(buttonId || "themeToggle");
  if (!btn) return;
  const root = document.documentElement;

  function sync() {
    const isDark = root.getAttribute("data-theme") === "dark";
    btn.setAttribute("aria-pressed", isDark ? "true" : "false");
  }
  sync();

  btn.addEventListener("click", function () {
    const isDark = root.getAttribute("data-theme") === "dark";
    if (isDark) {
      root.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    } else {
      root.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
    sync();
    syncHljsTheme();
  });
}

/* highlight.js bakes colors into inline styles at highlight time, it
   can't react to a CSS variable flip on its own. Both light and dark
   stylesheets are loaded once (see renderPost), and this just flips
   which one is disabled, so a toggle mid-read updates code blocks
   immediately instead of only on next reload. */
function syncHljsTheme() {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  const lightEl = document.getElementById("hljs-light");
  const darkEl = document.getElementById("hljs-dark");
  if (lightEl) lightEl.disabled = dark;
  if (darkEl) darkEl.disabled = !dark;
}

/* ---------------------------------------------
   Back to top. Fades in once the page has scrolled a bit, hidden and
   inert otherwise so it's never in the way or reachable by keyboard nav
   when invisible.
--------------------------------------------- */

function initBackToTop(buttonId) {
  const btn = document.getElementById(buttonId || "backToTop");
  if (!btn) return;

  function sync() {
    btn.classList.toggle("visible", window.scrollY > 480);
  }
  window.addEventListener("scroll", sync, { passive: true });
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  sync();
}

/* ---------------------------------------------
   Shared enhancement passes. Called after any
   container is filled with HTML, in this order:
   markdown is already applied by the caller,
   then diagrams, then plots, then widgets, then code
   highlighting and copy buttons, then math last (KaTeX
   ignores <pre>/<code> by default).
--------------------------------------------- */

function renderMathIn(el) {
  if (!window.renderMathInElement || !el) return;
  renderMathInElement(el, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false
  });
}

function initMermaid() {
  // Read the page's own CSS variables so diagrams match whichever theme
  // is active when this fires. Mermaid still bakes these into the SVG
  // at render time, a diagram already on screen will not recolor itself
  // if the user toggles theme afterward without a reload, that's a real
  // limitation of how Mermaid renders, not something worth chasing here.
  const css = getComputedStyle(document.documentElement);
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: "14px",
      primaryColor: css.getPropertyValue("--paper").trim(),
      primaryTextColor: css.getPropertyValue("--ink").trim(),
      primaryBorderColor: css.getPropertyValue("--graphite").trim(),
      lineColor: css.getPropertyValue("--graphite").trim(),
      secondaryColor: css.getPropertyValue("--rule").trim(),
      tertiaryColor: css.getPropertyValue("--rule").trim()
    },
    flowchart: { curve: "basis", htmlLabels: true, padding: 16 }
  });
}

function renderMermaidIn(el) {
  if (!window.mermaid || !el) return;
  const blocks = Array.prototype.slice.call(el.querySelectorAll("pre code.language-mermaid"));
  blocks.forEach(function (block, i) {
    const source = block.textContent;
    const holder = document.createElement("div");
    holder.className = "mermaid-diagram";
    block.parentElement.replaceWith(holder);
    const id = "mermaid-" + Date.now() + "-" + i;
    mermaid.render(id, source).then(function (result) {
      holder.innerHTML = result.svg;
    }).catch(function (err) {
      holder.innerHTML = '<p class="dim">Diagram failed to render: ' + err.message + "</p>";
    });
  });
}

function renderPlotsIn(el) {
  if (!window.Plotly || !el) return;
  const blocks = Array.prototype.slice.call(el.querySelectorAll("pre code.language-plot"));
  const css = getComputedStyle(document.documentElement);
  blocks.forEach(function (block) {
    const holder = document.createElement("div");
    holder.className = "plot-container";
    try {
      const spec = JSON.parse(block.textContent);
      block.parentElement.replaceWith(holder);

      // transparent paper/plot background instead of hardcoded white,
      // so a chart blends into either theme without a redraw on toggle
      const layout = Object.assign(
        {
          height: 420,
          margin: { t: 48, r: 24, b: 88, l: 56 },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { family: "IBM Plex Mono, monospace", size: 12, color: css.getPropertyValue("--graphite").trim() },
          legend: { orientation: "h", x: 0, y: -0.22, xanchor: "left", font: { size: 11 } }
        },
        spec.layout || {}
      );
      const config = Object.assign({ responsive: true, displaylogo: false }, spec.config || {});

      Plotly.newPlot(holder, spec.data || [], layout, config);

      window.addEventListener("load", function () {
        Plotly.Plots.resize(holder);
      });
    } catch (err) {
      holder.innerHTML = '<p class="dim">Plot failed to render, invalid JSON in the plot block (' + err.message + ").</p>";
      block.parentElement.replaceWith(holder);
    }
  });
}

/* ---------------------------------------------
   Widgets: a ```widget fenced block containing raw HTML (with inline
   <script> tags) for self-contained interactive demos. innerHTML never
   executes <script> tags it inserts, so after dropping the markup in,
   every <script> inside it is torn out and rebuilt as a fresh element
   and reinserted, which does execute. No CDN dependency, this always
   runs.
--------------------------------------------- */

function renderWidgetsIn(el) {
  if (!el) return;
  const blocks = Array.prototype.slice.call(el.querySelectorAll("pre code.language-widget"));
  blocks.forEach(function (block) {
    const source = block.textContent;
    const holder = document.createElement("div");
    holder.className = "post-widget";
    block.parentElement.replaceWith(holder);
    holder.innerHTML = source;

    const scripts = Array.prototype.slice.call(holder.querySelectorAll("script"));
    scripts.forEach(function (old) {
      const fresh = document.createElement("script");
      Array.prototype.forEach.call(old.attributes, function (attr) {
        fresh.setAttribute(attr.name, attr.value);
      });
      fresh.textContent = old.textContent;
      old.replaceWith(fresh);
    });
  });
}

function highlightCodeIn(el) {
  if (!window.hljs || !el) return;
  el.querySelectorAll("pre code").forEach(function (block) {
    hljs.highlightElement(block);
  });
}

/* Wraps each remaining ordinary code block (mermaid/plot/widget blocks
   are already gone by the time this runs) in a positioned container and
   adds a small "copy" button that copies the raw code text. */
function addCopyButtonsIn(el) {
  if (!el) return;
  Array.prototype.slice.call(el.querySelectorAll("pre")).forEach(function (pre) {
    const code = pre.querySelector("code");
    if (!code) return;
    if (pre.parentElement && pre.parentElement.classList.contains("code-block-wrap")) return;

    const wrap = document.createElement("div");
    wrap.className = "code-block-wrap";
    pre.parentElement.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "copy-btn";
    btn.textContent = "copy";
    btn.addEventListener("click", function () {
      navigator.clipboard.writeText(code.textContent).then(function () {
        btn.textContent = "copied";
        btn.classList.add("copied");
        setTimeout(function () { btn.textContent = "copy"; btn.classList.remove("copied"); }, 1400);
      }).catch(function () {
        btn.textContent = "failed";
        setTimeout(function () { btn.textContent = "copy"; }, 1400);
      });
    });
    wrap.appendChild(btn);
  });
}

/* ---------------------------------------------
   On-demand loading for the heavy per-post libraries. Mermaid and
   Plotly are large (Plotly alone is close to a megabyte minified), and
   most individual posts use neither, so post.html no longer loads them
   unconditionally. Instead, renderPost() below scans the post's raw
   markdown first and only fetches what that specific post needs.
--------------------------------------------- */

const CDN = {
  mermaidJs: "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
  plotlyJs: "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2/plotly.min.js",
  hljsCss: "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-light.min.css",
  hljsCssDark: "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/atom-one-dark.min.css",
  hljsJs: "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/common.min.js"
};

function loadScriptOnce(src) {
  return new Promise(function (resolve, reject) {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = function () { resolve(); };
    s.onerror = function () { reject(new Error("failed to load " + src)); };
    document.head.appendChild(s);
  });
}

function loadStylesheetOnce(href) {
  return new Promise(function (resolve) {
    const existing = document.querySelector('link[href="' + href + '"]');
    if (existing) { resolve(existing); return; }
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.onload = function () { resolve(l); };
    l.onerror = function () { resolve(l); };
    document.head.appendChild(l);
  });
}

function detectPostNeeds(body) {
  const fenceLangs = (body.match(/```[a-zA-Z0-9_-]*\n/g) || []).map(function (f) {
    return f.replace(/```/, "").replace(/\n/, "").trim();
  });
  return {
    mermaid: fenceLangs.indexOf("mermaid") !== -1,
    plot: fenceLangs.indexOf("plot") !== -1,
    highlight: fenceLangs.some(function (lang) { return lang && lang !== "mermaid" && lang !== "plot" && lang !== "widget"; })
  };
}

function slugify(text, used) {
  let base = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  if (!base) base = "section";
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = base + "-" + n;
    n++;
  }
  used.add(slug);
  return slug;
}

function addHeadingAnchorsIn(el) {
  const used = new Set();
  const headings = Array.prototype.slice.call(el.querySelectorAll("h2, h3"));
  return headings.map(function (h) {
    const id = slugify(h.textContent, used);
    h.id = id;
    const link = document.createElement("a");
    link.href = "#" + id;
    link.className = "heading-anchor";
    link.setAttribute("aria-label", "Link to this section");
    link.textContent = "#";
    h.appendChild(link);
    return { id: id, text: h.textContent.replace(/#$/, "").trim(), level: h.tagName === "H2" ? 2 : 3 };
  });
}

function renderTocIn(tocEl, headings) {
  if (!tocEl) return;
  if (headings.length < 3) {
    tocEl.innerHTML = "";
    return;
  }
  tocEl.innerHTML =
    '<p class="toc-label">Contents</p><ul>' +
    headings.map(function (h) {
      return '<li class="toc-level-' + h.level + '"><a href="#' + h.id + '">' + h.text + "</a></li>";
    }).join("") +
    "</ul>";
}

function protectMath(markdown) {
  const store = [];
  const mathPatterns = [
    /\$\$[\s\S]+?\$\$/g,
    /\\\[[\s\S]+?\\\]/g,
    /\\\([\s\S]+?\\\)/g,
    /\$[^\n$]+?\$/g
  ];

  function protectSegment(segment) {
    let text = segment;
    mathPatterns.forEach(function (re) {
      text = text.replace(re, function (match) {
        const token = "\u0000MATH" + store.length + "\u0000";
        store.push(match);
        return token;
      });
    });
    return text;
  }

  const fenceRe = /```[\s\S]*?```/g;
  let result = "";
  let lastIndex = 0;
  let m;
  while ((m = fenceRe.exec(markdown)) !== null) {
    result += protectSegment(markdown.slice(lastIndex, m.index));
    result += m[0];
    lastIndex = fenceRe.lastIndex;
  }
  result += protectSegment(markdown.slice(lastIndex));
  return { text: result, store: store };
}

function restoreMath(html, store) {
  return html.replace(/\u0000MATH(\d+)\u0000/g, function (_, i) {
    return store[Number(i)];
  });
}

/* ---------------------------------------------
   Reading time. Rough, word-count-based, same convention most blogs use:
   ~200 words per minute, rounded, floor of 1 minute.
--------------------------------------------- */

function estimateReadingTime(markdown) {
  const words = (markdown || "").trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return minutes + " min read";
}

/* ---------------------------------------------
   Prev / next post navigation. posts.json order is newest-first, so the
   "older" post is the next array entry and "newer" is the previous one.
--------------------------------------------- */

function renderPrevNextNav(navEl, posts, currentIndex) {
  if (!navEl) return;
  const older = posts[currentIndex + 1];
  const newer = posts[currentIndex - 1];
  const olderLink = older
    ? '<a class="post-nav-link post-nav-prev" href="' + slugHref(older.slug) + '"><span class="post-nav-label">&larr; older</span>' + older.title + "</a>"
    : "<span></span>";
  const newerLink = newer
    ? '<a class="post-nav-link post-nav-next" href="' + slugHref(newer.slug) + '"><span class="post-nav-label">newer &rarr;</span>' + newer.title + "</a>"
    : "<span></span>";
  navEl.innerHTML = '<div class="post-nav">' + olderLink + newerLink + "</div>";
}

/* Every post now has a static, shareable page at posts/<slug>.html
   (generated by scripts/generate_post_pages.py, carries real per-post
   OG/Twitter meta tags). Links from the blog list and prev/next nav
   point there. post.html?slug=... still works as a fallback, both
   resolve to the same renderPost() call. */
function slugHref(slug) {
  return "posts/" + encodeURIComponent(slug) + ".html";
}

/* ---------------------------------------------
   BibTeX export. Deliberately derives everything from the existing
   title/meta/status fields already in publications.json rather than
   requiring new schema fields, an unknown year is written as "n.d."
   instead of guessed.
--------------------------------------------- */

function slugifyKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
}

function parsePubMeta(pub) {
  const raw = pub.meta || "";
  const yearMatch = raw.match(/\((\d{4})\)/);
  const authors = raw.replace(/\s*\(\d{4}\)\s*$/, "").trim();
  let year = yearMatch ? yearMatch[1] : null;
  if (!year) {
    const statusText = (pub.status || "").replace(/<[^>]+>/g, "");
    const y = statusText.match(/\b(19|20)\d{2}\b/);
    year = y ? y[0] : "n.d.";
  }
  return { authors: authors || raw, year: year };
}

function generateBibtex(pub) {
  const parsed = parsePubMeta(pub);
  const firstAuthorLast = (parsed.authors.split(",")[0] || "gafsi").toLowerCase().replace(/[^a-z]/g, "");
  const key = firstAuthorLast + (parsed.year !== "n.d." ? parsed.year : "nd") + slugifyKey((pub.title || "").split(" ")[0]);
  const statusText = (pub.status || "").replace(/<[^>]+>/g, "").trim();
  const lines = [
    "@misc{" + key + ",",
    "  title = {" + pub.title + "},",
    "  author = {" + parsed.authors + "},",
    "  year = {" + parsed.year + "},",
    "  note = {" + statusText + "}",
    "}"
  ];
  return lines.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------
   Page renderers
--------------------------------------------- */

function renderProjects(containerId, smallerId) {
  const container = document.getElementById(containerId);
  const smallerContainer = document.getElementById(smallerId);
  if (!container) return;

  loadData("data/projects.json").then(function (data) {
    container.innerHTML = (data.projects || []).map(function (p) {
      const paragraphs = (p.paragraphs || []).map(function (text) {
        return "<p>" + text + "</p>";
      }).join("");
      return (
        '<div class="project">' +
        '<p class="project-tag">' + p.tag + "</p>" +
        '<h2 class="project-title">' + p.title + "</h2>" +
        '<div class="project-figure"><img src="' + p.image + '" alt="' + p.imageAlt + '"></div>' +
        paragraphs +
        "</div>"
      );
    }).join("");

    if (smallerContainer) {
      smallerContainer.innerHTML = (data.smaller || []).map(function (s) {
        return (
          "<li><span class=\"label\">" + s.label + "</span>" +
          '<span class="sub">' + s.description + "</span></li>"
        );
      }).join("");
    }

    renderMathIn(container);
    if (smallerContainer) renderMathIn(smallerContainer);
  }).catch(function () {
    showError(container, "data/projects.json");
  });
}

function renderPublications(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  loadData("data/publications.json").then(function (data) {
    const pubs = data.publications || [];
    container.innerHTML = pubs.map(function (pub, i) {
      return (
        '<div class="pub">' +
        '<p class="pub-title">' + pub.title + "</p>" +
        '<p class="pub-meta">' + pub.meta + "</p>" +
        '<p class="pub-status">' + pub.status + "</p>" +
        '<button type="button" class="bibtex-btn" data-index="' + i + '">export BibTeX</button>' +
        "</div>"
      );
    }).join("");

    container.querySelectorAll(".bibtex-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const pub = pubs[parseInt(btn.getAttribute("data-index"), 10)];
        downloadText(slugifyKey((pub.title || "pub").split(" ")[0]) + ".bib", generateBibtex(pub));
      });
    });

    renderMathIn(container);
  }).catch(function () {
    showError(container, "data/publications.json");
  });
}

function renderBackground(educationId, experienceId, distinctionsId) {
  const eduContainer = document.getElementById(educationId);
  const expContainer = document.getElementById(experienceId);
  const distContainer = document.getElementById(distinctionsId);
  if (!eduContainer && !expContainer && !distContainer) return;

  function entryHTML(item) {
    return (
      '<div class="entry">' +
      '<div class="entry-head">' +
      '<span class="entry-title">' + item.title + "</span>" +
      '<span class="entry-when">' + item.when + "</span>" +
      "</div>" +
      '<div class="entry-where">' + item.where + "</div>" +
      '<div class="entry-body">' + item.body + "</div>" +
      "</div>"
    );
  }

  loadData("data/background.json").then(function (data) {
    if (eduContainer) {
      eduContainer.innerHTML = (data.education || []).map(entryHTML).join("");
      renderMathIn(eduContainer);
    }
    if (expContainer) {
      expContainer.innerHTML = (data.experience || []).map(entryHTML).join("");
      renderMathIn(expContainer);
    }
    if (distContainer) {
      distContainer.innerHTML = (data.distinctions || []).map(function (d) {
        return (
          "<li><span class=\"label\">" + d.label + "</span>" +
          '<span class="sub">' + d.sub + "</span></li>"
        );
      }).join("");
    }
  }).catch(function () {
    if (eduContainer) showError(eduContainer, "data/background.json");
  });
}

/* Blog list: adds a live text search (title + summary + body) and a
   tag filter built from the union of every post's tags array. Both
   containers (#blogSearch, #blogTags) are optional, if either is
   missing from the page's HTML that feature is silently skipped. */
function renderBlogList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const searchEl = document.getElementById("blogSearch");
  const tagsEl = document.getElementById("blogTags");

  loadData("data/posts.json").then(function (data) {
    const posts = data.posts || [];
    if (posts.length === 0) {
      container.innerHTML = '<p class="dim">No posts yet.</p>';
      return;
    }

    const allTags = Array.from(new Set(posts.reduce(function (acc, p) {
      return acc.concat(p.tags || []);
    }, []))).sort();

    let activeTag = null;
    let query = "";

    function itemHTML(post) {
      const thumb = post.thumbnail
        ? '<div class="post-thumb"><img src="' + post.thumbnail + '" alt=""></div>'
        : "";
      const tagPills = (post.tags || []).map(function (t) {
        return '<span class="tag-pill">' + t + "</span>";
      }).join("");
      return (
        '<div class="post-item">' +
        thumb +
        '<div class="post-item-text">' +
        '<p class="post-item-title"><a href="' + slugHref(post.slug) + '">' + post.title + "</a></p>" +
        '<p class="pub-meta">' + post.date + " &middot; " + estimateReadingTime(post.body || post.summary || "") + "</p>" +
        '<p class="post-summary">' + post.summary + "</p>" +
        (tagPills ? '<div class="tag-row">' + tagPills + "</div>" : "") +
        "</div></div>"
      );
    }

    function applyFilter() {
      const q = query.trim().toLowerCase();
      const filtered = posts.filter(function (p) {
        const matchesTag = !activeTag || (p.tags || []).indexOf(activeTag) !== -1;
        const haystack = (p.title + " " + p.summary + " " + (p.body || "")).toLowerCase();
        const matchesQuery = !q || haystack.indexOf(q) !== -1;
        return matchesTag && matchesQuery;
      });
      container.innerHTML = filtered.length
        ? filtered.map(itemHTML).join("")
        : '<p class="dim">No posts match.</p>';
    }

    if (tagsEl && allTags.length) {
      tagsEl.innerHTML = allTags.map(function (t) {
        return '<button type="button" class="tag-filter" data-tag="' + t + '">' + t + "</button>";
      }).join("");
      tagsEl.querySelectorAll(".tag-filter").forEach(function (btn) {
        btn.addEventListener("click", function () {
          const t = btn.getAttribute("data-tag");
          activeTag = activeTag === t ? null : t;
          tagsEl.querySelectorAll(".tag-filter").forEach(function (b) {
            b.classList.toggle("active", b.getAttribute("data-tag") === activeTag);
          });
          applyFilter();
        });
      });
    }

    if (searchEl) {
      searchEl.addEventListener("input", function () {
        query = searchEl.value;
        applyFilter();
      });
    }

    applyFilter();
  }).catch(function () {
    showError(container, "data/posts.json");
  });
}

function renderPost(titleId, dateId, bodyId) {
  const titleEl = document.getElementById(titleId);
  const dateEl = document.getElementById(dateId);
  const bodyEl = document.getElementById(bodyId);
  const heroEl = document.getElementById("post-hero");
  const readingEl = document.getElementById("post-reading-time");
  const navEl = document.getElementById("post-prevnext");
  if (!bodyEl) return;

  const params = new URLSearchParams(window.location.search);
  let slug = params.get("slug");
  if (!slug) {
    const metaSlug = document.querySelector('meta[name="post-slug"]');
    if (metaSlug) slug = metaSlug.getAttribute("content");
  }

  loadData("data/posts.json").then(function (data) {
    const posts = data.posts || [];
    const idx = posts.findIndex(function (p) { return p.slug === slug; });
    const post = idx !== -1 ? posts[idx] : null;

    if (!post) {
      if (titleEl) titleEl.textContent = "Post not found";
      bodyEl.innerHTML = '<p class="dim">There is no post at this address. <a href="../blog.html">Back to the blog list</a>.</p>';
      return;
    }

    document.title = post.title + " \u00b7 Iheb Gafsi";
    if (titleEl) titleEl.textContent = post.title;
    if (dateEl) dateEl.textContent = post.date;
    if (readingEl) readingEl.textContent = estimateReadingTime(post.body || "");
    if (heroEl) {
      heroEl.innerHTML = post.thumbnail
        ? '<img src="' + post.thumbnail + '" alt="">'
        : "";
    }

    bodyEl.className = "md-content";
    let html;
    if (window.marked) {
      const protectedResult = protectMath(post.body || "");
      html = marked.parse(protectedResult.text);
      html = restoreMath(html, protectedResult.store);
    } else {
      html = "<pre>" + (post.body || "") + "</pre>";
    }
    bodyEl.innerHTML = html;

    const headings = addHeadingAnchorsIn(bodyEl);
    renderTocIn(document.getElementById("post-toc"), headings);

    const needs = detectPostNeeds(post.body || "");
    const loaders = [];
    if (needs.mermaid) {
      loaders.push(loadScriptOnce(CDN.mermaidJs).then(initMermaid));
    }
    if (needs.plot) {
      loaders.push(loadScriptOnce(CDN.plotlyJs));
    }
    if (needs.highlight) {
      loaders.push(Promise.all([
        loadStylesheetOnce(CDN.hljsCss).then(function (el) { if (el) el.id = "hljs-light"; }),
        loadStylesheetOnce(CDN.hljsCssDark).then(function (el) { if (el) el.id = "hljs-dark"; }),
        loadScriptOnce(CDN.hljsJs)
      ]).then(function () { syncHljsTheme(); }));
    }

    Promise.all(loaders).catch(function (err) {
      console.error(err);
    }).then(function () {
      renderMermaidIn(bodyEl);
      renderPlotsIn(bodyEl);
      renderWidgetsIn(bodyEl);
      highlightCodeIn(bodyEl);
      addCopyButtonsIn(bodyEl);
      renderMathIn(bodyEl);
      renderPrevNextNav(navEl, posts, idx);
    });
  }).catch(function () {
    showError(bodyEl, "data/posts.json");
  });
}
