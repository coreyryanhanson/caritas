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
  # ── Group A — Core resources ─────────────────────────────────────
  - name: listCustomers
    via: paginate
    path: /v1/customers
    accept: json
    params:
      email:
        description: Filter to customers whose email matches the given string exactly.
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listCharges
    via: paginate
    path: /v1/charges
    accept: json
    params:
      customer:
        description: Only return charges for this customer id.
      payment_intent:
        description: Only return charges for this PaymentIntent id.
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listPaymentIntents
    via: paginate
    path: /v1/payment_intents
    accept: json
    params:
      customer:
        description: Only return PaymentIntents for this customer id.
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listSetupIntents
    via: paginate
    path: /v1/setup_intents
    accept: json
    params:
      customer:
        description: Only return SetupIntents for this customer id.

  - name: listBalanceTransactions
    via: paginate
    path: /v1/balance_transactions
    accept: json
    params:
      type:
        description: Only return transactions of this type (e.g. `charge`, `payout`, `refund`, `stripe_fee`).
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listPayouts
    via: paginate
    path: /v1/payouts
    accept: json
    params:
      status:
        description: "`paid`, `pending`, `in_transit`, `canceled`, or `failed`."
      arrival_date:
        description: Filter by expected arrival date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listRefunds
    via: paginate
    path: /v1/refunds
    accept: json
    params:
      payment_intent:
        description: Only return refunds for this PaymentIntent id.
      charge:
        description: Only return refunds for this charge id.

  - name: listDisputes
    via: paginate
    path: /v1/disputes
    accept: json
    params:
      charge:
        description: Only return disputes for this charge id.
      payment_intent:
        description: Only return disputes for this PaymentIntent id.

  - name: listEvents
    via: paginate
    path: /v1/events
    accept: json
    params:
      type:
        description: Prefix filter — return events whose type starts with this string (e.g. `invoice.`).

  - name: listFiles
    via: paginate
    path: /v1/files
    accept: json
    params:
      purpose:
        description: Only return files uploaded for this purpose (e.g. `dispute_evidence`, `identity_document`).
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listFileLinks
    via: paginate
    path: /v1/file_links
    accept: json
    params:
      file:
        description: Only return links for this file id.
      expired:
        description: Filter by expiration state — `true` or `false`.

  # ── Group B — Payment methods ────────────────────────────────────
  - name: listPaymentMethods
    via: paginate
    path: /v1/payment_methods
    accept: json
    params:
      type:
        description: Required by Stripe — the payment method type to list (e.g. `card`, `us_bank_account`).
        required: true
        default: card
      customer:
        description: Only return payment methods attached to this customer id.

  - name: listPaymentMethodConfigurations
    via: paginate
    path: /v1/payment_method_configurations
    accept: json

  - name: listPaymentMethodDomains
    via: paginate
    path: /v1/payment_method_domains
    accept: json

  # ── Group C — Products & pricing ─────────────────────────────────
  - name: listProducts
    via: paginate
    path: /v1/products
    accept: json
    params:
      active:
        description: Filter to active (`true`) or inactive (`false`) products.
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listPrices
    via: paginate
    path: /v1/prices
    accept: json
    params:
      product:
        description: Only return prices for this product id.
      active:
        description: Filter to active (`true`) or inactive (`false`) prices.
      type:
        description: "`recurring` or `one_time`."

  - name: listCoupons
    via: paginate
    path: /v1/coupons
    accept: json

  - name: listPromotionCodes
    via: paginate
    path: /v1/promotion_codes
    accept: json
    params:
      code:
        description: Only return the promotion code with this case-insensitive code.
      active:
        description: Filter to active (`true`) or inactive (`false`) codes.

  - name: listTaxCodes
    via: paginate
    path: /v1/tax_codes
    accept: json

  - name: listTaxRates
    via: paginate
    path: /v1/tax_rates
    accept: json
    params:
      active:
        description: Filter to active (`true`) or inactive (`false`) tax rates.

  - name: listShippingRates
    via: paginate
    path: /v1/shipping_rates
    accept: json
    params:
      active:
        description: Filter to active (`true`) or inactive (`false`) shipping rates.

  # ── Group D — Checkout & payment links ───────────────────────────
  - name: listCheckoutSessions
    via: paginate
    path: /v1/checkout/sessions
    accept: json
    params:
      payment_intent:
        description: Only return Checkout Sessions for this PaymentIntent id.
      status:
        description: "`open`, `complete`, or `expired`."
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listPaymentLinks
    via: paginate
    path: /v1/payment_links
    accept: json
    params:
      active:
        description: Filter to active (`true`) or inactive (`false`) payment links.

  # ── Group E — Billing ────────────────────────────────────────────
  - name: listInvoices
    via: paginate
    path: /v1/invoices
    accept: json
    params:
      customer:
        description: Only return invoices for this customer id.
      status:
        description: "`draft`, `open`, `paid`, `uncollectible`, or `void`."
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listInvoiceItems
    via: paginate
    path: /v1/invoiceitems
    accept: json
    params:
      customer:
        description: Only return invoice items for this customer id.
      invoice:
        description: Only return invoice items belonging to this invoice id.

  - name: listInvoicePayments
    via: paginate
    path: /v1/invoice_payments
    accept: json
    params:
      invoice:
        description: Only return invoice payments for this invoice id.
      payment:
        description: Only return invoice payments for this payment id.

  - name: listInvoiceRenderingTemplates
    via: paginate
    path: /v1/invoice_rendering_templates
    accept: json

  - name: listCreditNotes
    via: paginate
    path: /v1/credit_notes
    accept: json
    params:
      customer:
        description: Only return credit notes for this customer id.
      invoice:
        description: Only return credit notes for this invoice id.

  - name: listAlerts
    via: paginate
    path: /v1/billing/alerts
    accept: json
    params:
      alert_type:
        description: Filter by alert type (e.g. `usage_threshold`).

  - name: listCreditGrants
    via: paginate
    path: /v1/billing/credit_grants
    accept: json
    params:
      customer:
        description: Only return credit grants for this customer id.

  - name: listMeters
    via: paginate
    path: /v1/billing/meters
    accept: json
    params:
      status:
        description: "`active` or `inactive`."

  - name: listBillingPortalConfigurations
    via: paginate
    path: /v1/billing_portal/configurations
    accept: json

  - name: listPlans
    via: paginate
    path: /v1/plans
    accept: json
    params:
      product:
        description: Only return plans for this product id.
      active:
        description: Filter to active (`true`) or inactive (`false`) plans.

  - name: listQuotes
    via: paginate
    path: /v1/quotes
    accept: json
    params:
      customer:
        description: Only return quotes for this customer id.
      status:
        description: "`draft`, `open`, or `accepted`."

  - name: listSubscriptions
    via: paginate
    path: /v1/subscriptions
    accept: json
    params:
      customer:
        description: Only return subscriptions for this customer id.
      price:
        description: Only return subscriptions containing this price id.
      status:
        description: "`active`, `past_due`, `canceled`, `trialing`, `unpaid`, or `all` (default is `active`-ish; pass `all` for everything)."

  - name: listSubscriptionSchedules
    via: paginate
    path: /v1/subscription_schedules
    accept: json
    params:
      customer:
        description: Only return subscription schedules for this customer id.
      canceled_at:
        description: Filter by cancellation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  # ── Group F — Connect ────────────────────────────────────────────
  - name: listAccounts
    via: paginate
    path: /v1/accounts
    accept: json
    params:
      created:
        description: Filter by creation date — a UNIX timestamp (bracket-object range syntax is not expressible through this recipe).

  - name: listApplicationFees
    via: paginate
    path: /v1/application_fees
    accept: json
    params:
      charge:
        description: Only return application fees for this charge id.

  - name: listCountrySpecs
    via: paginate
    path: /v1/country_specs
    accept: json

  - name: listTopups
    via: paginate
    path: /v1/topups
    accept: json
    params:
      status:
        description: "`pending`, `failed`, or `succeeded`."

  - name: listTransfers
    via: paginate
    path: /v1/transfers
    accept: json
    params:
      destination:
        description: Only return transfers to this connected-account id.
      transfer_group:
        description: Only return transfers in this transfer group.

  # ── Group G — Fraud (Radar) ──────────────────────────────────────
  - name: listEarlyFraudWarnings
    via: paginate
    path: /v1/radar/early_fraud_warnings
    accept: json
    params:
      payment_intent:
        description: Only return early fraud warnings for this PaymentIntent id.
      charge:
        description: Only return early fraud warnings for this charge id.

  - name: listValueLists
    via: paginate
    path: /v1/radar/value_lists
    accept: json
    params:
      alias:
        description: Only return the value list with this alias.

  # ── Group H — Terminal ───────────────────────────────────────────
  - name: listTerminalLocations
    via: paginate
    path: /v1/terminal/locations
    accept: json

  - name: listTerminalReaders
    via: paginate
    path: /v1/terminal/readers
    accept: json
    params:
      location:
        description: Only return readers assigned to this location id.
      status:
        description: "`online` or `offline`."

  - name: listTerminalConfigurations
    via: paginate
    path: /v1/terminal/configurations
    accept: json

  # ── Group I — Identity ───────────────────────────────────────────
  - name: listIdentityVerificationSessions
    via: paginate
    path: /v1/identity/verification_sessions
    accept: json
    params:
      status:
        description: "`requires_input`, `processing`, or `verified`."
      type:
        description: Only return sessions of this type (e.g. `document`).

  - name: listIdentityVerificationReports
    via: paginate
    path: /v1/identity/verification_reports
    accept: json
    params:
      verification_session:
        description: Only return reports for this verification session id.

  # ── Group J — Tax ────────────────────────────────────────────────
  - name: listTaxRegistrations
    via: paginate
    path: /v1/tax/registrations
    accept: json
    params:
      status:
        description: "`active`, `expired`, or `scheduled`."

  - name: getTaxSettings
    via: restGet
    path: /v1/tax/settings
    accept: json

  # ── Group K — Climate ────────────────────────────────────────────
  - name: listClimateProducts
    via: paginate
    path: /v1/climate/products
    accept: json

  - name: listClimateOrders
    via: paginate
    path: /v1/climate/orders
    accept: json

  - name: listClimateSuppliers
    via: paginate
    path: /v1/climate/suppliers
    accept: json

  # ── Group L — Reporting ──────────────────────────────────────────
  # /v1/reporting/report_types rejects `limit` (observed live), so this op
  # carries an op-level pagination override WITHOUT pageSizeParam — the
  # guide-level `limit` seed would 400 every request. starting_after and
  # has_more are still honored.
  - name: listReportTypes
    via: paginate
    path: /v1/reporting/report_types
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorParam: starting_after
      cursorPath: "data[-1].id"
      hasMorePath: has_more

  # ── Group M — Financial Connections ──────────────────────────────
  - name: listFinancialConnectionsAccounts
    via: paginate
    path: /v1/financial_connections/accounts
    accept: json
    params:
      account_holder:
        description: Only return accounts owned by this customer/account id.

  # ── Group N — Retrieves (outside the list machinery) ─────────────
  - name: getBalance
    via: restGet
    path: /v1/balance
    accept: json

  # ── Group O — Nested (foreign-key) lists ─────────────────────────
  # These require a caller-supplied parent id. List the parent first
  # (listSubscriptions / listInvoices / listCustomers), then pass a real id.
  - name: listSubscriptionItems
    via: paginate
    path: /v1/subscription_items
    accept: json
    params:
      subscription:
        description: The subscription id whose items to return (required).
        required: true

  - name: listInvoiceLineItems
    via: paginate
    path: /v1/invoices/{invoice}/lines
    accept: json
    params:
      invoice:
        description: The invoice id whose line items to return.

  - name: listCustomerBalanceTransactions
    via: paginate
    path: /v1/customers/{customer}/balance_transactions
    accept: json
    params:
      customer:
        description: The customer id whose balance transactions to return.
