# Compatibility report — `payload-react-router`

Payload `4.0.0-canary.39` · React Router `8.4.0` (RSC Framework Mode) · `@vitejs/plugin-rsc` `0.5.35`
· React `19.3.0` · Node `24.21` · SQLite. Measured on 2026-10-08.

## What was run, and what was not

| Bench | Where | Status |
| --- | --- | --- |
| **Adapter bench**: 26 Playwright tests on the demo app | demo app repository (private), CI job `payload-e2e` | ✅ run, both modes |
| Adapter unit tests: 15 `node:test` cases, `test/` | this repo, CI job `checks` | ✅ run |
| **Payload's own e2e suites** (`test/*/e2e.spec.ts`, as the TanStack adapter runs them) | Payload monorepo only | ❌ **not run** |

Payload's suites boot their own test configs through `test/dev.ts` and choose the framework
with `PAYLOAD_FRAMEWORK` (`next` / `tanstack-start`). Wiring React Router into them means
editing `test/`, the CLI's framework detection and the CI matrix inside a fork of
`payloadcms/payload` (NOTES.md §3, decision D2). This work was done outside that monorepo, so the
per-suite pass rates against Next and TanStack that the brief asked for **have not been
measured**. The tables below compare scenarios, not suite pass rates.

## Adapter bench results

| Mode | Command | Result | Duration |
| --- | --- | --- | --- |
| production | `react-router build` + `react-router-serve` | **26 / 26** | 32 s |
| development | `vite dev` | **26 / 26** | 1 min 42 s (cold optimizer) |

Each run starts on an empty SQLite database. In production the schema comes from the
committed migrations (`prodMigrations`); in development it is pushed.

| # | Area (brief §3) | Scenario | prod | dev |
| --- | --- | --- | :-: | :-: |
| 1 | accounts | empty DB: `/admin` → create-first-user → dashboard | ✅ | ✅ |
| 2 | login/logout | unauthenticated admin route → 302 to `/admin/login?redirect=…` | ✅ | ✅ |
| 3 | login/logout | wrong password shows an error | ✅ | ✅ |
| 4 | login/logout | login → account page → logout clears the cookie | ✅ | ✅ |
| 5 | documents | create / edit / delete from the document controls | ✅ | ✅ |
| 6 | list view | pagination, search, sort | ✅ | ✅ |
| 7 | navigation | client-side navigation keeps the document (no reload) | ✅ | ✅ |
| 8 | not found | unknown admin route → Payload not-found view, HTTP 404 | ✅ | ✅ |
| 9 | autosave + versions | autosave on `/create` redirects to the new id (redirect raised inside a server view), then publish | ✅ | ✅ |
| 10 | versions | versions view lists versions | ✅ | ✅ |
| 11 | uploads (local) | upload an image, file served back by `/api/media/file/…` | ✅ | ✅ |
| 12 | Lexical | text typed in the editor is saved and rendered on the website | ✅ | ✅ |
| 13 | locales | edit a localized field in `fr`; `en` value untouched | ✅ | ✅ |
| 14 | locales / server functions | admin language switch sets `payload-lng` via a server function (`req.server.setCookie`) | ✅ | ✅ |
| 15 | globals | edit a global; the website shows it | ✅ | ✅ |
| 16 | relations | set a relationship from the admin | ✅ | ✅ |
| 17 | headless / Local API | website loaders list published posts; drafts are hidden and 404 | ✅ | ✅ |
| 18–26 | REST / GraphQL | paginated find; login `Set-Cookie` (HttpOnly) + `/me` + logout; access control for anonymous reads; create/update/delete; 400 validation; 404 unknown route; globals + `?locale`; GraphQL query; CORS preflight | ✅ | ✅ |

The REST/GraphQL assertions check Payload's own response contract (`handleEndpoints` and
the GraphQL handler are the same code Next.js and TanStack call). There is no Next app in this
repo to diff against, so "same responses as Next" is established by construction, not by a
side-by-side run.

One difference between modes is expected and asserted: under `vite dev`, Vite's own CORS
middleware answers `OPTIONS` (204) before React Router sees it; in production Payload answers
(200).

## Not covered

| Area (brief §3) | Why |
| --- | --- |
| S3 uploads | needs an S3 endpoint; untested |
| Live preview | not configured in the demo |
| Postgres | only SQLite was run |
| Permissions beyond admin / anonymous | the demo has a `role` field but no role-based rules |
| Payload's own e2e suites (auth, fields, collections, versions, uploads) | see above |

## Scenarios TanStack skips, checked here

From `test/**/e2e.spec.ts` in the Payload monorepo (`{ framework: 'next' }` gating):

| TanStack skip | Reason upstream | React Router |
| --- | --- | --- |
| `admin-root` (whole suite) | admin mounted at `/` unsupported | not tested |
| `uploads` `/_next/image` assertion | Next-only URL | not applicable |
| `locked-documents`, `plugin-multi-tenant` | inspect Next's server-action wire format | not tested; RR uses the same React Flight protocol, but a different action transport |
| autosave redirect on create (TanStack needed an internal stream symbol) | redirect raised during streaming | ✅ scenario 9, without framework internals |

## Failure classification

All 26 scenarios pass in both modes, so there are no failures to classify yet. Problems hit
while getting there, and where they belong:

| Problem | Class | Detail |
| --- | --- | --- |
| Server functions re-rendered the whole route on every call | RR-specific | fixed with React Router's `$SKIP_REVALIDATION` opt-out (NOTES.md P11) |
| `OPTIONS` from a resource-route middleware rendered as HTML | RR-specific (React Router bug) | worked around (P10) |
| `@vitejs/plugin-rsc` 0.5.26 / 0.5.36 break the build | RR-specific (version window) | pinned 0.5.35 (P12) |
| `process.env.NEXT_PUBLIC_*` read in `@payloadcms/ui` browser code | shared with TanStack | Vite transform (P13) |
| Clicks lost before hydration | shared with TanStack | hydration flag for tests |
| Payload CLI does not detect React Router | shared (any new framework) | `importMapFile` (P4) |
| GraphQL not served by `handleEndpoints` | shared with TanStack (its demo app does not route it) | ported the GraphQL handler |
