# blip

`blip` is a greenfield BYOK control plane for the Claude Agent SDK:

- Cognito Hosted UI for sign-up
- service API keys for callers
- API Gateway + Lambda control plane
- Fly Machines data plane with one ephemeral machine per conversation
- direct bootstrap and SSE from Fly so the user Claude key is kept out of DynamoDB

## What is implemented

- `POST /v1/api-keys`
- `GET /v1/api-keys`
- `DELETE /v1/api-keys/{keyId}`
- `POST /v1/sessions`
- `GET /v1/sessions/{sessionId}`
- `POST /v1/sessions/{sessionId}/messages`
- `POST /v1/sessions/{sessionId}/stream-token`
- `DELETE /v1/sessions/{sessionId}`
- Fly runner endpoints:
  - `POST /bootstrap`
  - `GET /events`
  - `GET /heartbeat`
  - `POST /messages`

## Repo layout

- `src/control-plane/`: auth, repositories, services, and Lambda HTTP routing
- `src/runner/`: Fly session runner built on `@anthropic-ai/claude-agent-sdk`
- `src/infra/`: CDK stack for Cognito, API Gateway, Lambda, DynamoDB, EventBridge, and Secrets Manager
- `test/`: contract and service lifecycle tests

## Important behavior

- Only one active session is allowed per user/API key in v1.
- Each session is destroyed on explicit delete, 15 minutes of idle time, or 2 hours of total lifetime.
- `effort` is exposed as `low | medium | high` and mapped to thinking budgets:
  - `low = 1024`
  - `medium = 4096`
  - `high = 8192`
- Public `agent_options` reject raw `thinking`, `maxThinkingTokens`, `sessionId`, `resume`, and other unsafe/non-serializable SDK fields.
- The Fly runner stores the Claude API key only in memory after `POST /bootstrap`.
- Session transcripts live only on the Fly machine's ephemeral disk while the machine exists.

## Local commands

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Compile:

```bash
npm run build
```

Run the Fly runner locally:

```bash
BLIP_SESSION_CONFIG_B64="$(printf '%s' '{"sessionId":"00000000-0000-0000-0000-000000000000","model":"claude-sonnet-4-6","effort":"medium","agentOptions":{},"workspaceDir":"/tmp/blip"}' | base64)" \
BLIP_RUNNER_SHARED_SECRET="runner-secret" \
BLIP_SESSION_TOKEN_SECRET="session-secret" \
npm run dev:runner
```

## Deploy flow

1. Build and push the Fly runner image.
2. Create the Fly app or update `fly.toml` with the real app name.
3. Deploy the runner image to Fly.
4. Synthesize and deploy the CDK stack:

```bash
npm run synth -- \
  -c flyAppName=blip-runner \
  -c flyMachineImage=registry.fly.io/blip-runner:latest \
  -c cognitoDomainPrefix=blip-auth
```

5. After the stack creates `FlyApiTokenSecretArn`, replace that generated secret value with a real Fly token that can create and destroy Machines.
6. Use the stack outputs for:
  - API URL
  - Cognito User Pool ID
  - Cognito User Pool Client ID
  - Hosted UI domain

## Example API flow

1. Sign in with Cognito Hosted UI and get an access token.
2. Call `POST /v1/api-keys` with that access token to mint a service API key.
3. Call `POST /v1/sessions` with the service API key and body:

```json
{
  "model": "claude-sonnet-4-6",
  "effort": "medium",
  "agent_options": {
    "allowedTools": ["Read", "Write", "Bash"],
    "permissionMode": "default"
  }
}
```

4. Use the returned `bootstrap_url` to send the user's Claude API key directly to Fly.
5. Open the returned `events_url` as SSE.
6. Send prompts through `POST /v1/sessions/{sessionId}/messages`.
7. Refresh SSE credentials through `POST /v1/sessions/{sessionId}/stream-token` if needed.
8. Delete the session when done.

## Current limitations

- `POST /messages` is buffered via the control plane; live token streaming is delivered only through the Fly SSE endpoint.
- The CDK stack creates a placeholder Fly API token secret that must be replaced manually after deploy.
- The DynamoDB session cleanup path currently scans the sessions table, which is acceptable for v1 but not optimized for large scale.
