# AI Disclosure

This project uses AI tools and AI models as part of both the product experience and the development workflow.

## In-App AI Usage

Pixie is an AI assistant application. User messages may be sent to selected AI model providers to generate responses, reason through tasks, and decide when to use available tools.

Depending on the selected model and configuration, the app may use:

- OpenAI models
- Anthropic models
- Google Gemini models
- Groq-hosted models
- OpenRouter-hosted models

The model provider is selected through the app's model configuration and API key mode.

## AI-Assisted Features

AI is used for:

- Conversational assistant responses
- Tool selection and reasoning
- Database question answering using schema-aware SQL tools
- Summarizing and presenting query results
- Commute planning assistance
- Calendar-aware assistant responses
- Telegram assistant replies and notifications
- Voice transcription through OpenAI audio transcription models
- Voice output through browser speech synthesis or ElevenLabs text-to-speech

## Tool Use and External Services

The assistant can call project-defined tools to complete user requests. These tools may access:

- Supabase data and chat history
- Database schema information
- Google Calendar events, when connected by the user
- TomTom routing and traffic data
- Telegram messaging APIs, when connected by the user
- ElevenLabs voice generation, when configured

The assistant is instructed to use tools only when needed and to avoid guessing when tool-backed data is required.

## Development Use of AI

AI coding assistance was used during development to help:

- Inspect and explain code
- Draft and edit documentation
- Implement and debug application features
- Improve voice recognition fallback behavior
- Generate this disclosure document

AI-generated changes were reviewed and applied within the project workspace before being saved.

## Human Oversight

AI output may be incorrect, incomplete, or outdated. Important behavior, especially database writes, external notifications, calendar actions, and commute recommendations, should be reviewed and tested before relying on it in production.

The app includes safeguards such as schema-first database reasoning and preview-before-commit write operations, but these safeguards do not remove the need for human review.

## Data Handling Notice

When users interact with AI features, relevant inputs may be sent to configured third-party AI providers or service APIs to fulfill the request. This can include chat messages, voice recordings for transcription, query context, calendar context, location context, or tool results, depending on the feature used.

Do not enter sensitive data unless the deployment, provider configuration, and data handling policies are appropriate for that use.

## Configuration

AI and integration behavior is controlled through environment variables such as:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY`
- `TOMTOM_API_KEY`
- `GOOGLE_CLIENT_ID`
- `TELEGRAM_BOT_TOKEN`

Only configure providers and integrations that are intended for the deployment.
