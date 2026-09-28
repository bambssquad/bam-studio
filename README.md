# Bam Studio

Interactive architecture portfolio built with React, Vite, JavaScript, and Three.js.

Live site: https://bambe-water-gallery.takashimurachan.chatgpt.site (owner-private).

## Features

- Timeline, perspective Surf, and Index project views.
- Rounded Liquid Glass controls, pointer highlights, and spring-driven card and title interactions.
- Featured WebGL gallery with directional water strokes and surface warp.
- Persistent YouTube soundtrack: closing the music menu keeps playback running, with cover and title visible.
- Responsive layouts, keyboard navigation, and reduced-motion support.

## Development

Requires Node.js 22.12+ (tested with 22.23.2).

```sh
npm ci
npm run dev
```

## Checks and production

```sh
npm run lint
npm run build
npm run preview
```

Edit sample project data in `src/App.jsx`. Lookbook interactions are in `src/Lookbook.jsx`, springs in `src/motion.js`, typography in `src/JellyTitle.jsx`, and music in `src/Soundtrack.jsx`. Visual layers use `App.css`, `Lookbook.css`, `Glass.css`, and `Interactive.css`.

Project names, locations, descriptions, and years are demonstration content. Replace them with verified studio work before publishing. Add real contact details in the contact section. Reference photos load from Unsplash; fonts load from Google Fonts and require internet access. There is no backend or contact form.

## Gallery interaction

The Featured view uses Three.js/WebGL for an endless full-screen gallery. Scroll, drag, use arrow keys with the gallery focused, or press previous/next. Pointer movement generates directional water strokes over the photos; gallery movement increases the surface warp. Reduced-motion preferences disable those effects.

Open All projects for the filterable index. Project details, studio information, and contact information use native dialogs with Escape dismissal. A static image gallery is available if WebGL initialization or image loading fails.

## Music and deployment

Music begins after Play. Playback and continued playback with the menu closed were verified in Chrome. Some embedded browsers block YouTube; the player reports the error and provides a direct link.

`npm run build` generates `dist/`. The existing `.openai/hosting.json` is bound to the Bambe Water Gallery Site. Preserve it for updates to that Site; use a separate identity for a different Site. This repository does not automatically deploy to GitHub Pages.
