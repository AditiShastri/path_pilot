# Pixie

Pixie is a personal AI assistant built with Next.js. It combines chat, voice, database-aware tools, commute planning, Google Calendar context, and Telegram notifications into one authenticated assistant experience.

The app is designed for real workflows rather than a demo-only chat box: users sign in, keep chat history, connect external services, ask questions over text or voice, inspect database data safely, and plan commutes with live route data.

## Features

- Authenticated chat workspace with saved conversations
- Multi-provider model routing through OpenAI, Anthropic, Google, Groq, and OpenRouter
- Voice assistant mode with browser speech output, ElevenLabs output, and server-side transcription fallback
- Supabase-backed chat storage and user session handling
- Schema-aware SQL assistant tools for safe read queries
- Preview-and-confirm flow for write SQL operations
- Google Calendar connection and event lookup
- Commute planning with TomTom routing and traffic estimates
- Telegram linking, outbound notifications, and webhook support
- Excel export support for tabular data
- Tool-call rendering for charts, tables, SQL previews, and assistant actions

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Vercel AI SDK
- Supabase Auth and database APIs
- OpenAI SDK for audio transcription
- ElevenLabs text-to-speech
- Google Calendar API
- Telegram Bot API
- TomTom routing and geocoding APIs

## Project Structure

```text
src/
  app/
    ai-assistant/        Chat and voice assistant UI
    api/                 Route handlers for AI, chat, calendar, Telegram, exports
    auth/                Supabase auth callback
    login/               Login page
    signup/              Signup page
  components/ui/         Shared UI components
  hooks/                 Browser hooks such as location/audio helpers
  lib/
    ai/                  Model resolution and AI helpers
    tools/               Assistant tools for SQL, commute, calendar, Telegram
    supabase/            Server/admin Supabase clients
    systemPrompt.ts      Main assistant instructions
```

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project
- At least one model provider API key
- Optional service keys for voice, maps, calendar, and Telegram integrations

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local` in the project root and add the variables you need:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
GROQ_API_KEY=
OPENROUTER_API_KEY=

ELEVENLABS_API_KEY=
NEXT_PUBLIC_ELEVENLABS_VOICE_ID=
NEXT_PUBLIC_ELEVENLABS_MODEL_ID=eleven_turbo_v2_5

TOMTOM_API_KEY=
NEXT_PUBLIC_TOMTOM_API_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/calendar/callback

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

TAVILY_API_KEY=
CRON_SECRET=
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Required for core app usage:

- `NEXT_PUBLIC_BASE_URL`: Public base URL used for auth redirects and API callbacks
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, or `OPENROUTER_API_KEY`: AI provider keys, depending on the selected model

Required for privileged server operations:

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for admin-only server tasks

Optional integrations:

- `ELEVENLABS_API_KEY`: ElevenLabs voice output
- `NEXT_PUBLIC_ELEVENLABS_VOICE_ID`: ElevenLabs voice ID override
- `NEXT_PUBLIC_ELEVENLABS_MODEL_ID`: ElevenLabs model override
- `TOMTOM_API_KEY`: Server-side routing and commute planning
- `NEXT_PUBLIC_TOMTOM_API_KEY`: Browser reverse geocoding for current location
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`: Google Calendar OAuth
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`: Telegram bot and webhook integration
- `TAVILY_API_KEY`: Search tooling, if enabled
- `CRON_SECRET`: Protects scheduled reminder endpoints

Never commit `.env.local` or service role keys.

## Available Scripts

```bash
npm run dev
```

Runs the development server.

```bash
npm run build
```

Creates a production build.

```bash
npm run start
```

Starts the production server after a build.

```bash
npm run lint
```

Runs the configured lint command.

## Voice Assistant

Pixie supports text chat and voice mode. Voice input records audio in the browser and sends it to `/api/ai/voice/transcribe` for transcription. Voice output can use either browser speech synthesis or ElevenLabs through `/api/ai/voice/elevenlabs/stream`.

For best local results:

- Use `localhost` or HTTPS so browser microphone APIs are available
- Ensure `OPENAI_API_KEY` is set for transcription
- Set `ELEVENLABS_API_KEY` only if you want ElevenLabs speech output

## Database and SQL Tools

Pixie can inspect database schema and run safe read queries through assistant tools. Write operations use a preview-first pattern:

1. Preview the write in a rollback transaction
2. Show the generated operation to the user
3. Commit only after explicit confirmation

Schema context lives in:

```text
src/lib/tools/schema-info.yaml
```

## Calendar, Commute, and Telegram

Pixie can connect to Google Calendar, reason about upcoming events, plan commutes, and send Telegram notifications.

Common setup notes:

- Configure Google OAuth redirect URI to match `/api/calendar/callback`
- Set TomTom keys before using route or commute planning
- Configure Telegram webhook URL to point to `/api/telegram/webhook`
- Use `TELEGRAM_WEBHOOK_SECRET` to validate webhook calls

## Development Notes

- This repository uses Next.js 16. Before changing framework-specific behavior, read the relevant guide in `node_modules/next/dist/docs/`.
- The app uses App Router route handlers under `src/app/api`.
- Some local development state is stored in Supabase and browser local storage.
- A large `demo.mp4` exists in the project root; keep large media out of future commits unless it is intentional.

## Known Issues

At the time this README was written, `npx tsc --noEmit` reports unrelated existing UI type errors in:

- `src/components/ui/resizable-navbar.tsx`
- `src/components/ui/response-stream.tsx`
- `src/components/ui/text-shimmer.tsx`

Fix those before treating typecheck as a clean CI gate.

## Deployment

Deploy as a standard Next.js app. Make sure production environment variables are configured in the hosting platform, especially Supabase, model provider keys, and callback URLs.

Production checklist:

- Set `NEXT_PUBLIC_BASE_URL` to the production URL
- Update Supabase auth redirect URLs
- Update Google OAuth redirect URI
- Update Telegram webhook URL
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- Confirm microphone features are served over HTTPS

## License

This project is private. Add a license before distributing or open-sourcing it.
