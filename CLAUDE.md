# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Fuwari is a static blog template built with Astro 5 and Tailwind CSS, with interactive components in Svelte 5. It uses pnpm as its package manager (`packageManager: pnpm@9.14.4`). Content is authored in Markdown with extended syntax (admonitions, GitHub cards, math via KaTeX).

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Dev server at `localhost:4321` |
| `pnpm build` | Production build → `dist/` (runs `astro build` then `pagefind --site dist`) |
| `pnpm preview` | Preview the production build locally |
| `pnpm check` | Run `astro check` for template/type errors in `.astro` files |
| `pnpm type-check` | Run `tsc --noEmit --isolatedDeclarations` |
| `pnpm format` | Format source with Biome (`biome format --write ./src`) |
| `pnpm lint` | Lint + auto-fix with Biome (`biome check --write ./src`) |
| `pnpm new-post <filename>` | Scaffold a new post in `src/content/posts/` |

There is no test suite.

## Path aliases

Defined in `tsconfig.json`:

| Alias | Target |
|---|---|
| `@/*` | `src/*` |
| `@components/*` | `src/components/*` |
| `@assets/*` | `src/assets/*` |
| `@constants/*` | `src/constants/*` |
| `@utils/*` | `src/utils/*` |
| `@i18n/*` | `src/i18n/*` |
| `@layouts/*` | `src/layouts/*` |

## Architecture

### Routing & page structure

Astro file-based routing with two content collections defined in `src/content/config.ts`: **posts** (blog posts with Zod-validated frontmatter) and **spec** (standalone pages like "about").

Every page inherits a two-level layout chain:

1. **`Layout.astro`** — the `<html>` shell: `<head>` with OG/Twitter meta, favicons, inlined theme-initialization script (light/dark/auto + HSL hue from localStorage), and global `<style>` blocks for banner-related CSS custom properties. Loads KaTeX CSS, Roboto font, PhotoSwipe, and OverlayScrollbars.
2. **`MainGridLayout.astro`** — wraps every page in: sticky navbar (top), optional banner image, a CSS grid sidebar (left: `Profile`, `Categories`, `Tags`), main content area (`<slot>`), footer, a floating TOC on the right (2xl+ screens), and a back-to-top button. On the home page the banner is taller and the main panel overlaps it.

Routes:
- `src/pages/[...page].astro` — paginated post list (home page). Uses `Astro.props.page` from `getStaticPaths` + `paginate()`.
- `src/pages/posts/[...slug].astro` — individual post. Renders `entry.render()` into a `<Markdown>` wrapper. Also renders prev/next navigation and JSON-LD structured data.
- `src/pages/archive.astro`, `src/pages/about.astro`, `src/pages/rss.xml.ts`, `src/pages/robots.txt.ts`

### Client-side interactivity (SPA feel)

**Swup** provides SPA-like page transitions. The main content container is `#swup-container`. Hooks in `Layout.astro`'s `<script>` handle: updating body classes on navigation, hiding/showing the navbar based on scroll position relative to the banner, re-initializing custom scrollbars after content swaps, and managing a temporary page-height extender to prevent scroll jumps during transitions.

**Svelte 5 components** handle interactivity: `Search.svelte` (pagefind-powered search panel), `LightDarkSwitch.svelte`, `DisplaySettings.svelte` (theme color picker), `ArchivePanel.svelte`.

### Content pipeline (remark/rehype)

Posts flow through a chain of unified plugins configured in `astro.config.mjs`:

1. **Remark** (parsed in order): `remarkMath` → `remarkReadingTime` (injects `minutes`/`words` into frontmatter) → `remarkExcerpt` → `remarkGithubAdmonitionsToDirectives` (converts GitHub-style `> [!note]` to `:::note`) → `remarkDirective` (parses `:::directive` syntax) → `remarkSectionize` (wraps content into `<section>` elements) → custom `parseDirectiveNode` (converts directive nodes to HTML for rehype)
2. **Rehype** (serialized in order): `rehypeKatex` → `rehypeSlug` → `rehypeComponents` (maps `:::note`, `:::tip`, `:::important`, `:::caution`, `:::warning`, and `:github` directives to custom Astro/Svelte components) → `rehypeAutolinkHeadings` (appends `#` anchor links)

The admonition and GitHub-card components live in `src/plugins/rehype-component-admonition.mjs` and `src/plugins/rehype-component-github-card.mjs`.

### Theming

Theme is driven by a single HSL `--hue` CSS custom property set on `<html>`. Light/dark mode toggles the `.dark` class on `<html>`. The hue value persists in `localStorage` and is initially carried from the server via a `<div id="config-carrier">` rendered by `ConfigCarrier.astro`. Setting `siteConfig.themeColor.fixed: true` hides the hue picker from users.

### i18n

The i18n system uses an `I18nKey` enum (`src/i18n/i18nKey.ts`) and per-language translation objects in `src/i18n/languages/`. The `i18n(key)` function reads the current language from `siteConfig.lang` at call time. Supported languages: en, zh_CN, zh_TW, ja, ko, es, th, vi, tr, id.
