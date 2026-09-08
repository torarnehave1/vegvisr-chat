# vegvisr-chat

Chat app for the Vegvisr ecosystem. React 19 + TypeScript + Vite with vegvisr-ui-kit, react-markdown for rich message rendering, and lucide-react icons.

## Project Documentation

- [CLAUDE.md](./CLAUDE.md) — Project-specific Claude Code instructions
- [_project/lessons_learned.md](./_project/lessons_learned.md) — Engineering discipline & failure patterns (read first per response)
- [_project/STATUS.md](./_project/STATUS.md) — Current state & progress log
- [_project/TODO.md](./_project/TODO.md) — Remaining slices
- [_project/PLAN.md](./_project/PLAN.md) — Implementation plan
- [_project/TEST_PLAN.md](./_project/TEST_PLAN.md) — Test regime

## Prerequisites

- Node.js 18+
- npm or yarn

## Run Locally

```bash
npm install
npm run dev
```

## Build for Production

```bash
npm run build
```

## Technology Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS, PostCSS, Autoprefixer
- **UI Components:** vegvisr-ui-kit, lucide-react
- **Markdown:** react-markdown with remark-gfm and rehype-sanitize
- **Deployment:** Cloudflare Pages (wrangler.toml configured)
