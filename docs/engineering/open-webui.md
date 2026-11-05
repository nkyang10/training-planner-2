# Open WebUI as the PoC2 chat surface

Open WebUI is used as-is; it is not forked. PoC2 registers its coach gateway as an OpenAI-compatible model.

## 1. Start the container

```powershell
docker run -d --name open-webui-poc2 -p 3010:8080 -v open-webui-poc2:/app/backend/data `
  --restart unless-stopped ghcr.io/open-webui/open-webui:main
```

Open WebUI is then at `http://127.0.0.1:3010`; its data volume keeps users and settings across restarts.

## 2. First user (admin)

```powershell
$signup = @{ name = 'Owner'; email = 'owner@poc2.local'; password = '<password>' } | ConvertTo-Json
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/api/v1/auths/signup' -Method Post `
  -ContentType 'application/json' -Body $signup -UseBasicParsing
```

The first account becomes the admin. Sign in via `POST /api/v1/auths/signin` to get a bearer token.

## 3. Register the coach gateway

Open WebUI 0.11 keeps the OpenAI connection in its own config, so environment variables alone are not enough. With the
admin bearer token:

```powershell
$config = @{
  ENABLE_OPENAI_API = $true
  OPENAI_API_BASE_URLS = @('http://host.docker.internal:8090/v1')
  OPENAI_API_KEYS = @('poc2-local')
  OPENAI_API_CONFIGS = @{}
} | ConvertTo-Json -Depth 5
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/openai/config/update' -Method Post `
  -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } `
  -Body $config -UseBasicParsing
```

`GET /openai/config` shows the current connection; `GET /api/models` must list `poc2-coach`.

## 4. Verify a turn

```powershell
$body = @{ model='poc2-coach'; stream=$false; messages=@(@{role='user'; content='Plan my next week, 3 runs.'}) } | ConvertTo-Json -Depth 6
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/api/chat/completions' -Method Post `
  -ContentType 'application/json; charset=utf-8' -Headers @{ Authorization = "Bearer $token" } `
  -Body ([Text.Encoding]::UTF8.GetBytes($body)) -UseBasicParsing
```

The reply is the coach's language; the sessions it booked are in `http://127.0.0.1:8091/calendar` and the memories are in
SQLite. PowerShell displays UTF-8 JSON as Latin-1 when the response has no charset, so decode the raw bytes as UTF-8 when
checking Chinese output.

## What Open WebUI does not do

- It does not write the calendar; the gateway does, after validation.
- It does not remember the runner; memories live in PoC2's SQLite, not in Open WebUI's chat store.
- Deleting a chat in Open WebUI does not delete PoC2 memories or sessions.
