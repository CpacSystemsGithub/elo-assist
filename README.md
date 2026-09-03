# elo-assist

A Next.js 16 app using the App Router, Tailwind CSS v4, shadcn/ui (Base UI), and Supabase.

## Requirements

- Node.js 20 or later
- A Supabase project

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
   ```

   Both values come from your Supabase project under **Project Settings → API Keys**.

3. Start the dev server:

   ```bash
   npm run dev
   ```

   The app runs at http://localhost:3000.

## Scripts

| Command             | Description                                    |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the development server                   |
| `npm run build`     | Create a production build                      |
| `npm run start`     | Serve the production build (run `build` first) |
| `npm run lint`      | Run ESLint                                     |
| `npm run format`    | Format `.ts`/`.tsx` files with Prettier        |
| `npm run typecheck` | Type-check the project without emitting output |

## Adding components

To add shadcn/ui components, run:

```bash
npx shadcn@latest add button
```

Components are placed in `components/ui`.

## Using components

```tsx
import { Button } from "@/components/ui/button";
```

## Project structure

| Path              | Contents                                                       |
| ----------------- | -------------------------------------------------------------- |
| `app/`            | App Router routes, layout, and global styles                   |
| `components/`     | Shared React components (`ui/` holds shadcn components)        |
| `hooks/`          | Custom React hooks                                             |
| `lib/`            | Shared utilities                                               |
| `utils/supabase/` | Supabase browser, server, and session-refresh clients          |
| `proxy.ts`        | Root proxy that refreshes the Supabase session on each request |
| `docs/`           | Agent and domain documentation                                 |
