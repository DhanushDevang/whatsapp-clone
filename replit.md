# WhatsApp Clone

A full-stack real-time messaging app modeled after WhatsApp, with auth, conversations, text/image/voice messages, dark mode, wallpapers, and message deletion.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/whatsapp-clone run dev` — run the frontend (port 19720)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `JWT_SECRET` — JWT signing secret (defaults to dev value if not set)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/whatsapp-clone)
- API: Express 5 + Socket.io (artifacts/api-server)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Auth: JWT (bcryptjs + jsonwebtoken)
- Voice storage: Supabase Storage (for audio blobs)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/whatsapp-clone/src/pages/` — AuthPage, ChatPage
- `artifacts/whatsapp-clone/src/context/AuthContext.tsx` — JWT auth context
- `artifacts/whatsapp-clone/src/socket.ts` — Socket.io client (path: /api/socket.io)
- `artifacts/whatsapp-clone/src/supabase.ts` — Supabase client (voice uploads)
- `artifacts/api-server/src/routes/` — auth, conversations, messages routes
- `artifacts/api-server/src/middleware/auth.ts` — JWT middleware
- `lib/db/src/schema/index.ts` — DB schema (users, conversations, participants, messages)
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- Socket.io is served at `/api/socket.io` path so it passes through the shared `/api` proxy correctly.
- Message delete endpoints use POST (not DELETE/PATCH) because path params caused Orval type collision with `*Params` naming.
- Supabase Storage is used for voice message uploads (original app used it, retained for parity).
- Frontend uses plain `fetch` with JWT bearer tokens instead of the generated React Query hooks, since the original app pattern was imperative (axios-based).
- Socket.io handles real-time delivery; API handles persistence.

## Product

- Register/login with Gmail-only email validation and special-character password requirements
- Real-time 1:1 messaging via Socket.io
- Text, image (base64, up to 5MB), and voice messages (uploaded to Supabase)
- Voice transcription via Web Speech API
- Right-click context menu to delete messages (for me / for everyone)
- Dark mode toggle and chat wallpaper customization
- Online/offline presence indicators

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec change.
- Socket.io path is `/api/socket.io` — do not change without also updating `artifacts/whatsapp-clone/src/socket.ts`.
- DB push: `pnpm --filter @workspace/db run push` after schema changes.
- Voice messages require Supabase Storage bucket `chat-images` to exist and be public.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
