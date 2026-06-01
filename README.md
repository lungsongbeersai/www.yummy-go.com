# Yummy Go Rebuild

Clean rebuild of the Yummy Go restaurant POS inside `New-yummy-go.com`.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn-style local UI primitives
- Zustand
- Axios services
- Socket.IO client
- Electron customer display

## Environment

Copy `.env.example` to `.env.local` and adjust values when needed.

```env
NEXT_PUBLIC_BASE_URL=https://api.yummy-go.com
NEXT_PUBLIC_PRINTER_AGENT_URL=http://127.0.0.1:7777
NEXT_PUBLIC_PRINTER_AGENT_SECRET=edsRpZ94w15vQS0zJR1gD1uuzQjB50KFcZJloqsJh8h
```

## Scripts

- `npm run dev`
- `npm run dev:desktop`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
# www.yummy-go.com
