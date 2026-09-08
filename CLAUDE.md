# vegvisr-chat — Claude Code Instructions

## MANDATORY — read `_project/lessons_learned.md` BEFORE EVERY RESPONSE

Not per session. **Per response.** The full file, with the Read tool. Token cost is not a
consideration. If you are about to send any reply that involves code, commits, claims about
state, design decisions, or interpreting an instruction — open the file first. The Read call
is visible in the transcript; that's the proof it happened.

**Companion docs** (read in order): [_project/lessons_learned.md](./_project/lessons_learned.md) (failure patterns + active improvements — READ FIRST) · [_project/STATUS.md](./_project/STATUS.md) · [_project/TODO.md](./_project/TODO.md) · [_project/PLAN.md](./_project/PLAN.md) · [_project/TEST_PLAN.md](./_project/TEST_PLAN.md).

---

## Project Overview

vegvisr-chat is a React 19 + TypeScript + Vite chat app using vegvisr-ui-kit and react-markdown for rich markdown rendering.

## Commands

- `npm run dev` — Start dev server
- `npm run build` — TypeScript compile + Vite production build
- `npm run lint` — Run ESLint
- `npm run preview` — Preview production build locally

## Conventions

- Follow the universal working rules in `~/.claude/CLAUDE.md`.
- Read existing components before creating new ones (search/grep first).
- Reuse vegvisr-ui-kit components when available.
- Slice = one file or one tightly coupled pair, verified before the next.
