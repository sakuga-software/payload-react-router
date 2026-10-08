# Adaptateur React Router v8 pour Payload — NOTES (Phase 0)

> Notes de conception, écrites quand l'adaptateur vivait dans un monorepo privé
> (`sakuga-software/headless-cms-templates`). Dans ce document, `packages/payload-react-router`
> désigne la racine de ce repo, et `apps/web-payload` l'app de démonstration du monorepo privé.

Statut : **Phases 0–3 réalisées** (paquet `packages/payload-react-router`, app `apps/web-payload`,
banc e2e + CI, `COMPAT.md`). Les décisions D1–D4 ont été prises par défaut sur la
recommandation ci-dessous après la consigne « fais l'implémentation complète » — voir §5.

Sources lues (rien n'est cité de mémoire) :

| Source | Révision |
|---|---|
| `payloadcms/payload` `main` | `58fe765` — `v4.0.0-canary.39` (2026-10-08) |
| `remix-run/react-router` `main` | `4fbf607` — `react-router@8.4.0` |
| `apps/web-react-router` (ce repo) | RR `8.3.0`, Vite `8.2.0`, React `19.2.8` (lockfile) |

Les chemins ci-dessous sont relatifs à la racine du repo Payload (`packages/…`, `app-tanstack/…`, `test/…`) ou de React Router (`RR:packages/…`, `RR:docs/…`).

---

## 0. Trois constats qui changent le brief

### 0.1 Contrats et adaptateur TanStack déjà sur `main`

La branche `experiment/framework-adapter-pattern` n'existe plus. `packages/tanstack-start` et `app-tanstack/` sont sur `main` (v4 canary). Les e2e TanStack sont **requis** en CI (`.github/workflows/e2e.config.ts:113-119`, `optional: false`).

Le contrat a évolué depuis les PRs citées dans le brief :

- **#17419** : dispatch unifié des server functions (`createServerFunctionHandler`).
- **#17690** : `initReq` fusionné dans `initAdminContext`. La prop `serverAdapter` de `RootLayout` décrite dans #16840 n'existe plus.
- **#18507** : TanStack aligné sur Next.

**Référence de travail : `main`.**

### 0.2 TanStack n'est **pas** « SSR + loaders » : il utilise du vrai RSC

Le brief met RSC en phase 2 et vise « SSR + loaders comme TanStack ». Ce n'est pas ce que fait TanStack :

- `withPayload` active `tanstackStart({ rsc: { enabled: true } })` et `@vitejs/plugin-rsc` (`packages/tanstack-start/src/withPayload/index.ts:290-292, 359`).
- La vue admin est rendue en payload Flight via `renderServerComponent` (`src/adapters/views/server.tsx:152`), tout comme le layout (`src/adapters/layout/server.ts:90`).
- Chaque résultat de server function passe par `serializeForRsc` (`src/utilities/serializeForRsc.ts:31-151`).

Ce n'est pas un choix de TanStack : **`@payloadcms/ui` suppose RSC.**

- `renderRoot` et `renderNotFoundPage` sont des fichiers `'use server'` / composants async (`packages/ui/src/views/Root/index.tsx:1`, `views/NotFound/page.tsx:1`).
- `RootLayoutContent` est un composant serveur async (`packages/ui/src/layouts/Root/index.tsx:81`).
- Les server functions renvoient des `React.ReactNode` : `RenderDocumentResult.Document` (`packages/ui/src/providers/ServerFunctions/index.tsx:63-67`), `render-list`, `render-field`, `form-state` avec composants custom serveur.
- Le repli « non-RSC » `RenderClientComponent` (`packages/ui/src/elements/RenderServerComponent/clientOnly.tsx`) existe dans le contrat `ComponentRenderer` (`packages/payload/src/admin/adapters/render.ts:10-21`). Mais `ServerProps.renderComponent` n'est lu que par `ui/src/elements/Nav/SidebarTabs`. La vue racine, les vues document/liste et le form-state ne l'utilisent pas.

**Conséquence : sans RSC, l'admin ne peut pas s'afficher sans modifier `@payloadcms/ui`, ce qui est hors périmètre.**

React Router 8.4 propose un **RSC Framework Mode** :

- plugin `unstable_reactRouterRSC` (`RR:packages/react-router-dev/vite.ts:2`) ;
- basé sur le même `@vitejs/plugin-rsc` que TanStack (`RR:packages/react-router-dev/package.json:130`) ;
- loaders et actions qui peuvent renvoyer du JSX ;
- `"use server"` et `unstable_getRequest`.

Il est marqué **expérimental** : « subject to breaking changes in minor/patch releases » (`RR:docs/how-to/react-server-components.md:3,13-15`).

→ **Décision D1 (§5).**

### 0.3 « Le monorepo » : lequel ?

Ce repo (`sakuga-software/headless-cms-templates`) n'est pas le monorepo Payload. Plusieurs livrables du brief n'ont de sens que dans un fork de `payloadcms/payload` :

- `app-react-router` « équivalente à `app-tanstack` » ;
- la suite e2e Payload, qui sélectionne le framework par `PAYLOAD_FRAMEWORK`, cf. §3.

Certains points dépendent du **cœur `payload`**, que le brief interdit de toucher sans accord (cf. §4) :

- la sélection du framework par le CLI ;
- le chemin de l'importMap ;
- la détection `detectFramework`.

→ **Décisions D2 / D3 (§5).**

---

## 1. Inventaire des contrats (`payload` / `@payloadcms/ui`)

Tous les types sont réexportés par `payload` (`packages/payload/src/index.ts:138` → `admin/adapters/index.ts`).

**Aucun champ de config ne sélectionne un adaptateur.** L'adaptateur est injecté par arguments de fonction et se retrouve sur `req.server`.

| # | Contrat | Fichier | Signature (résumé) |
|---|---|---|---|
| C1 | `ServerAdapter` | `payload/src/admin/adapters/server.ts:7-23` | `forbidden(): never` ; `getCookies(): CookieStore \| Promise<…>` ; `getHeaders(): Headers \| Promise<Headers>` ; `notFound(): never` ; `permanentRedirect(path): never` ; `redirect(path): never` ; `setCookie(name, value, opts?): void \| Promise<void>` ; `unauthorized(): never` |
| C1b | `CookieStore`, `CookieOptions` | `…/adapters/cookies.ts:1-15` | `get(name)`, `getAll?()`, `set?()` |
| C2 | `initAdminContext(args)` + `AdminContextCache` | `payload/src/admin/initAdminContext.ts:22-64` (export `payload/internal`) | `{ cache?, canSetHeaders?, configPromise, importMap, key?, overrides?, requestURL?, serverAdapter } → Promise<AdminContext>` ; cache optionnel `getPartial` / `getRequest` / `getLocale` |
| C3 | `RouterAdapterRouter` | `…/adapters/router.ts:26-51` | `back()` ; `push(path, {scroll?})` ; `refresh()` ; `replace(path, {scroll?})` ; `replaceState?(url)` |
| C3b | `LinkAdapterProps` | `…/adapters/router.ts:53-60` | `href`, `prefetch?`, `replace?`, `scroll?`, `ref?` + attributs `<a>` |
| C3c | `RouterAdapterContext` (côté UI) | `ui/src/providers/RouterAdapter/index.tsx:6-48` | valeur `{ Link, params, pathname, router, searchParams }` |
| C4 | `AdminViewAdapter`, `AdminView`, `GenerateViewMetadata` | `…/adapters/views.ts:10-53` | registre `defaultAdminViews` (`ui/src/views/Root/adminViews.tsx:36-55`) |
| C4b | `renderRoot(RenderRootArgs)` | `ui/src/views/Root/index.tsx:34-66` (`'use server'`) | `{ adminViews, config, importMap, initAdminContext, key?, notFound, params: Promise<{segments}>, redirect, searchParams: Promise<…> }` |
| C4c | `renderNotFoundPage` | `ui/src/views/NotFound/page.tsx:19-33` | idem, sans vues |
| C5 | Layout : `RootLayoutProps` | `ui/src/layouts/Root/index.tsx:26-67` | `{ children, config, importMap, initAdminContext, RouterAdapter, serverFunction, fonts?, head?, htmlProps?, additionalDependencyChecks? }` ; variante « données » `getRootLayoutData` + `<RootProviders data RouterAdapter serverFunction>` (`layouts/Root/RootProviders.tsx:37-77`) + `DocumentRoot` |
| C6 | `ComponentRenderer` | `…/adapters/render.ts:10-21` | `RenderServerComponent` (RSC) / `RenderClientComponent` (non-RSC, peu utilisé, cf. 0.2) |
| C7 | `DevReloadStrategy` | `…/adapters/devReload.ts:5-28` | `registerDevReloadStrategy({ connect(onReload) → cleanup })` ; défaut = WebSocket `/_next/hmr` (`payload/src/utilities/nextJsDevReloadStrategy.ts`) |
| C8 | Server functions | `payload/src/admin/functions/index.ts:26-83` ; dispatcher `ui/src/utilities/handleServerFunctions.ts:12-88` | `createServerFunctionHandler({ initAdminContext, serverFunctions?, transformResult? }) → ({config, importMap, name, args}) => Promise<unknown>` ; client `ServerFunctionClient = ({name, args}) => Promise<unknown>` ; 15 noms intégrés (`ui/src/utilities/serverFunctionRegistry.ts:35-51`) |
| C9 | Auth server functions | `payload/src/auth/serverFunctions/{login,logout,refresh,cookies}.ts` | `login({ collection, config, email \| username, password, serverAdapter })` ; écrit le cookie via `serverAdapter.setCookie` |
| C10 | REST / GraphQL | `payload/src/utilities/handleEndpoints.ts:63-76` ; `createPayloadRequestFromWebRequest.ts:16-23` | `handleEndpoints({ config, path?, request: Request }) → Response`, en Web standard pur |

---

## 2. Table de correspondance

> Écart à l'implémentation : le layout n'est **pas** un `Layout` racine qui bascule selon
> `useMatches()`. En RSC, `root.tsx` ne rend que `<Outlet/>` et chaque layout route rend son
> `<html>` (`PayloadAdminLayout` pour l'admin). Le reste de la colonne « React Router » est
> conforme à ce qui a été livré ; détails dans `packages/payload-react-router/README.md`.

Légende des colonnes :
- **Next** = `packages/next/src`
- **TanStack** = `packages/tanstack-start/src`
- **RR prévu** = proposition pour `react-router`, en supposant D1 = RSC

| Contrat | Next | TanStack Start | React Router v8 (prévu) |
|---|---|---|---|
| **C1 ServerAdapter — lecture** (`getHeaders`, `getCookies`) | `adapters/server.ts:31-43` : `headers()` / `cookies()` de `next/headers` (globaux async) | `adapters/server.ts:59-69` : `getRequest()` de `@tanstack/react-start/server` + `parseCookies` | **Mode RSC** : `unstable_getRequest()` (`RR:docs/how-to/react-server-components.md:497-515`). **Repli** : `AsyncLocalStorage<Request>` posé par un `middleware` racine (`RR:…/route-module-annotations.ts:81-84`). Le contrat est sans argument, donc il faut un accès ambiant à la requête (cf. P2). |
| **C1 ServerAdapter — `setCookie`** | `(await cookies()).set(…)` | ajout à `getResponseHeaders()` + sérialiseur maison (`server.ts:21-53`) | Collecteur `Set-Cookie` par requête (dans l'ALS ou le `RouterContextProvider`), recopié sur la `Response` par le middleware racine. Côté RR, plusieurs `Set-Cookie` sont préservés (`RR:packages/react-router/lib/server-runtime/headers.ts:108-120`). |
| **C1 ServerAdapter — `redirect` / `notFound`** | `next/navigation` (erreurs digest `NEXT_REDIRECT`) | Hors rendu : `redirect()` / `notFound()` TanStack. Pendant le rendu : `createPageRenderServerAdapter(nav)` lève `Error('redirect:<url>')` / `Error('not-found')` et enregistre l'intention (`server.ts:117-152`). | Même stratégie en deux temps que TanStack. Pendant le rendu : `Error('redirect:<url>')` / `Error('not-found')`, la convention que `DocumentView` sait déjà avaler (`ui/src/views/Document/index.tsx:502-516`) — **aucun changement UI**. Le loader relit ensuite l'intention et fait `throw redirect(url)` / `throw data(null, {status: 404})` (`RR:…/router/utils.ts:2128,2178`). |
| **C1 ServerAdapter — `permanentRedirect` / `forbidden` / `unauthorized`** | `next/navigation` | `redirect` simple ; `Error` générique (`server.ts:83-100`) | `redirect(url, 308)` ; `throw data(null, {status: 403 / 401})`, donc mieux que TanStack |
| **C2 initAdminContext + cache** | `utilities/initAdminContext.ts:13-33` : `selectiveCache` = React `cache()` | `utilities/initAdminContext.server.ts:16-24` : `requestURL: getRequest().url`, sans cache | Wrapper qui lie `serverAdapter` + `requestURL`. En mode RSC, `React.cache()` est disponible (env `react-server`), donc on prend le cache façon Next. Sinon, cache dans l'ALS de la requête. |
| **C3 Router — `push` / `replace`** | `useRouter()` Next | `router.navigate` + normalisation `to` / `search` (`router.tsx:113-133`) | `useNavigate()(path, { replace, preventScrollReset: !scroll })` (`RR:…/hooks.tsx:218-221`). Pas de sérialiseur `qs` global : RR garde la query brute. |
| **C3 Router — `back`** | `router.back()` | `router.history.back()` | `navigate(-1)` |
| **C3 Router — `refresh`** | `router.refresh()` (RSC) | `router.invalidate()` | `useRevalidator().revalidate()` (`RR:…/hooks.tsx:1541-1555`, renvoie une `Promise`) |
| **C3 Router — `replaceState`** | `window.history.replaceState` | idem, entouré de `_ignoreSubscribers` (`router.tsx:155-170`) | `window.history.replaceState` direct (RR n'observe pas l'History API) — **à vérifier en e2e** (`ListQuery`, `ui/src/providers/ListQuery/index.tsx:151`) |
| **C3 Router — `pathname` / `searchParams` / `params`** | hooks `next/navigation` | `useLocation`, `searchStr`, `_splat` → `segments` | `useLocation().pathname`, `new URLSearchParams(location.search)`, `params['*']` → `segments` |
| **C3 Router — indicateur de transition** | (RSC transition) | `holdRouteTransition()` pendant `isLoading` (`router.tsx:85-93`) | `useNavigation().state !== 'idle'` → `holdRouteTransition()` |
| **C3b Link** | `next/link` | `createLink(<a>)`, `preload: 'intent'` | `<Link prefetch={prefetch === false ? 'none' : 'intent'} replace preventScrollReset={!scroll}>` |
| **C4 Vue admin** (`/admin/*`) | `RootPage` = `renderRoot({…, notFound, redirect})` dans `app/(payload)/admin/[[...segments]]/page.tsx` | `loadAdminPage` (`views/server.tsx:65-213`) → `renderServerComponent(renderRoot(...))` dans un `createServerFn` ; client `AdminPage` + `useDeferredValue` (`views/lazy.tsx`) | **Mode RSC** : `loader` de la route splat `admin/*` qui renvoie `{ page: await renderRoot({…}), metadata }`, JSX autorisé dans un loader RSC (`RR:docs/how-to/react-server-components.md:105-130`). `segments = undefined` pour `/admin` (cf. `views/server.tsx:82`). 404 → `renderNotFoundPage` + statut 404. |
| **C4 Métadonnées** | `generatePageMetadata` → `Metadata` Next | `getAdminMeta` / `toAdminPageMetadata` → `head()` | export `meta({ loaderData })` (v8 : `loaderData`, pas `data`), généré depuis `MetaConfig` aplati comme `toAdminPageMetadata` |
| **C5 Layout / document** | `adapters/layout.tsx:35-51` : `RootLayout` UI + fonts `next/font` + `NextRouterAdapter` | `withPayloadRoot(Shell)` bascule `<html>` selon le pathname (`layout/index.tsx:79-99`) ; route pathless `_payload` → `loadLayoutData` → `<RootProviders>` | `Layout` uniquement sur root (`RR:…/dom/ssr/routes.tsx:88`) → `withPayloadRoot(AppLayout)` dans `root.tsx` qui rend `DocumentRoot` si `useMatches()` contient l'id `payload-admin`. Route layout `admin` → loader `getRootLayoutData` + providers custom rendus en RSC → `<RootProviders RouterAdapter={ReactRouterAdapter} serverFunction={…}>`. |
| **C6 ComponentRenderer** | `RenderServerComponent` | `RenderServerComponent` (env RSC) | idem (mode RSC) |
| **C7 Dev reload** | défaut core (`/_next/hmr`) | `registerDevReloadStrategy` sur `import.meta.hot.on('payload:config-changed')` + plugin Vite (`withPayload/devConfigReload.ts`) | Copie du mécanisme TanStack : il ne dépend que de Vite, donc il peut être partagé à terme. |
| **C8 Server functions — transport** | action `'use server'` inline dans `app/(payload)/layout.tsx` | `createServerFn({method:'POST'})` + `createServerFunctionClient` (strip des non-sérialisables) | **D1 (A, mode RSC)** : fichier `'use server'` qui appelle `handleServerFunctions`, comme Next. Les `ReactNode` traversent nativement le Flight. **D1 (B)** : resource route `action` sur `/admin/__payload/server-functions` appelée par `fetch` ; elle ne peut **pas** transporter de `ReactNode`, donc vues document / liste cassées (cf. 0.2). |
| **C8 Server functions — résultat** | natif | `transformResult: serializeForRsc` | natif en mode RSC (pas de `transformResult`) — à vérifier : liste d'éléments sans clés, `Date` subclasses (`TZDate`) |
| **C9 Auth login / logout / refresh** | `'use server'` + `nextServerAdapter` | `createServerFn` + `tanstackServerAdapter` | Wrappers `login` / `logout` / `refresh` qui lient `reactRouterServerAdapter`. Les cookies sortent par le collecteur C1. |
| **C10 REST** `/api/*` | `REST_GET/POST/…` (`routes/rest/index.ts:8-60`) + `/og` Next-only | `payloadApiHandlers` → `handleAPIRoute` → `handleEndpoints` (`routes/rest/handler.server.ts:10-29`) | Resource route `api/*` : `loader` (GET/HEAD) + `action` (POST/PATCH/PUT/DELETE/OPTIONS) → `handleEndpoints({ config, path, request })`, `Response` renvoyée telle quelle (`RR:…/server-runtime/server.ts:634-704`) |
| **C10 GraphQL** | `GRAPHQL_POST` + playground | `handleGraphQL` (exporté, non utilisé par l'app) | via `handleEndpoints` comme TanStack, + `handleGraphQL` optionnel |
| **Not found global** | `NotFoundPage` | `notFound({ data: { rscPayload } })` | `throw data(…, 404)` + `ErrorBoundary` admin qui rend la page 404 Payload ; en mode RSC, vérifier qu'un élément peut voyager dans `data()` jeté |
| **Build (Vite)** | `withPayload` (next.config) | `withPayload` Vite : alias `@payload-config`, SCSS `~@payloadcms`, `ssr.external` / `noExternal`, ~45 entrées `optimizeDeps`, `importProtection`, 7 contournements (`withPayload/workarounds/*`) | `payloadReactRouter()` plugin Vite = **reprise de `withPayload/config/*` et des contournements Vite-génériques**, sans `tanstackStart` / `importProtection` TanStack. RR n'accepte aucune option de plugin (`RR:…/vite/plugin.ts:639-643`). Config dans `react-router.config.ts`. |

---

## 3. E2E : comment TanStack est sélectionné

- **Sélection** : `PAYLOAD_FRAMEWORK=next|tanstack-start` ou le flag `--framework-<name>`, lu dans `test/dev.ts:69-78, 120-158`.
- **Scripts** : `test:e2e:tanstack`, `dev:tanstack` (`package.json:83-84, 134-135`).
- **Serveur dev** : `test/__setup/server/tanstackDevServer.ts`, qui lance `vite dev --config vite.tanstack.config.ts` depuis `test/`.
- **Serveur prod** : `tanstackProdServer.ts`, qui fait `vite build` puis `srvx`.
- **App de test** : `test/app-tanstack/` + overrides par suite `test/<suite>/app-tanstack/`. L'importMap est générée par `test/initDevAndTest.ts:22-71`.
- **Gating par test** : `test(name, { framework: 'next' | 'tanstack-start' | 'rsc' | 'all' })` (`test/__helpers/e2e/playwright.ts:3-69`). Hydratation attendue via `window.__TANSTACK_HYDRATED__` (`patchPageMethods.ts`).
- **CI** : matrice `framework` (`.github/workflows/e2e.config.ts:113-119`, `utilities/e2e-matrix.ts:54`).
- **Tests sautés sous TanStack** :
  - `admin-root` entier ;
  - `uploads` (`/_next/image`) ;
  - `locked-documents`, `plugin-multi-tenant` (wire format server actions) ;
  - `queues`, `access-control` ;
  - une partie de `lexical`.

**Plan RR** : ajouter `react-router` à `PAYLOAD_FRAMEWORK`, `reactRouterDevServer.ts` / `reactRouterProdServer.ts`, `test/vite.react-router.config.ts`, `test/app-react-router/`, une entrée matrice CI, et `'react-router'` dans le gating `framework`. **Tout cela touche `test/` et la CI du monorepo Payload, donc il faut un fork (D2).**

---

## 4. Problèmes de contrat / hypothèses Next ou TanStack cachées

Le code partagé n'a **pas** été modifié. Chaque point indique fichier, ligne et une proposition minimale, pour accord.

| # | Problème | Où | Impact RR | Proposition minimale |
|---|---|---|---|---|
| P1 | `@payloadcms/ui` exige RSC (vue racine, layout et server functions renvoient des `ReactNode`). `ComponentRenderer` laisse croire qu'un mode non-RSC existe. | `ui/src/views/Root/index.tsx:1` ; `ui/src/layouts/Root/index.tsx:81` ; `payload/src/admin/adapters/render.ts:10-21` | Bloque le chemin « SSR + loaders » du brief | Aucune si D1 = RSC. Sinon : documenter dans le JSDoc de `render.ts` que le mode non-RSC n'est pas supporté pour l'admin. |
| P2 | `ServerAdapter.getHeaders()` / `getCookies()` sont sans argument et supposent un accès **ambiant** à la requête (`headers()` Next, `getRequest()` TanStack). | `payload/src/admin/adapters/server.ts:13-14` | RR classique passe `request` en argument. Il faut `unstable_getRequest` (RSC) ou `AsyncLocalStorage`. | Pas bloquant (contourné par ALS / `unstable_getRequest`). À noter seulement. |
| P3 | Les erreurs de contrôle sont reconnues par **chaînes** : `'NEXT_REDIRECT'`, préfixe TanStack `'redirect:'`, `'not-found'`. | `ui/src/views/Document/index.tsx:502-516` ; idem `test/__helpers/e2e/catchConsoleErrors.ts:46-61` | RR peut **réutiliser** la convention TanStack, donc pas de modif. | Moyen terme : exporter de `payload` un `isFrameworkControlFlowError()` ou des constantes. |
| P4 | Le CLI connaît les frameworks **par nom** : chemin de l'importMap (`app/(payload)/admin`, `app/_payload`), `detectFramework`, `PAYLOAD_FRAMEWORK` ∈ {`next`, `tanstack-start`}. Un `vite.config.*` est classé `tanstack-start`. | `payload/src/cli/commands/generateImportMap/utilities/resolveImportMapFilePath.ts:24-30` ; `…/frameworkConventions.ts:6-7` ; `payload/src/cli/commands/build/build.ts:16, 101-186` ; `utilities/telemetry/index.ts:197` | `payload generate:importmap` / `payload build` mal détectés dans une app RR | Contournement sans modif : `admin.importMap.importMapFile` dans la config + `PAYLOAD_FRAMEWORK` non utilisé. Propre : ajouter `'react-router'` (détection via dep `@react-router/dev` ou `react-router.config.*`, avant le test `vite.config.*`). |
| P5 | `ServerProps.server` est typé requis alors que `req.server` est optionnel ; 21 appels `req.server.redirect(...)` sans garde. | `payload/src/config/types.ts:585-592` ; `payload/src/types/index.ts:91-98` | Aucun (on fournit toujours l'adaptateur) | Note seulement |
| P6 | `initAdminContext` lit les cookies depuis `getHeaders()` et ignore `getCookies()`. Un cookie posé dans la même requête n'est pas vu. | `payload/src/admin/initAdminContext.ts:78` | Identique à TanStack | Note seulement |
| P7 | Concepts Next dans le code « agnostique » : `MetaConfig = … & Metadata` de `next`, `metadata = { title: 'Next.js' }`, `NEXT_PUBLIC_ENABLE_ROUTER_CACHE_REFRESH`, `RouteCache`. | `payload/src/config/types.ts:14, 354-367` ; `ui/src/layouts/Root/index.tsx:21-24` ; `RootProviders.tsx:75` | Typage : cast `as unknown as` comme TanStack | Note seulement |
| P8 | Le `ReactNode` de `loadAdminPage` doit forcer la lecture du flux Flight pour déclencher les effets de bord (redirect d'autosave). TanStack s'appuie sur un symbole interne. | `tanstack-start/src/adapters/views/server.tsx:154-171` | Même problème probable dans un loader RSC RR | À investiguer en Phase 1 (consommer le flux avant de renvoyer). |
| P9 | Server functions RR en mode RSC : « treat as public endpoints », le middleware de route ne les protège pas. | `RR:docs/how-to/react-server-components.md:497-515` | Sans impact : `handleServerFunctions` refait `initAdminContext`, donc auth et permissions à chaque appel, comme Next. | Note seulement |

---

## 5. Décisions

Retenues (2026-10-08), révisables :

- **D1 = A** — RSC Framework Mode de React Router.
- **D2 = b** — code dans ce repo, contre les paquets Payload `4.0.0-canary.39` publiés. Conséquence :
  la suite e2e de Payload n'a pas tourné (COMPAT.md) ; le banc maison la remplace.
- **D3** — `payload-react-router` (nom communautaire, `private: true`, non publié).
- **D4** — aucune modif du cœur : `admin.importMap.importMapFile` + `PAYLOAD_CONFIG_PATH`.

Options telles que présentées en Phase 0 :

### D1 — Rendu de l'admin

| Option | Pour | Contre |
|---|---|---|
| **(A, recommandée)** RR **RSC Framework Mode** (`unstable_reactRouterRSC` + `@vitejs/plugin-rsc`) | Même architecture que TanStack (même plugin Vite RSC) : `renderRoot`, les composants serveur de l'importMap et les `ReactNode` des server functions marchent sans toucher à l'UI. Server functions = `'use server'` natif, comme Next. | API `unstable_*` qui peut casser en mineure. Options RR non supportées en RSC : `splitRouteModules`, `serverBundles`, `presets`, `buildEnd`. Pas de convention `.server.ts` en RSC (utiliser `server-only`). |
| (B) Mode RR classique SSR + loaders + resource route `action` | API stable | **Ne peut pas rendre l'admin** sans modifier `@payloadcms/ui` (P1). Exclu par le brief. |
| (C) Hybride : app RR classique pour le site + sous-app RSC pour `/admin` | Isole l'instabilité | Deux builds et deux serveurs : complexité élevée pour un gain incertain |

### D2 — Où vit le code

- **(a, recommandée)** Fork `payloadcms/payload` → `packages/react-router` + `app-react-router` + hooks e2e. C'est le seul endroit où la suite e2e et les modifs CLI (P4) sont possibles. Le repo de travail est à créer ou à me donner (je n'ai accès en écriture qu'à `sakuga-software/headless-cms-templates`).
- **(b)** Ici, dans `headless-cms-templates` : `packages/payload-react-router` + `cms/payload` / `apps/web-payload-react-router` contre les paquets canary publiés (`4.0.0-canary.39`). Plus simple, cohérent avec ce repo (le README liste Payload comme « à revoir si admin agnostique »). En revanche, pas de suite e2e Payload : il faudrait écrire un sous-ensemble Playwright maison.
- **(c)** Les deux : développement dans le fork, puis démo ici en consommant le paquet.

### D3 — Nom du paquet

`@payloadcms/react-router` (dans un fork, en vue d'un upstream) ou `payload-react-router` (communautaire).

### D4 — Modifs cœur P4 (CLI / importMap)

Accepter un patch minimal dans le fork, ou s'en tenir au contournement `importMapFile` ?

---

### Problèmes rencontrés en Phase 1–3

| # | Problème | Où | Traitement |
|---|---|---|---|
| P10 | En mode RSC, une `Response` produite par le **middleware** d'une resource route (court-circuit) n'est pas marquée `React-Router-Resource` ; l'étage SSR la décode comme du Flight → « Connection closed », 500. Seule la sortie des handlers est marquée. | `RR:packages/react-router/lib/rsc/server.rsc.ts` (`generateResourceResponse`, ~l.767-820) + `lib/router/router.ts` `queryRoute` (le handler d'erreur du pipeline renvoie la réponse telle quelle) | Contourné : le middleware OPTIONS pose l'en-tête lui-même (`src/server/rest.ts`). À remonter à React Router. |
| P11 | Toute server function RSC déclenche une revalidation complète de la route, sauf si l'appel porte un `FormData` contenant `$SKIP_REVALIDATION`. Payload appelle `form-state` à chaque frappe. | `RR:…/rsc/server.rsc.ts` `processServerAction` (~l.726) | `PayloadRootProviders` ajoute ce `FormData` en 2ᵉ argument ; `router.refresh()` revalide explicitement. API non documentée → à surveiller. |
| P12 | `@vitejs/plugin-rsc` : 0.5.26 (version des tests RR) casse le build de l'UI (`MISSING_EXPORT` sur `loginBaseClass`, `metadata`…) ; 0.5.36 (sortie le 2026-10-07) casse l'invariant « Vite RSC assets manifest not found » de `@react-router/dev` (hooks `generateBundle` post dans le mauvais ordre). | `@react-router/dev/dist/vite.js` (`react-router/rsc/virtual-client-version`) | Épinglé 0.5.35 (celle du lockfile Payload). |
| P13 | `@payloadcms/ui` (bundle client) lit `process.env.NEXT_PUBLIC_ENABLE_ROUTER_CACHE_REFRESH` → `ReferenceError: process is not defined` hors Next. | `ui/src/layouts/Root/RootProviders.tsx:75` (déjà noté P7) | Transform Vite côté client : `NEXT_PUBLIC_*`/`PAYLOAD_PUBLIC_*` inlinés, le reste → `undefined`. Proposition upstream : lire un flag passé par l'adaptateur. |
| P14 | Les `.d.ts` de `payload` importent `react` sans dépendre de `@types/react` ; dans un monorepo pnpm avec une app React 18 (Hydrogen), ils résolvent `@types/react@18` hissé. | `payload/package.json` | `paths` vers `@types/react` 19 dans les tsconfig du paquet et de l'app. |
| P15 | En prod, `payload.config.ts` est bundlé dans `build/server/` : `import.meta.dirname` y pointe, donc la base SQLite et `staticDir` atterrissent à côté du bundle. | app | Chemins ancrés sur `process.cwd()`. (Next / TanStack ont le même piège ; non spécifique RR.) |
| P16 | Aucun rendu SSR de l'admin pour un visiteur anonyme (l'`AuthProvider` rend `null` avant d'avoir interrogé `/api/users/me`) : les clics avant hydratation sont perdus. | `ui/src/providers/Auth/index.tsx:504` | Comportement Payload, idem Next/TanStack. Signal `window.__PAYLOAD_ADMIN_HYDRATED__` pour les tests. |
| P17 | `handleEndpoints` ne sert pas GraphQL ; Next (`GRAPHQL_POST`) et TanStack (`handleGraphQL`) ont un handler à part — que l'`app-tanstack` ne branche pas. | `payload/src/utilities/handleEndpoints.ts` | Handler GraphQL porté et aiguillé depuis `/api/*`. |
| P18 | Rendu « à complétion » : chaque page admin est sérialisée en Flight, bufferisée, puis décodée dans le loader, pour que les `redirect()` levés dans les vues deviennent de vraies redirections. Coût : pas de streaming de la page admin. | `src/server/adminPage.tsx` | Même compromis que TanStack, mais via l'API publique `@vitejs/plugin-rsc/rsc` (`renderToReadableStream` + `createFromReadableStream`) au lieu d'un symbole interne. |

## 6. Inconnues de la Phase 0 — résolues

1. **Loader RSC → élément async** : oui. `loadAdminPage` renvoie l'arbre décodé ; `key: splat` remonte la vue au changement de route sans remonter la nav (banc #7).
2. **Fichiers `'use server'` de l'UI** : `renderRoot` s'importe et s'appelle normalement depuis l'env `rsc`.
3. **Redirect / notFound** : rendu à complétion + intention enregistrée (P18) ; `throw redirect()` dans le loader → 302 ; 404 via `data(…, { status: 404 })` (banc #8, #9).
4. **Document** : `root.tsx` ne rend que `<Outlet/>` (composant serveur) ; chaque layout (site, admin) rend son `<html>`. Pas besoin de `<Links/>`/`<Meta/>` : plugin-rsc injecte le CSS, React 19 hisse `<title>`.
5. **`useRevalidator`** : oui, il re-rend les routes serveur (utilisé pour `router.refresh()`).
6. **Contournements Vite** : tous repris sauf `devTransforms` (préambule HMR déjà injecté par RR) ; ajout du transform `process.env` (P13).
7. **Uploads** : multipart OK via resource route + `react-router-serve` (banc #11).
8. **Version** : RR `8.4.0` exact partout ; plugin-rsc `0.5.35` (P12).

## 7. Déploiement (points d'attention, hors périmètre)

- Le mode RSC RR exclut `serverBundles` et `presets` : les presets Vercel / Cloudflare ne s'appliquent pas tels quels.
- Payload utilise `sharp` et des drivers DB natifs, donc runtime Node requis (pas `workerd`), sauf `db-d1-sqlite`.

## Journal

- 2026-10-08 — Phase 0 : sources clonées, inventaire et table rédigés. Aucun code écrit, aucun code partagé modifié.
- 2026-10-08 — Phases 1–3 : paquet (un commit par contrat), app de démo, banc Playwright 26 tests (prod + dev, 26/26), 15 tests unitaires, CI GitHub Actions (le repo n'en avait pas). Correctif annexe : `apps/web-remix/app/data/cms.ts`, jamais commité à cause du motif `data/` du `.gitignore`, cassait typecheck et tests sur un clone propre. Toujours aucune modification de `payload` / `@payloadcms/ui`.
