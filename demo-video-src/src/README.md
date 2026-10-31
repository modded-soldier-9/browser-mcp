# Demo Video Source & Compositions

## Overview
Core video compositions, scene choreographies, promotional asset generators, and entry point registrations for the Browser MCP marketing and demonstration suite.

## Interface
- [`RemotionRoot`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Root.tsx#L9): Root Remotion component registering video compositions (`Hero`, `Demo`) and static asset renderers (`Store`, `PromoTile`, `OgImage`, `GithubSocial`, `MarqueeTile`).
- [`Demo`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Demo.tsx#L549): Full 1760-frame (~59s) video demonstration orchestrating 9 sequential feature scenes (hook, title card, Stripe navigation, Google Cloud form fill, 2FA challenge, LinkedIn rich typing, Railway network wait, multi-session tab isolation, and end card).
- [`Hero`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Hero.tsx#L610) & [`HERO_DURATION`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Hero.tsx#L28): 1108-frame (~37s) split-screen comparison composition contrasting headless bot detection failures against Browser MCP's real-Chrome session execution.
- [`StoreShots`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Store.tsx#L331), [`STORE_COUNT`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Store.tsx#L337), [`PromoTile`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Store.tsx#L361), [`MarqueeTile`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Store.tsx#L386): Chrome Web Store listing assets including 5 slide frames (1280x800), search promo tile (440x280), and marquee banner (1400x560).
- [`Social`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Social.tsx#L39), [`OgImage`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Social.tsx#L84), [`GithubSocial`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Social.tsx#L85): Social banner renderers for OpenGraph (1200x630) and GitHub repository previews (1280x640).
- Subdirectories:
  - [`components`](./components/README.md): Reusable UI mockups and animation effects.

## Invariants
- [`Demo`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Demo.tsx#L549) composition duration is strictly 1760 frames at 30 fps; sub-scene durations must sum to exactly 1760.
- [`Hero`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Hero.tsx#L610) composition duration is strictly 1108 frames at 30 fps ([`HERO_DURATION`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/Hero.tsx#L28)).
- Static image compositions (`Store`, `PromoTile`, `OgImage`, `GithubSocial`, `MarqueeTile`) configure `fps={1}` and fixed canvas aspect dimensions.
- `registerRoot(RemotionRoot)` in [`index.ts`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/index.ts#L4) must execute as the Remotion bundle entry point.

## Side Effects
- [`index.ts`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/index.ts#L4) invokes Remotion's `registerRoot` runtime hook upon module load.

## Verification
- Run: `npm run lint`
