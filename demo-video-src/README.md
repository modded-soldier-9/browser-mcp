# Demo Video Blueprint

## System Overview
Remotion video generation subsystem for Browser MCP. Produces programmatic marketing videos, split-screen interactive comparisons, Chrome Web Store listing graphics, and OpenGraph social cards using React and Tailwind CSS v4.

## Local Interface & Invariants
- [`remotion.config.ts`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/remotion.config.ts): Configures Remotion CLI options (`jpeg` image format, overwrite enabled, Tailwind CSS v4 webpack configuration override via `@remotion/tailwind-v4`).
- [`package.json`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/package.json): NPM package definition with dependencies on Remotion v4, React 19, and Tailwind CSS v4.
- [`tsconfig.json`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/tsconfig.json): TypeScript configuration targeting ES2018 with `commonjs` module resolution, excluding `remotion.config.ts`.

## Subdirectories & System Boundaries
- [`src`](./src/README.md): Remotion root registration, video compositions, scene choreography, and simulated application UI components.

## Global Invariants
- Remotion CLI rendering utilizes Webpack with Tailwind CSS v4 integration.
- Video output image format is configured to JPEG.
- All animated compositions adhere to 30 fps timing; static promo compositions execute at 1 fps.

## Global Side Effects
- Bundles and renders video frames, MP4 files, and static promotional image files to local storage via Remotion CLI (`npm run dev`, `npm run build`).

## System Verification
- Run: `npm run lint`
