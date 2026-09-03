---
kind: api
schemaVersion: 1
domains:
  - stripe.com
shortName: Stripe
icon: 💳
apiHost: https://api.stripe.com
auth:
  kind: static-key
  secretRefs:
    Authorization:
      secret: restricted_key
      prefix: "Bearer "
responseShape:
  format: json
  charset: utf-8
pagination:
  style: cursor
  itemsPath: data
  cursorParam: starting_after
  cursorPath: "data[-1].id"
  hasMorePath: has_more
  pageSizeParam: limit
  pageSize: 10
gatherAllMax: 1000
verified: "2026-09-03"
docs: https://docs.stripe.com/api
operations:
  - name: listCustomers
    via: paginate
    path: /v1/customers
    accept: json
    params:
      email:
        description: Filter to customers whose email matches the given string exactly.
      created:
        description: Filter by creation date — a UNIX timestamp or an `lt`/`gt`/`lte`/`gte` object.
---
# Stripe — payments API (read-only lists)

Stripe's REST API returns payment, customer, billing, and subscription data.
This recipe is **read-only by construction**: it is meant to be provisioned
with a **restricted key** (`rk_…`) scoped to read-only list permissions, so
Stripe's server-side key scopes enforce the read-only posture in addition to
the host framework's GET-only transport.

Scope discipline: common list endpoints only, not the long tail. This first
pass ships `listCustomers`; balance transactions, charges, invoices, and
subscriptions follow the same envelope and will be added incrementally.

## Auth

`Authorization: Bearer <restricted key>` header (required):

```sh
/api secrets stripe.com restricted_key "<raw rk_… key>"
```

The store holds the **raw key**; the guide's `secretRefs` entry declares
`prefix: "Bearer "`, so a bare key is accepted. A restricted key is the right
credential here: it is server-side scoped (the requested permissions live on
the key itself), it cannot write unless explicitly granted, and it can be
revoked independently of the account's main secret keys. The value never
enters agent context. This guide does **not** set `optional: true` — every
op requires auth, and a missing key fails closed before the request.

## Operations

### `listCustomers` — Paginated customer list

Returns the account's customers, most recent first, in Stripe's canonical
list envelope (`{object: "list", data: [...], has_more: bool, url}`).
Use `gatherAll: true` to walk all pages up to the guide's ceiling.

## Pagination

Stripe's documented manual loop is: if `has_more` is true, take the last
object's `id` and pass it as `starting_after`. There is **no cursor field in
the envelope** — the cursor is derived from the last item of the previous
page, and the exhaustion signal is the envelope-level boolean `has_more`.
This is exactly the two-piece shape the `hasMorePath` field was built for:

- `cursorPath: "data[-1].id"` — `[-1]` addresses the **last element** of
  `data`; its `id` is sent back as `starting_after` (string ids, no coercion).
- `hasMorePath: has_more` — the walk stops cleanly when the envelope's
  `has_more` resolves falsy. Without it, a Stripe walk would terminate only
  via Stripe's past-the-end `data: []` behavior (one wasted request) or the
  `gatherAllMax` ceiling with a false-alarm ⚠.

Stripe list endpoints share this envelope uniformly, so the pagination block
is **guide-level** — every `paginate` op inherits it. `limit` (1–100) is the
page size. Do not pass `starting_after`/`ending_before` manually on gatherAll
walks; the executor wires the cursor. Prose reference:
docs.stripe.com/pagination.

## Terms

Stripe's API terms permit read access with account credentials. Recipe reads
list data only — use a restricted key with read-only permissions.
