# blip

Claude Code as an API. Send a prompt, get an autonomous coding agent that clones repos, writes code, and opens PRs.

## How it works

1. **Create an API key** at [blip.exla.ai](https://blip.exla.ai)
2. **Send a prompt** via the REST API
3. **Get results** — the agent runs in a secure sandbox and returns what it did

```bash
curl -X POST https://blip.exla.ai/api/v1/executions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Go to github.com/openclaw/openclaw, pick up the latest issue, and open a PR with the fix"
  }'
```

Each execution spins up an isolated [E2B](https://e2b.dev) sandbox with Claude Code pre-installed. The agent has full access to bash, git, gh, and all Claude Code tools. When it's done, you get back a description of what it did.

## API

### Create an execution

```
POST /api/v1/executions
```

```json
{
  "prompt": "Clone myorg/myrepo and add input validation to the signup endpoint",
  "agent_id": "optional-environment-id",
  "anthropic_api_key": "optional-inline-key"
}
```

- `prompt` — what the agent should do (required)
- `agent_id` — use a custom environment (optional, uses default if omitted)
- `anthropic_api_key` — Anthropic API key (optional, stored on first use)

### Check execution status

```
GET /api/v1/executions/:id
```

Returns status, result text, cost, duration, and event log.

### List executions

```
GET /api/v1/executions
```

### Environments (optional)

Environments let you customize the sandbox — custom Dockerfiles, CLAUDE.md instructions, MCP servers, environment variables. The default environment works out of the box.

```
POST /api/v1/agents          # create environment
GET  /api/v1/agents           # list environments
GET  /api/v1/agents/:id       # get environment
PATCH /api/v1/agents/:id      # update environment
DELETE /api/v1/agents/:id     # delete environment
POST /api/v1/agents/:id/build # build custom template
```

### API Keys

```
POST /api/v1/api-keys         # create key
GET  /api/v1/api-keys          # list keys
DELETE /api/v1/api-keys/:id    # revoke key
```

Authentication: `Authorization: Bearer blip_...` or `x-api-key: blip_...`

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌───────────┐
│  REST API    │────▶│   Supabase   │────▶│   Worker    │────▶│ E2B Sandbox│
│  (Next.js)  │     │  (Postgres   │     │  (pgmq      │     │ (Claude   │
│              │     │   + pgmq)    │     │   consumer) │     │   Code)   │
└─────────────┘     └──────────────┘     └─────────────┘     └───────────┘
```

- **Web app**: Next.js on Fly.io — dashboard + API routes
- **Auth**: Clerk (GitHub/Google OAuth)
- **Database**: Supabase (Postgres + pgmq for job queue)
- **Sandboxes**: E2B — isolated VMs with Claude Code pre-installed
- **Worker**: Bun process that consumes jobs from pgmq, creates E2B sandboxes, runs the agent

## Project structure

```
apps/
  web/          # Next.js dashboard + API
  worker/       # Job consumer (pgmq → E2B)
packages/
  shared/       # Types, schemas, crypto
  db/           # Supabase client + repositories
  e2b/          # Sandbox manager + template builder
  cli/          # CLI tool (npx @blip/cli push)
runner/         # Agent runner script (runs inside sandbox)
supabase/       # Migrations
```

## Development

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Fill in Clerk, Supabase, E2B, and Stripe keys

# Run database migrations
npx supabase db push

# Start dev server
bun run dev:web

# Start worker (separate terminal)
bun run dev:worker

# Build runner for sandbox
bun run build:runner
```

## Deployment

Deployed on Fly.io at [blip.exla.ai](https://blip.exla.ai).

```bash
fly deploy
```

## License

Private — Exla, Inc.
