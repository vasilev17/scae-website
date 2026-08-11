# SCAE Website

The main website for **Student Club Aerospace Engineering (SCAE)**

[LinkedIn](https://www.linkedin.com/company/scaebulgaria/posts/?feedView=all)

## Stack

Astro 7 (static) + React 19 islands + TypeScript + Tailwind CSS

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev
```

- Site root redirects to `/bg/` (default locale)
- English version: `/en/`

## Scripts

| Command        | Description                 |
| -------------- | --------------------------- |
| `pnpm dev`     | Start dev server            |
| `pnpm build`   | Production build to `dist/` |
| `pnpm preview` | Preview production build    |
| `pnpm check`   | Astro + TypeScript checks   |
| `pnpm lint`    | ESLint                      |
| `pnpm format`  | Prettier write              |
