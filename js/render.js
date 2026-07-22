/*
  Reads the JSON files in /data and fills in the containers on each page.
  No build step, no dependencies. Add or edit an entry in the matching
  JSON file, nothing here needs to change.

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
    }
    if (expContainer) {
      expContainer.innerHTML = (data.experience || []).map(entryHTML).join("");
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
