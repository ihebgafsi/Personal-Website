# ihebgafsi.tn

Static site, plain HTML, CSS, and a small amount of vanilla JavaScript. No build step, no framework, no npm install.

## Adding or editing content

Nothing on the Research, Publications, or Background pages is hardcoded in HTML. Each page reads a JSON file at load time and builds the page from it.

- `data/projects.json`, the project write-ups and the "smaller reproductions" list on `research.html`
- `data/publications.json`, the preprint list on `publications.html`
- `data/background.json`, education, experience, and distinctions on `background.html`

To add a project, open `data/projects.json` and copy one of the existing objects inside the `"projects"` array, then edit the fields. Same pattern for a publication or a background entry, copy an existing object in the relevant array, edit it, save. No HTML editing required, and the page picks it up on next load.

Field reference:

**projects.json**, each project has `tag`, `title`, `image`, `imageAlt`, and `paragraphs` (an array of strings, one per paragraph, HTML like `<a>` is allowed inside a paragraph string). The `smaller` array takes `label` and `description`.

**publications.json**, each entry has `title`, `meta` (authors and year), and `status` (venue or link, HTML allowed).

**background.json**, `education` and `experience` each take `title`, `when`, `where`, `body`. `distinctions` takes `label` and `sub`.

## Local preview

Opening `index.html` directly by double clicking it will not work correctly, browsers block `fetch` requests from `file://` URLs, so the JSON never loads. Serve the folder instead:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000` in a browser. This limitation does not apply once the site is on GitHub Pages, it is only a local file:// restriction.

## Deploy on GitHub Pages

1. Create a repository (any name works, it does not need to match the username).
2. Push these files to the repository's default branch, keeping the folder structure intact.
3. In the repository settings, under Pages, set the source to that branch, root folder.
4. In your domain registrar's DNS settings, add a record for the domain pointing at `<username>.github.io`. The `CNAME` file in this repo already contains `ihebgafsi.tn`, GitHub Pages reads that to serve the custom domain.
5. Once DNS propagates, check the box for "Enforce HTTPS" in the Pages settings.

## Files to replace yourself

- `images/profile.jpg`, currently a placeholder monogram, swap for a real photo, same filename.
- `images/placeholder.svg`, used as the figure in each project entry. Replace the file itself to update every project figure at once, or add per-project images and point each project's `image` field in `data/projects.json` at its own file.

## Structure

```
index.html            home
research.html         projects, reads data/projects.json
publications.html     preprints, reads data/publications.json
background.html       education and experience, reads data/background.json
css/style.css         all styling, one file
js/render.js           fetches the JSON files and fills in each page
data/*.json            the actual content
images/                 photo and figures
```
