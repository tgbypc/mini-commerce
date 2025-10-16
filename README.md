This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testing & Quality

Run the lint, unit/integration, and Playwright smoke suites:

```bash
npm run lint
npm run test -- --run
npm run dev # start the app in another terminal
npm run test:e2e
```

The unit suite is powered by Vitest + Testing Library; Playwright provides lightweight end-to-end coverage for checkout and favorites flows. These are the same commands you can plug into a CI pipeline.
