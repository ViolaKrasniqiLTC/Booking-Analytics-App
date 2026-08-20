# Booking Analytics — Dev Session Notes

Saved before reverting the repo to the initial GitHub state (`.env` kept).

---

## Summary

Work done in this session:

1. Created a **web pixel extension** (`booking-analytics-pixel`) to subscribe to storefront customer events.
2. Added **Supabase** env vars in `.env` for the existing backend routes.
3. Updated **`shopify.app.toml`** with pixel OAuth scopes.
4. Fixed **`runtime_context`** placement in extension TOML.
5. Activated the pixel on the dev store via GraphQL (`webPixelCreate` / `webPixelUpdate`).
6. Verified `page_viewed` logs in the browser console.

---

## Files changed (from GitHub initial commit)

### Modified

#### `shopify.app.toml`

Added pixel scopes to the app OAuth config:

```toml
# Before (GitHub):
scopes = "write_products,write_metaobjects,write_metaobject_definitions"

# After (session):
scopes = "write_products,write_metaobjects,write_metaobject_definitions, write_pixels,read_customer_events"
```

Note: remove the space after the comma before `write_pixels` when re-applying (cosmetic).

---

### Created (untracked)

#### `extensions/booking-analytics-pixel/shopify.extension.toml`

```toml
name = "booking-analytics-pixel"
type = "web_pixel_extension"
uid = "5c44458e-f1ae-d153-b244-69024dcf5805b81459de"
runtime_context = "strict"

[access_scopes]
scopes = "write_pixels,read_customer_events"

[settings]
type = "object"

[settings.fields.accountID]
name = "Account ID"
description = "Account ID"
type = "single_line_text_field"
validations =  [
  { name = "min", value = "1" }
]
```

**Important:** `runtime_context` must be at the **root level**, not under `[access_scopes]`.

Extension generated with:

```bash
shopify app generate extension --template web_pixel --name booking-analytics-pixel
```

---

#### `extensions/booking-analytics-pixel/src/index.js`

```js
import {register} from "@shopify/web-pixels-extension";
import {setupPageViewTrcking} from "./pageView";

register(({ analytics, browser, init, settings }) => {
    // Bootstrap and insert pixel script tag here

    // Sample subscribe to page view
    analytics.subscribe('page_viewed', (event) => {
      console.log('Page viewed', event);
    });
});
```

Known issue: imports `setupPageViewTrcking` from `./pageView` but that export does not exist.

---

#### `extensions/booking-analytics-pixel/src/pageView.js`

```js
import { register } from '@shopify/web-pixels-extension';

register(({ analytics }) => {
  analytics.subscribe('page_viewed', (event) => {
    console.log('====================');
    console.log('PAGE VIEWED!');
    console.log('Event name:', event.name);
    console.log('Event ID:', event.id);
    console.log('Timestamp:', event.timestamp);
    console.log('Client ID:', event.clientId);
    console.log('Page URL:', event.context.document.location.href);
    console.log('Full event:', event);
    console.log('====================');
  });
});
```

Known issues:
- Duplicate `register()` (also in `index.js`) — only one entry point should register.
- `event.context.document.location.href` does **not** work in `strict` sandbox (no DOM).

---

#### `extensions/booking-analytics-pixel/package.json`

```json
{
  "name": "booking-analytics-pixel",
  "version": "1.0.0",
  "main": "dist/main.js",
  "license": "UNLICENSED",
  "dependencies": {
    "@shopify/web-pixels-extension": "^2.10.0"
  }
}
```

---

#### `pnpm-lock.yaml`

Created when using pnpm in the monorepo workspace. GitHub initial commit had `package-lock.json` only.

---

### Kept (not reverted)

#### `.env`

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

(Actual values stored locally — not committed; see your local `.env`.)

Used by `app/lib/supabase.server.js` for:
- `app/routes/api.analytics.jsx` — POST endpoint for pixel events
- `app/routes/app._index.jsx` — analytics dashboard

---

## Supabase setup

### Required env vars

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access (never expose to client) |

