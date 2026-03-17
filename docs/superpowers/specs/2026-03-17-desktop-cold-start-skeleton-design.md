# Desktop Cold Start Skeleton Design

**Date:** 2026-03-17

**Status:** Approved in terminal discussion

## Goal

Replace the desktop app's current centered brand splash during cold start with a fixed desktop shell skeleton that feels like the app has already opened.

## Scope

### In Scope

- Desktop app cold start only
- Replace the static `#loading-screen` content in `apps/desktop/index.html`
- Keep the existing lifecycle where React removes `#loading-screen`
- Use a fixed desktop shell skeleton with medium fidelity
- Keep a weak brand presence in the top-left of the skeleton
- Switch directly to the real UI with no fade or staged reveal

### Out of Scope

- Web startup experience
- Mobile startup experience
- Post-boot route-level `BrandTextLoading`
- Simulating the last visited page on startup
- Matching user-customized left panel width during cold start

## Current Behavior

The desktop app shows a centered static brand loading screen from `apps/desktop/index.html` before React mounts. Once `SPAGlobalProvider` mounts, it removes `#loading-screen` and the app renders the real layout. If route chunks are still pending after boot, React falls back to `BrandTextLoading` inside Suspense boundaries.

## Target Experience

The first visible frame of the desktop app should look like a simplified but recognizable desktop app shell instead of a loading page. Users should perceive that the application has opened immediately, with content areas still hydrating behind the scenes.

## Chosen Approach

Use a static desktop shell skeleton in `apps/desktop/index.html` and keep the existing removal point in `src/layout/SPAGlobalProvider/index.tsx`.

This keeps the earliest possible paint, avoids changing React boot logic, and minimizes implementation risk. The shell should align to the real desktop layout's major geometry closely enough that React can replace it directly without noticeable visual jumping.

## Alternatives Considered

| Option | Summary | Why Not Chosen |
| --- | --- | --- |
| A | Replace brand splash with a neutral shell | Safer but too abstract; does not leverage the existing desktop layout identity enough |
| B | Render a React skeleton after mount | Too late for cold start; does not improve the first visible frame |
| C | Static home-like desktop shell with weak branding | Chosen; earliest paint and best alignment with desired startup perception |

## Skeleton Layout

The startup shell should mimic the desktop main layout at a medium-fidelity level:

- Window frame spacing should remain consistent with the desktop container
- A fixed left navigation skeleton should anchor the layout
- A weak brand marker should appear in the top-left of the left panel
- The main content container should preserve outer padding, border, radius, and background layering
- The main content area should show neutral skeleton blocks, not fake real data

### Required Geometry Anchors

These areas must align closely with the real desktop layout to support direct switching:

1. Left panel width relationship
2. Main container outer padding system
3. Main content panel radius, border, and inset relationship
4. Header and primary input area heights

### Content Density Mapping

| Region | Skeleton Form |
| --- | --- |
| Left nav | Weak logo, 4-6 nav rows, bottom account block |
| Main header | Title row and action row placeholders |
| Primary center area | Large input-like block |
| Supporting content | Top card row plus lower neutral content blocks |

## Lifecycle

```text
Desktop window opens
  -> apps/desktop/index.html renders static shell skeleton
  -> entry.desktop.tsx mounts React
  -> SPAGlobalProvider removes #loading-screen
  -> real desktop layout appears directly
```

## Visual Rules

- Do not show a centered brand loading page anymore
- Keep brand presence subtle and integrated into the left panel
- Do not animate the handoff to the real UI
- Do not overfit the shell to one concrete page's content
- Follow light/dark theme initialization already present in `index.html`

## Risks

| Risk | Mitigation |
| --- | --- |
| Static shell drifts from React layout over time | Match only major geometry anchors, not every leaf component |
| User-customized nav width differs from startup width | Use the default desktop shell width and accept minor deviation |
| Platform border differences create small mismatches | Align to app-level container geometry, not OS chrome details |
| Users still see route-level brand loading later | Explicitly keep post-boot Suspense fallback out of this change |

## Verification

| Check | Expected Result |
| --- | --- |
| Cold launch | No centered brand splash |
| First visible frame | Looks like the desktop app shell |
| React handoff | Direct switch with no obvious layout jump |
| Dark and light themes | Skeleton matches the active theme's background hierarchy |
| Later route fallback | Unchanged from current behavior |

## File Boundaries

| File | Role |
| --- | --- |
| `apps/desktop/index.html` | Static cold-start shell markup and CSS |
| `src/layout/SPAGlobalProvider/index.tsx` | Existing removal point for `#loading-screen`; no behavior change expected |
| `src/utils/router.tsx` | Existing route-level `BrandTextLoading`; intentionally unchanged |

## Implementation Notes

- Prefer modifying the existing `#loading-screen` structure instead of introducing a second startup container
- Keep the startup shell self-contained in desktop HTML/CSS rather than coupling it to runtime React state
- Match the desktop shell to the real layout at the container level, not component-by-component

## Approval Record

The following decisions were explicitly approved in the terminal discussion:

- Desktop only
- Fixed desktop shell skeleton, not last-page restoration
- Medium fidelity
- Weak brand presence in the top-left
- Direct switch with no transition animation
- Static shell in `index.html` plus existing React removal lifecycle
