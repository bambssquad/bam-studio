# Bam Studio

Interactive architecture portfolio built with React, Vite, JavaScript, and Three.js.

Live site: https://bambssquad.github.io/bam-studio/ (public GitHub Pages).

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
npm test
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

`npm run build` generates `dist/` with the `/bam-studio/` asset base. GitHub Actions builds and deploys `main` automatically to GitHub Pages. The legacy `.openai/hosting.json` belongs to the previous ChatGPT Site and is not used for GitHub Pages.

## BILLYMOON

BILLYMOON has a dedicated Lookbook section and appears in the project collection. Its locally served, optimized image is an interior visualization of the café seating area from the supplied architectural model. No location, client, or project date is asserted. The original three demonstration projects are unchanged. The public interactive viewer is available at `/bam-studio/billymoon/`, with Light and Detail runtime model files included. The original SketchUp archive is not uploaded; the existing private Site keeps its original sharing settings.

## Public viewer distribution

`public/billymoon/` contains the complete static v7 runtime from BILLYMOON source commit `25b26c2dbd8c1cfb21c646da64053dfa0845ff5b`, including vendor licenses, both model tiers, material metadata, avatar/navigation code, and render/lightmap references. Vite copies the public distribution to `dist/billymoon/`. For reliable GitHub upload, encoded model files over 2,000,000 bytes are stored as numbered pieces. `model-transfer.js` reconstructs each original encoded file byte-for-byte before the unchanged model decoder runs; manifests retain original totals and hashes. All imports and model paths are relative to that directory. The default Light tier is fetched first; `?detail=1` selects Detail on reload. These are browser runtime glTF/buffer assets, not a promise of lossless SketchUp round-trip editing. No `.skp`, `.blend`, private hosting configuration, or credentials are included.
