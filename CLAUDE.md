# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A self-contained **interview / test-case sandbox**: a small e-commerce "orders" app used to
evaluate candidates. It runs directly on Node.js: Vite serves the React SPA and a separate
Express process serves the REST and GraphQL APIs.

There is **no database, no build step, and no production mode anywhere**. Both apps run dev
servers. All state is in-memory and resets when the backend process restarts.

Crucially, the backend deliberately injects a **1.5 s delay on every request** and a **500 error
on every 5th request**. These are fixtures the candidate's UI is meant to cope with — not bugs.
See [Deliberate fixtures](#deliberate-fixtures--do-not-fix).

## Running it

Install and start the two applications in separate terminals:

```bash
# terminal 1
cd backend
npm ci
npm run dev

# terminal 2
cd frontend
npm ci
npm run dev
```

Then open **http://localhost:3001/runtime**.

| URL | What |
|---|---|
| http://localhost:3001/runtime | React app (Vite) |
| http://localhost:3000/graphql | GraphQL endpoint (the app's only data transport) |
| http://localhost:3000/api-docs | Swagger UI |
| http://localhost:3000/reset/orders | Resets order state to seed values |
| http://localhost:3000/health | Backend health check |

Test accounts: `john.doe` / `password123`, `jane.smith` / `password456`.
**Only `john.doe` (user-1) owns any orders.** Logging in as `jane.smith` shows a permanently
empty list — that is seed data, not a bug.

## Topology

There is no gateway in the local development flow:

- Vite listens on port 3001 and serves the SPA below `/runtime`.
- Express listens on port 3000 and exposes `/graphql`, `/api/*`, `/api-docs`, `/productImg/*`,
  `/reset/orders`, and `/health` directly.
- The Apollo client uses its `http://localhost:3000/graphql` fallback when `frontend/.env` is
  absent. CORS is enabled by the backend.

The root `docker-compose.yml`, `nginx.conf`, `nginx-static/`, Dockerfiles, and
`.openvscode-server/` are legacy deployment assets and are not part of the supported startup
flow.

### The `/runtime` frontend prefix is asserted in two places

Change one without the others and the app 404s or blank-screens:

1. `frontend/vite.config.ts:7` — `base: '/runtime'`
2. `frontend/src/App.tsx:10` — `<Router basename="/runtime">`

The proxy entries in `vite.config.ts` still target the Docker-only hostname `backend`; the
Node/Vite flow does not use them. Keep `frontend/.env` absent so Apollo uses the direct backend
URL, or set `VITE_GRAPHQL_URI=http://localhost:3000/graphql` explicitly.

## Backend (`backend/`)

Express 4 + TypeScript, `ts-node src/index.ts`. Never compiled; `dist/` is never produced.

### Layering

`index.ts` → `App` (`app.ts`, the composition root) → `createXRoutes(controller)` factory →
controller → service → repository interface → `InMemory*Repository`.

Followed cleanly for auth / order / promo. Three deliberate departures:

- **No auth middleware.** Each controller has a private `extractUserIdFromToken(req)`
  ([orderController.ts:22](backend/src/controllers/orderController.ts#L22)), and
  [resolvers.ts:6](backend/src/graphql/resolvers.ts#L6) copy-pastes the same logic.
- **`resetRoutes.ts`** talks to the concrete `InMemoryOrderRepository` and calls `reset()`,
  which is not on `IOrderRepository`. No controller, no service.
- **`graphql/resolvers.ts`** is a second controller layer wired straight to the services,
  bypassing the controllers entirely.

### ⚠️ REST and GraphQL do not share state

[app.ts:51-56](backend/src/app.ts#L51-L56) and [app.ts:101-106](backend/src/app.ts#L101-L106)
build **two completely independent sets of repositories**. An order mutated over GraphQL is
invisible over `/api/order` and vice versa. Only `GET /reset/orders` bridges them (it holds
both order repos via `this.orderRepositories`).

If you add a stateful repository, wire it into **both** blocks, and push it onto
`this.orderRepositories` if it needs resetting.

### Domain model (`src/types/entities.ts`, seeded in `src/repositories/implementations.ts`)

- `UserRecord {id, name}` — `user-1` John Doe, `user-2` Jane Smith
- `AuthRecord {userId, login, password}` — plaintext passwords
- `ProductRecord {id, title, description, image}` — `product-1` Laptop, `-2` Smartphone,
  `-3` Headphones, `-4` Tablet; `image` is `/productImg/<name>.svg`
- `OrderRecord {orderId, userId, status, createAt, products[{id, amount, price}], promo?}`
  - `order-1` — user-1, `finished`, product-1 ×1 @1299.99 + product-3 ×2 @199.99
  - `order-2` — user-1, `created`, product-2 ×1 @899.99 + product-4 ×1 @599.99
- `OrderDTO` — the wire shape; `products[]` holds a full `product` object, not an id
- `PromoEntity {id, discount, dueDate}` — `SAVE10` (10%, +30d), `SAVE20` (20%, +7d),
  `SAVE5` (5%, **already expired**)

Status enum is `'created' | 'submited' | 'finished'`. **The misspelling `submited` is
load-bearing** — it appears in the TS union, the GraphQL enum, the seed data and the frontend
types. Don't "fix" it in one place.

### Business rules (all in `src/services/orderService.ts`)

- `calculateOrderSum` — `Σ amount×price`, then percentage discount. A missing **or expired**
  promo **silently returns the subtotal**, no error. `PromoService.validatePromo` handles the
  same rule but *does* report errors — the two diverge intentionally-looking but inconsistently.
- `transformToDTO` — clamps `amount` to 1..10, dedupes products by id (summing, capped at 10),
  and **drops `promo` entirely**. `Order.promo` is therefore *always* null on the wire even
  though the GraphQL SDL, the Swagger schema and three client queries all declare it.
- `deleteProductFromOrder` — returns `null` when it would empty the order, so the last product
  can never be removed (surfaces to the client as an error).
- `submitOrder` — only `created` → `submited`.
- `updateProductAmount` — **dead code**, exposed by no route and no resolver.

### REST endpoints

Mounted in `app.ts` and available directly on `http://localhost:3000`.

| Method | Path | Auth |
|---|---|---|
| POST | `/api/login` | — |
| GET | `/api/order` | Bearer |
| GET | `/api/order/:orderId` | Bearer |
| POST | `/api/order/:orderId/sum` | Bearer |
| DELETE | `/api/order/:orderId/:productId` | Bearer |
| POST | `/api/order/:orderId` (submit) | Bearer |
| GET | `/api/promo/:promoId` | — |
| GET | `/reset/orders` | — (`cors: *`) |
| GET | `/health`, `/`, `/api-docs` | — |
| — | `/productImg/*` (static from `public/`) | — |

Missing/invalid token on order routes returns **403**, not 401. Error bodies are always
`{ error: string }`.

Swagger specs are generated by `swagger-jsdoc` from the `@swagger` JSDoc blocks in
`src/routes/*.ts` — which is why `orderRoutes.ts` is 333 lines of mostly comments. Keep the
annotation next to any route you add. Note `apis: ['./src/routes/*.ts']` is **cwd-relative**,
so docs only populate when the process starts from `backend/`.

### GraphQL

`apollo-server-express@3.13.0` (Apollo Server 3 — EOL upstream) + `graphql@16`, attached via
`applyMiddleware({ path: '/graphql' })`. Introspection on. Context is `({ req }) => ({ req })`.

```graphql
Query:    orders: [Order!]!
          order(orderId: ID!): Order
          orderSum(orderId: ID!, products: [ProductInput!]!, promo: String): Float!
          promo(promoId: ID!): Promo
Mutation: login(input: LoginInput!): LoginResponse!
          submitOrder(orderId: ID!): Boolean!
          deleteProductFromOrder(orderId: ID!, productId: ID!): Order
```

All resolvers except `login` and `promo` require a Bearer token and throw
`Authentication required` otherwise. **Every resolver wraps its body in a try/catch that
replaces the real error with a generic string** — e.g. a genuine "Order not found or access
denied" surfaces to the client as "Failed to fetch order". Expect to add logging when
debugging resolver behaviour.

`initializeGraphQL()` is `async` but called un-awaited from the constructor, so `app.listen()`
runs before `/graphql` is mounted. Harmless in practice, but `/graphql` 404s for a few ms.

## Frontend (`frontend/`)

Vite 4 + React 18 + TypeScript 5.9, served by the **Vite dev server** (never built).

### Routing — react-router-dom **v5**, not v6

`frontend/src/App.tsx` uses `<Switch>`, `<Route component={…}>`, `useHistory()`.
**Do not write `<Routes>`, `<Route element={…}>`, or `useNavigate`** — they don't exist here.

Routes: `/` HomePage, `/login` LoginPage, `/order` OrderPage, plus a leftover debug route at
[App.tsx:16](frontend/src/App.tsx#L16) (`path='/hui'`, an inline joke component with obscene
Russian slang) that should be deleted before any demo.

**There is no route guard.** `/order` renders for anyone; the queries simply fail unauthenticated.
Auth state is nothing more than the presence of `localStorage['auth_token']`
([UserProfile.tsx:15](frontend/src/components/UserProfile.tsx#L15)). Logout removes the key and
calls `window.location.reload()`.

### Data layer — Apollo only

One client in `src/apollo/client.ts`: `errorLink → authLink → httpLink`. `authLink` reads
`localStorage['auth_token']` and sets `authorization: Bearer <token>`. `errorPolicy: 'all'`.
`errorLink` only `console.log`s.

The seven documents in `src/graphql/` all match the server schema exactly — argument names,
types, nullability and every selected field were diffed and are correct. Notes:

- `GET_ORDER` and `GET_PROMO` are **defined but never imported** — dead.
- `OrderSum` declares a `$promo` variable and never passes it, so discounts never apply.
- `OrderList` copies query results into `useState` and mutates that copy locally
  ([OrderList.tsx:29-33](frontend/src/components/OrderList.tsx#L29-L33)) — the Apollo cache is
  not the source of truth. It also declares a `_deleteProduct` mutation it never calls,
  duplicating the one that actually runs in `OrderListItem`.
- **`axios` is a declared dependency with zero imports.** The REST API is exercised only by
  Swagger/curl.

### UI system — Tailwind v4 + shadcn-style primitives (no MUI)

`src/components/ui/*.tsx` are shadcn/ui-style: Radix primitives + `cva` variants + `cn()`
(`clsx` + `tailwind-merge`, in `src/lib/utils.ts`), `React.forwardRef`, named exports.
Feature components in `src/components/` are plain `React.FC` with a local props interface and
a default export. Icons: `lucide-react`. `@/` aliases `./src` (set in both `vite.config.ts`
and `tsconfig.json`).

⚠️ **Tailwind is v4**, but the v3-style `tailwind.config.js` is still live — solely because
`src/index.css:2` contains `@config "../tailwind.config.js";`, v4's legacy-config bridge.
Remove or move that one line and every custom token (`bg-background`, `border-input`,
`bg-primary`, `bg-card`, the `rounded-*` radii, the container settings) **silently evaporates
with no build error**. If you touch `index.css`, rebuild and grep the emitted CSS for
`hsl(var(--background))` to confirm.

`tailwindcss-animate` and `@tailwindcss/forms` are installed but **never registered**
(`plugins: []`). The `animate-in` / `fade-in-0` / `zoom-in-95` / `slide-in-from-*` classes
already in `ui/dropdown-menu.tsx` emit no CSS. In v4 the fix is `@plugin "tailwindcss-animate";`
in `index.css`, not a `plugins[]` entry.

Dark-mode tokens exist in `index.css` and `darkMode: ["class"]` is configured, but nothing ever
applies the `.dark` class — dark mode is inert.

## Deliberate fixtures — do not "fix"

Both are registered globally in `app.ts`, so they hit `/health`, `/graphql`, Swagger and even
static `/productImg/*.svg`:

- **`delayMiddleware(1500)`** ([app.ts:40](backend/src/app.ts#L40)) — 1.5 s on *every* request.
- **`errorTestMiddleware`** ([app.ts:43](backend/src/app.ts#L43)) — HTTP 500 on every **5th**
  request, process-wide. Both its own comment and the one in `app.ts` say "every 3rd"; the code
  is `requestCount % 5 === 0`. The code is what runs.

Intermittent 500s and sluggish responses are the exercise. Any test or health check you write
must tolerate a deterministic 1-in-5 failure and 1.5 s latency.

## Traps

**`backend/tsconfig.json` sets `"noCheck": true`** alongside `"strict": true`. The flag is real
(TS 5.6+; 5.9.2 installed) and it nullifies every strictness setting. `npm run build` in
`backend/` only parses and transpiles — **a green build is not evidence your change
type-checks.** To really check:

```bash
cd backend && npx tsc --noCheck false --noEmit
```

There are **4 pre-existing errors** it hides — `app.ts:119` (duplicate `@types/express`;
apollo-server-express bundles its own), `config/swagger.ts:1` (`@types/swagger-jsdoc` not
installed), `graphql/server.ts:23` (`playground: true` is not a valid Apollo Server 3 option and
does nothing), `index.ts:7` (`string | 3000` passed as `number`). Removing `noCheck` breaks the
build on all four; fix them in the same change or the backend stops starting.

**`npm run lint` in `frontend/` is broken.** `.eslintrc.cjs` extends `"@typescript-eslint/recommended"`,
which should be `"plugin:@typescript-eslint/recommended"`. ESLint fails to load the config, so
linting has never run. (`npx tsc --noEmit` in `frontend/` *does* pass cleanly.)

**The nginx configs are dead in the Node/Vite flow.** Both `frontend/nginx.conf` and the root
`nginx.conf` are leftovers from the Docker topology. Changes to them do not affect either dev
server; frontend server configuration belongs in `frontend/vite.config.ts`.

**`frontend/env-example` is wrong.** It says `VITE_GRAPHQL_URI=/graphql`, which sends requests
to Vite instead of Express. For the local flow, leave `frontend/.env` absent and let
`apollo/client.ts:6` fall back to `http://localhost:3000/graphql`, or use that absolute URL in
the env file.

**Product images 404.** The backend returns `/productImg/laptop.svg` and
[OrderListItem.tsx:77](frontend/src/components/OrderListItem.tsx#L77) renders it verbatim, so
the browser requests `http://localhost:3001/productImg/…`, which Vite does not proxy.
Radix's `<AvatarFallback>` swallows the failure by showing the product's initial, so it's
invisible without devtools. Fix by using an absolute backend URL in the seed data or adding a
`/productImg` proxy in `frontend/vite.config.ts`.

**The backend has no `dotenv`.** `npm run dev` does not read `backend/.env`; without shell-level
environment variables it uses port 3000 and the hardcoded JWT secret. This is sufficient for
the local sandbox because token creation and verification happen in the same process. Export
`PORT`, `NODE_ENV`, and `JWT_SECRET` in the shell if custom values are required.

**`NODE_ENV=production` in `backend/.env` is misleading** — nothing runs in production mode.
Its only effect is [app.ts:34](backend/src/app.ts#L34), where it *enables* Helmet's CSP. Flipping
it to `development` silently disables CSP.

**Seed data is duplicated by hand.** `InMemoryOrderRepository` has the same two orders written
out twice — in the field initializer and again in `reset()`
([implementations.ts:92-137](backend/src/repositories/implementations.ts#L92-L137)). Edit both
or they drift.

**Dependencies are installed separately.** There is no root `package.json`; run `npm ci` in
both `backend/` and `frontend/`. Re-run it in the affected directory after changing a lockfile.

## Documentation drift

`backend/README.md` and `frontend/README.md` are **substantially stale** — prefer the code.

- `frontend/README.md` claims Material-UI 7, Emotion and Axios. **There is no MUI, no Emotion,
  and axios is unused.** It also gives a 5-file project structure (the real tree is ~20 files,
  with the entire Apollo/GraphQL layer undocumented), says `max-width: 1250px` where
  `MainLayout` uses `max-w-7xl` (1280px).
- `backend/README.md` documents only `POST /api/login` and never mentions GraphQL, the order and
  promo routes, the reset route or the middleware directory.

## Conventions

- **Backend**: constructor injection everywhere; routes are `createXRoutes(controller)`
  factories returning a `Router`; handlers are wrapped as `(req, res) => controller.method(req, res)`;
  controllers `try/catch` and return `{ error: string }`; services return `null` for
  not-found/forbidden and let the controller pick the status code; repositories return copies
  (`[...this.items]`).
- **Frontend**: feature components are `React.FC<Props>` with a local `interface`, default
  export, one per file; `ui/` primitives use `forwardRef` + `cva` + named exports; imports from
  `ui/` use the `@/` alias while feature-to-feature imports use relative paths.
- Adding a GraphQL field means touching `schema.ts`, `resolvers.ts`, and — if it's on `Order` —
  `orderService.transformToDTO`, which is the mapper that silently decides what actually reaches
  the client.