---
# Stripe — payments API (read-only lists)

Stripe's REST API returns payment, customer, billing, and subscription data.
This recipe is **read-only by construction**: it is meant to be provisioned
with a **restricted key** (`rk_…`) scoped to read-only list permissions, so
Stripe's server-side key scopes enforce the read-only posture in addition to
the host framework's GET-only transport.

Source of truth: the official Stripe API reference at
<https://docs.stripe.com/api> (cited in frontmatter `docs:`). Endpoint
selection, live-observed facts, and every omission are recorded in
[`endpoint-coverage-plan.md`](./endpoint-coverage-plan.md) — drafted against
the reference and probed live on 2026-09-03.

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

**Scope note:** a restricted key only sees the resources its granted
permissions cover. Ops outside the key's grants fail with Stripe's
permission error (HTTP 403), and feature-gated resources (Issuing,
Treasury, Capital, …) that the account hasn't enabled return
404/400 before any data question — both cases are documented in the
coverage plan. This is expected behavior, not a recipe bug.

## Operations

59 operations, grouped by Stripe's own reference categories — every
read-only list endpoint common to a standard account, plus three
foreign-key nested lists and the two retrieves that exist outside the
list machinery (`getBalance`, `getTaxSettings`).

- **Core lists** (customers, charges, payment intents, balance
  transactions, payouts, refunds, disputes, events, files) — the
  account's payment history.
