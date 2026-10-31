# Demo Video UI Components

## Overview
Reusable Remotion visual components simulating real-world browser interfaces, developer terminals, cloud dashboards, and motion effects for demo video sequences.

## Interface
- [`Terminal`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Terminal.tsx#L28): Mock terminal window supporting character-by-character typed commands, syntax highlighting, and idle blinking cursor.
- [`Browser`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Browser.tsx#L20): Simulated browser frame with window controls, tab strip with tab-group support, and address bar.
- [`AskUserOverlay`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Browser.tsx#L179): Modal overlay simulating human-in-the-loop 2FA and input request prompts.
- [`StripeDashboard`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/PageContent.tsx#L5): Mock Stripe API keys management dashboard with secret/publishable key display and loading spinner.
- [`GoogleOAuthForm`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/PageContent.tsx#L168): Mock Google Cloud Console OAuth consent configuration form.
- [`HubSpotDashboard`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/PageContent.tsx#L241): Mock HubSpot private app integration settings displaying private app tokens.
- [`SlackPage`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/PageContent.tsx#L283): Mock Slack workspace channel interface displaying automated alert notifications.
- [`CookieBannerPage`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/MorePages.tsx#L5): Mock enterprise web application with dismissible cookie consent banner.
- [`RailwayDashboard`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/MorePages.tsx#L81): Mock Railway project dashboard with deployment status state indicator.
- [`LinkedInPage`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/MorePages.tsx#L167): Mock LinkedIn member profile with interactive message compose box.
- [`NetworkMonitor`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/MorePages.tsx#L263): Mock DevTools network monitoring table displaying HTTP requests, status codes, and latencies.
- [`GlowHighlight`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L5): Animated pulsating focus highlight rectangle for emphasizing UI elements.
- [`AnimatedCursor`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L38): Smooth mouse cursor animating through sequenced coordinate waypoints with cubic easing.
- [`ClickRipple`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L101): Expanding concentric circle ripple animation triggered on click events.
- [`SceneLabel`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L134): Fullscreen scene transition title overlay with fade-in and fade-out animations.
- [`Takeaway`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L206): Overlay banner emphasizing key takeaway messages during video scenes.
- [`ConnectionPulse`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L257): Animated visual pulse connecting terminal commands with browser actions.

## Invariants
- All components are deterministic Remotion visual components driven by props and frame timing.
- [`AnimatedCursor`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L38) returns `null` when `frame < positions[0].frame` or when `positions` is empty.
- [`ClickRipple`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L101) renders exclusively within 20 frames of `triggerFrame`.
- [`SceneLabel`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L134) terminates rendering when `frame > 32`.
- [`Takeaway`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Effects.tsx#L206) renders only when `frame >= startFrame`.
- [`AskUserOverlay`](file:///c:/Users/modded/Documents/GitHub/browser-mcp/demo-video-src/src/components/Browser.tsx#L179) renders `null` when `visible` is false.

## Side Effects
- None

## Verification
- Run: `npm run lint`
