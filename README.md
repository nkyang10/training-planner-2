# training-planner — PoC2 workspace

This folder is the clean **PoC2** environment. Nothing from PoC1 is assumed here: no stack, no architecture, no
contracts. The brief for PoC2 has not been given yet; when it arrives it is written to
[`docs/POC2-BRIEF.md`](docs/POC2-BRIEF.md) first, and the structure follows the brief.

## PoC1 archive

PoC1 is preserved at `../training-planner-poc1`.

| Fact | Value |
|---|---|
| Path | `C:\Users\MY\Desktop\Development\training-planner-poc1` |
| Git HEAD | `540095a` (`fix(web): request a program from the calendar and read the API plan firstDay`, PR #90) |
| History | PRs #66–#90, ADR-0001…0012 |
| Tests at archive | 842/842 in 51 files |
| Data | `data/local.sqlite` and `data/uploads/` copied; `node_modules` excluded |
| GitHub | `https://github.com/nkyang10/training-planner` |

To run PoC1 again:

```powershell
cd C:\Users\MY\Desktop\Development\training-planner-poc1
pnpm install
# API
$env:API_TOKENS='{"demo-token":"d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3"}'
$env:TRAINING_PLANNER_DB='sqlite:data/local.sqlite'
$env:PORT='8082'
npx tsx apps/api/src/index.ts
# Web (second terminal)
$env:API_TOKENS='{"demo-token":"d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3"}'
$env:TRAINING_PLANNER_DB='sqlite:data/local.sqlite'
$env:PORT='8081'
$env:TRAINING_PLANNER_API_URL='http://127.0.0.1:8082'
npx tsx apps/web/src/index.ts
```

`pnpm install` is required once because `node_modules` was not archived.

## PoC2 repository

| Fact | Value |
|---|---|
| GitHub | https://github.com/nkyang10/training-planner-2 |
| Visibility | public |
| Default branch | `main` |
| Remote | `origin` -> `https://github.com/nkyang10/training-planner-2.git` |

## PoC2 status

- [x] PoC1 archived and verified (clean working tree, git history intact)
- [x] Empty workspace prepared
- [ ] PoC2 brief received
- [ ] PoC2 structure created from the brief

Until the brief is received, this workspace intentionally contains only documentation.