- **Products & billing** (products, prices, plans, coupons, promotion
  codes, invoices, invoice items, credit notes, subscriptions, quotes,
  meters) — the catalog and billing ledger.
- **Connect, Radar, Terminal, Identity, Tax, Climate, Financial
  Connections, Reporting** — the platform services.
- **Nested ops** (`listSubscriptionItems`, `listInvoiceLineItems`,
  `listCustomerBalanceTransactions`) require a parent id — list the
  parent first, then pass a real id.
- **Filter params** are documented per op; none are required except the
  nested ops' parent ids and `listPaymentMethods`' `type` (default
  `card`).

Use `gatherAll: true` on any list op to walk all pages up to the guide's
ceiling.

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
is **guide-level** — every `paginate` op inherits it. One exception:
`listReportTypes` carries an **op-level pagination override** without
`pageSizeParam` (`GET /v1/reporting/report_types` rejects `limit`, verified
live; it still honors `starting_after` and `has_more`).

`limit` (1–100) is the page size. Do not pass `starting_after`/`ending_before`
manually on gatherAll walks; the executor wires the cursor. Prose reference:
<https://docs.stripe.com/pagination>.

## Terms

Stripe's API terms permit read access with account credentials. Recipe reads
list data only — use a restricted key with read-only permissions.
