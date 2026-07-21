# ihebgafsi.tn

Static site, plain HTML and CSS, no build step.

## Deploy on GitHub Pages

1. Create a repository (any name works, it does not need to match the username).
2. Push these files to the repository's default branch.
3. In the repository settings, under Pages, set the source to that branch, root folder.
4. In your domain registrar's DNS settings, add a CNAME record for the domain pointing to `<username>.github.io`. The `CNAME` file in this repo already contains `ihebgafsi.tn`, GitHub Pages reads that to serve the custom domain.
5. Once DNS propagates, check the box for "Enforce HTTPS" in the Pages settings.

## Files to replace yourself

- `images/profile.svg`, swap for a real photo. Any format works (`.jpg`, `.png`), just update the `src` in the four HTML files (currently `images/profile.svg`).
- `images/placeholder.svg`, used as the figure in each project entry on `research.html`. Replace with an actual diagram or example image per project, same filename or update the `src` attributes in `research.html`.

## Structure

- `index.html`, home
- `research.html`, projects
- `publications.html`, preprints
- `background.html`, education and experience
- `css/style.css`, all styling, one file

No Jekyll, no JavaScript framework, no dependencies. Editing any page means editing that HTML file directly.
