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
   Shared enhancement passes. Called after any
   container is filled with HTML, in this order:
   markdown is already applied by the caller,
   then diagrams, then plots, then code highlighting,
   then math last (KaTeX ignores <pre>/<code> by default).
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
  blocks.forEach(function (block) {
    const holder = document.createElement("div");
    holder.className = "plot-container";
    try {
      const spec = JSON.parse(block.textContent);
      block.parentElement.replaceWith(holder);

      // Plotly sizes itself off the container's current box. An empty div
      // that was just inserted has no height yet unless one is given
      // explicitly, which is what was collapsing charts to a sliver.
      // These are defaults, anything set in the post's own "layout" wins.
      const layout = Object.assign(
        { height: 420, margin: { t: 48, r: 24, b: 48, l: 56 }, font: { family: "IBM Plex Mono, monospace", size: 12 } },
        spec.layout || {}
      );
      const config = Object.assign({ responsive: true, displaylogo: false }, spec.config || {});

      Plotly.newPlot(holder, spec.data || [], layout, config);

      // Re-measure once the surrounding layout (fonts, KaTeX, images) has
      // settled, since those can still shift the container's width after
      // the initial plot.
      window.addEventListener("load", function () {
        Plotly.Plots.resize(holder);
      });
    } catch (err) {
      holder.innerHTML = '<p class="dim">Plot failed to render, invalid JSON in the plot block (' + err.message + ").</p>";
      block.parentElement.replaceWith(holder);
    }
  });
}

function highlightCodeIn(el) {
  if (!window.hljs || !el) return;
  el.querySelectorAll("pre code").forEach(function (block) {
    hljs.highlightElement(block);
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
    if (document.querySelector('link[href="' + href + '"]')) { resolve(); return; }
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.onload = function () { resolve(); };
    l.onerror = function () { resolve(); }; // a missing stylesheet shouldn't block rendering
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
    highlight: fenceLangs.some(function (lang) { return lang && lang !== "mermaid" && lang !== "plot"; })
  };
}

function initMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: "14px",
      primaryColor: "#f7f7f3",
      primaryTextColor: "#1c1c1a",
      primaryBorderColor: "#5c5c56",
      lineColor: "#5c5c56",
      secondaryColor: "#efeee7",
      tertiaryColor: "#efeee7"
    },
    flowchart: { curve: "basis", htmlLabels: true, padding: 16 }
  });
}

/* CommonMark treats a backslash before punctuation like { } | , ; as an
   escape sequence and silently drops the backslash, since it has no idea
   that text is LaTeX rather than prose. That corrupts things like
   \left\{, \middle|, \,  before KaTeX ever sees them. Fix: pull every
   $...$ / $$...$$ / \(...\) / \[...\] span out into an opaque placeholder
   token before marked.parse runs, then paste the original raw math back
   into the resulting HTML afterward. Fenced code blocks are left alone
   entirely, since CommonMark already treats their contents literally. */
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
    result += m[0]; // fenced code, left untouched
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
    container.innerHTML = (data.publications || []).map(function (pub) {
      return (
        '<div class="pub">' +
        '<p class="pub-title">' + pub.title + "</p>" +
        '<p class="pub-meta">' + pub.meta + "</p>" +
        '<p class="pub-status">' + pub.status + "</p>" +
        "</div>"
      );
    }).join("");
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

function renderBlogList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  loadData("data/posts.json").then(function (data) {
    const posts = data.posts || [];
    if (posts.length === 0) {
      container.innerHTML = '<p class="dim">No posts yet.</p>';
      return;
    }
    container.innerHTML = posts.map(function (post) {
      const thumb = post.thumbnail
        ? '<div class="post-thumb"><img src="' + post.thumbnail + '" alt=""></div>'
        : "";
      return (
        '<div class="post-item">' +
        thumb +
        '<div class="post-item-text">' +
        '<p class="post-item-title"><a href="post.html?slug=' +
        encodeURIComponent(post.slug) + '">' + post.title + "</a></p>" +
        '<p class="pub-meta">' + post.date + "</p>" +
        '<p class="post-summary">' + post.summary + "</p>" +
        "</div></div>"
      );
    }).join("");
  }).catch(function () {
    showError(container, "data/posts.json");
  });
}

function renderPost(titleId, dateId, bodyId) {
  const titleEl = document.getElementById(titleId);
  const dateEl = document.getElementById(dateId);
  const bodyEl = document.getElementById(bodyId);
  const heroEl = document.getElementById("post-hero");
  if (!bodyEl) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  loadData("data/posts.json").then(function (data) {
    const posts = data.posts || [];
    const post = posts.filter(function (p) { return p.slug === slug; })[0];

    if (!post) {
      if (titleEl) titleEl.textContent = "Post not found";
      bodyEl.innerHTML = '<p class="dim">There is no post at this address. <a href="blog.html">Back to the blog list</a>.</p>';
      return;
    }

    document.title = post.title + " \u00b7 Iheb Gafsi";
    if (titleEl) titleEl.textContent = post.title;
    if (dateEl) dateEl.textContent = post.date;
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

    const needs = detectPostNeeds(post.body || "");
    const loaders = [];
    if (needs.mermaid) {
      loaders.push(loadScriptOnce(CDN.mermaidJs).then(initMermaid));
    }
    if (needs.plot) {
      loaders.push(loadScriptOnce(CDN.plotlyJs));
    }
    if (needs.highlight) {
      loaders.push(Promise.all([loadStylesheetOnce(CDN.hljsCss), loadScriptOnce(CDN.hljsJs)]));
    }

    Promise.all(loaders).catch(function (err) {
      console.error(err);
    }).then(function () {
      // order matters: pull out diagrams and plots (they live in fenced
      // code blocks marked.js just produced) before highlighting whatever
      // ordinary code blocks are left, then run math last.
      renderMermaidIn(bodyEl);
      renderPlotsIn(bodyEl);
      highlightCodeIn(bodyEl);
      renderMathIn(bodyEl);
    });
  }).catch(function () {
    showError(bodyEl, "data/posts.json");
  });
}
