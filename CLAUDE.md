# SiteWatch

Personal open-source project. See PLAN.md for the current plan and docs/KICKOFF.md for the original spec.

## Identity and accounts (strict)

- Git commits must use `Chris Betz <scrapdog@gmail.com>` (set in this repo's local config; never fall back to the global identity).
- GitHub: personal namespace `github.com/cbetz` only. Never any org.
- Vercel: personal org `betz` only.
- Cloudflare and Expo: personal accounts only.
- Never reference, use, or link any employer account, organization, credential, internal tool, or project in this repo's code, docs, comments, commit messages, or PRs.

## Conventions

- TypeScript throughout. Expo (expo-router) client, Hono on Cloudflare Workers server.
- No emojis in code, docs, comments, or commit messages.
- Politeness is a feature: honest User-Agent, jitter, backoff, kill switch, scan only watched campgrounds. Never automate booking.
- Secrets (RIDB key) live in .dev.vars / Wrangler secrets, never in the repo.