### SQL table (run in Supabase SQL Editor)

```sql
create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  customer_id text,
  customer_email text,
  session_id text,
  page_url text,
  product_id text,
  product_title text,
  quantity integer,
  cart_id text,
  checkout_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index analytics_events_created_at_idx on analytics_events (created_at desc);
create index analytics_events_customer_email_idx on analytics_events (customer_email);
```

---

## Step-by-step: web pixel setup

### 1. Generate the extension

```bash
shopify app generate extension --template web_pixel --name booking-analytics-pixel
```

### 2. Fix `shopify.extension.toml`

- Set `runtime_context = "strict"` at **root level** (sibling of `name`, `type`, `uid`).
- Keep `[settings.fields.accountID]` (required for activation).

### 3. Add app scopes in `shopify.app.toml`

```toml
scopes = "write_products,write_metaobjects,write_metaobject_definitions,write_pixels,read_customer_events"
```

Restart `shopify app dev` and reinstall / re-authorize the app on the dev store.

### 4. Run dev

```bash
shopify app dev
```

Install app on dev store when prompted.

### 5. Activate pixel (GraphiQL — press `g` in CLI)

**Create** (first time only):

```graphql
mutation {
  webPixelCreate(webPixel: { settings: "{\"accountID\":\"dev-store-1\"}" }) {
    userErrors { code field message }
    webPixel { id settings }
  }
}
```

- `accountID` is a **custom value you choose** (any non-empty string).
- Not a Shopify/Supabase ID you look up.

**If already created** (`TAKEN` error):

```graphql
mutation {
  webPixelUpdate(webPixel: { settings: "{\"accountID\":\"dev-store-1\"}" }) {
    userErrors { code field message }
    webPixel { id settings }
  }
}
```

**Check current pixel:**

```graphql
query {
  webPixel {
    id
    settings
  }
}
```

### 6. Verify in Shopify Admin

**Settings → Customer events → App pixels** — app should show **Connected**.

### 7. Verify in browser

1. Open storefront (not admin).
2. Open DevTools → Console.
3. **Clear any text filter** (e.g. `cart` hides `Page viewed` logs).
4. Hard refresh.
5. Look for `Page viewed` from `web-pixel-*.js`.

Optional: add `?debug_pixels=true` to the storefront URL.

---

## Troubleshooting reference

| Problem | Cause | Fix |
|---------|-------|-----|
| `[runtime_context]: Required` | `runtime_context` nested under `[access_scopes]` | Move to root of `shopify.extension.toml` |
| Missing Supabase env vars | No `.env` or missing keys | Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| App not in Customer events | Missing `write_pixels` / `read_customer_events` in `shopify.app.toml` | Add scopes, reinstall app |
| `INVALID_SETTINGS` / Missing `accountID` | Mutation settings missing key | Pass `"{\"accountID\":\"your-value\"}"` |
| `TAKEN` on create | Pixel already exists | Use `webPixelUpdate` or check App pixels |
| No console logs | Console filter active | Clear filter; check pixel is Connected |
| `pageView.js` errors | DOM access in strict sandbox | Use event payload fields, not `document` |

---

## Already in GitHub repo (unchanged this session)

These existed in the initial commit and were **not** modified:

- `app/lib/supabase.server.js`
- `app/routes/api.analytics.jsx`
- `app/routes/app._index.jsx`
- `package.json` (`@supabase/supabase-js` dependency)

---

## Next steps (not done yet)

1. Fix pixel code: single `register()` in `index.js`, export/use `pageView` properly.
2. POST events from pixel to `/api/analytics` with `fetch()` + CORS.
3. Auto-create pixel on install via `afterAuth` + `webPixelCreate` mutation.
4. Add `[customer_privacy]` block to extension TOML if needed for consent.

---

## Revert command used

To restore GitHub initial state while keeping `.env`:

```bash
git restore shopify.app.toml
rm -rf extensions/booking-analytics-pixel
rm -f pnpm-lock.yaml
# .env is gitignored and was left in place
```
