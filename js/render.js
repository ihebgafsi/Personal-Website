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
      return (
        '<div class="post-item">' +
        '<p class="post-item-title"><a href="post.html?slug=' +
        encodeURIComponent(post.slug) + '">' + post.title + "</a></p>" +
        '<p class="pub-meta">' + post.date + "</p>" +
        '<p class="post-summary">' + post.summary + "</p>" +
        "</div>"
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

    bodyEl.className = "md-content";
    bodyEl.innerHTML = window.marked
      ? marked.parse(post.body || "")
      : "<pre>" + (post.body || "") + "</pre>";

    // order matters: pull out diagrams and plots (they live in fenced
    // code blocks marked.js just produced) before highlighting whatever
    // ordinary code blocks are left, then run math last.
    renderMermaidIn(bodyEl);
    renderPlotsIn(bodyEl);
    highlightCodeIn(bodyEl);
    renderMathIn(bodyEl);
  }).catch(function () {
    showError(bodyEl, "data/posts.json");
  });
}
