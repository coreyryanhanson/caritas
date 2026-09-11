# Stripe API — Endpoint Coverage Plan

> Drafted 2026-09-03 against the Stripe API reference at
> <https://docs.stripe.com/api> (sidebar resource index verified via
> `web-fetch` on 2026-09-03; every included op additionally verified
> live against `api.stripe.com` with the provisioned `rk_test_`
> restricted key — status codes and error bodies recorded below).
> Implements the read-only list surface the minimal first pass
> (`listCustomers` only) did not yet cover.
>
> **Selection rule:** read-only `GET` **list** endpoints of the **v1**
> API surface (`api.stripe.com/v1/…`) — the surface the guide-level
> pagination block (`has_more` + `starting_after = data[-1].id`)
> addresses. Excludes: mutation endpoints (POST/PATCH/DELETE), the v2
> API surface (`/v2/…`), retrieve-by-id drill-downs, nested lists
> requiring a caller-supplied foreign-key id (three high-value ones
> included, the rest omitted — see omission table), and resources the
> live account cannot route (feature-gated, documented with the
> observed error).

## Status quo (pre-expansion)

`guide.md` declared **1 of ~55** documented read-only list endpoints:

| Implemented | Operation | Path |
|-------------|-----------|------|
| ✅ | `listCustomers` | `/v1/customers` |

## Live-observed facts (2026-09-03, `rk_test_` key)

- **Envelope is uniform across every list endpoint:** `{object: "list",
  data: [...], has_more: bool, url}` — verified on all included ops.
  This is what makes **guide-level** pagination correct: every
  `paginate` op inherits the same `cursor` block.
- **The documented Stripe walk works end-to-end:** page 2 fetched with
  `starting_after=<last id of page 1>` → 200, cursor derived from
  `data[-1].id`, exhaustion via `has_more`.
- **`GET /v1/reporting/report_types` rejects `limit`** ("Received
  unknown parameter: limit") but accepts `starting_after` and returns
  `has_more` — so it gets an **op-level pagination override** without
  `pageSizeParam`.
- **`GET /v1/balance` and `GET /v1/tax/settings`** are retrieves (a
  `balance` / `tax.settings` object, not a list) — shipped as `restGet`
  ops outside the pagination machinery.
- **Feature-gated 404s:** endpoints below return
  `invalid_request_error: Unrecognized request URL` for this
  key/account configuration — they are real documented endpoints but
  not routable here (feature not enabled on the account, or the
  account's pinned API version predates them).

## Verification sources

| Source | URL |
|--------|-----|
| API reference index | <https://docs.stripe.com/api> |
| Pagination (manual loop) | <https://docs.stripe.com/api/pagination> |
| Authentication / restricted keys | <https://docs.stripe.com/api/authentication> |
| Per-resource pages | `https://docs.stripe.com/api/<resource>` (the sidebar's resource URLs, cited per category below) |

Every included op was additionally **live-probed** (HTTP status +
envelope shape) on 2026-09-03; ops excluded for account-specific
reasons carry the observed error in the omission table.

## Full read-only GET inventory (v1)

**✅ = already implemented | 🆕 = added in this expansion | ❌ = omitted
(reason in the table below)**

### Core resources (`docs.stripe.com/api/balance_transactions`, `/charges`,
`/customers`, `/disputes`, `/events`, `/files`, `/file_links`,
`/payment_intents`, `/setup_intents`, `/payouts`, `/refunds`, `/balance`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/balance` | 🆕 `getBalance` | Retrieve, not a list — `restGet` |
| GET | `/v1/balance_transactions` | 🆕 `listBalanceTransactions` | Paginated |
| GET | `/v1/charges` | 🆕 `listCharges` | Paginated |
| GET | `/v1/customers` | ✅ `listCustomers` | Paginated |
| GET | `/v1/disputes` | 🆕 `listDisputes` | Paginated |
| GET | `/v1/events` | 🆕 `listEvents` | Paginated |
| GET | `/v1/files` | 🆕 `listFiles` | Paginated |
| GET | `/v1/file_links` | 🆕 `listFileLinks` | Paginated |
| GET | `/v1/payment_intents` | 🆕 `listPaymentIntents` | Paginated |
| GET | `/v1/setup_intents` | 🆕 `listSetupIntents` | Paginated |
| GET | `/v1/payouts` | 🆕 `listPayouts` | Paginated |
| GET | `/v1/refunds` | 🆕 `listRefunds` | Paginated |

### Payment methods (`/payment_methods`, `/payment_method_configurations`,
`/payment_method_domains`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/payment_methods` | 🆕 `listPaymentMethods` | `type` required by Stripe (default `card`) |
| GET | `/v1/payment_method_configurations` | 🆕 `listPaymentMethodConfigurations` | Paginated |
| GET | `/v1/payment_method_domains` | 🆕 `listPaymentMethodDomains` | Paginated |

### Products & pricing (`/products`, `/prices`, `/coupons`,
`/promotion_codes`, `/tax_codes`, `/tax_rates`, `/shipping_rates`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/products` | 🆕 `listProducts` | Paginated |
| GET | `/v1/prices` | 🆕 `listPrices` | Paginated |
| GET | `/v1/coupons` | 🆕 `listCoupons` | Paginated |
| GET | `/v1/promotion_codes` | 🆕 `listPromotionCodes` | Paginated |
| GET | `/v1/tax_codes` | 🆕 `listTaxCodes` | Paginated (reference data) |
| GET | `/v1/tax_rates` | 🆕 `listTaxRates` | Paginated |
| GET | `/v1/shipping_rates` | 🆕 `listShippingRates` | Paginated |

### Checkout & payment links (`/checkout/sessions`, `/payment-link`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/checkout/sessions` | 🆕 `listCheckoutSessions` | Paginated |
| GET | `/v1/payment_links` | 🆕 `listPaymentLinks` | Paginated |

### Billing (`/invoices`, `/invoiceitems`, `/credit_notes`,
`/billing/alert`, `/billing/credit-grant`, `/billing/meter`,
`/invoice-payment`, `/invoice-rendering-template`, `/plans`, `/quotes`,
`/subscriptions`, `/subscription_schedules`,
`/customer_portal/configurations`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/invoices` | 🆕 `listInvoices` | Paginated |
| GET | `/v1/invoiceitems` | 🆕 `listInvoiceItems` | Paginated |
| GET | `/v1/invoice_payments` | 🆕 `listInvoicePayments` | Paginated |
| GET | `/v1/invoice_rendering_templates` | 🆕 `listInvoiceRenderingTemplates` | Paginated |
| GET | `/v1/credit_notes` | 🆕 `listCreditNotes` | Paginated |
| GET | `/v1/billing/alerts` | 🆕 `listAlerts` | Paginated |
| GET | `/v1/billing/credit_grants` | 🆕 `listCreditGrants` | Paginated |
| GET | `/v1/billing/meters` | 🆕 `listMeters` | Paginated |
| GET | `/v1/billing_portal/configurations` | 🆕 `listBillingPortalConfigurations` | Paginated — note the `/v1/billing_portal/` prefix, not `/customer_portal/` |
| GET | `/v1/plans` | 🆕 `listPlans` | Paginated |
| GET | `/v1/quotes` | 🆕 `listQuotes` | Paginated |
| GET | `/v1/subscriptions` | 🆕 `listSubscriptions` | Paginated |
| GET | `/v1/subscription_schedules` | 🆕 `listSubscriptionSchedules` | Paginated |

### Connect (`/accounts`, `/application_fees`, `/country_specs`,
`/topups`, `/transfers`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/accounts` | 🆕 `listAccounts` | Paginated (connected accounts; empty without Connect) |
| GET | `/v1/application_fees` | 🆕 `listApplicationFees` | Paginated |
| GET | `/v1/country_specs` | 🆕 `listCountrySpecs` | Paginated (reference data) |
| GET | `/v1/topups` | 🆕 `listTopups` | Paginated |
| GET | `/v1/transfers` | 🆕 `listTransfers` | Paginated |

### Fraud — Radar (`/radar/early_fraud_warnings`, `/radar/value_lists`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/radar/early_fraud_warnings` | 🆕 `listEarlyFraudWarnings` | Paginated |
| GET | `/v1/radar/value_lists` | 🆕 `listValueLists` | Paginated |

### Terminal (`/terminal/locations`, `/terminal/readers`,
`/terminal/configurations`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/terminal/locations` | 🆕 `listTerminalLocations` | Paginated |
| GET | `/v1/terminal/readers` | 🆕 `listTerminalReaders` | Paginated |
| GET | `/v1/terminal/configurations` | 🆕 `listTerminalConfigurations` | Paginated |

### Identity (`/identity/verification_sessions`,
`/identity/verification_reports`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/identity/verification_sessions` | 🆕 `listIdentityVerificationSessions` | Paginated |
| GET | `/v1/identity/verification_reports` | 🆕 `listIdentityVerificationReports` | Paginated |

### Tax (`/tax/registrations`, `/tax/settings`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/tax/registrations` | 🆕 `listTaxRegistrations` | Paginated |
| GET | `/v1/tax/settings` | 🆕 `getTaxSettings` | Retrieve — `restGet` |

### Climate (`/climate/products`, `/climate/orders`, `/climate/suppliers`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/climate/products` | 🆕 `listClimateProducts` | Paginated (catalog data, present on all accounts) |
| GET | `/v1/climate/orders` | 🆕 `listClimateOrders` | Paginated |
| GET | `/v1/climate/suppliers` | 🆕 `listClimateSuppliers` | Paginated |

### Reporting (`/reporting/report_types`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/reporting/report_types` | 🆕 `listReportTypes` | **Op-level pagination override** — rejects `limit`, accepts `starting_after`; no `pageSizeParam` |

### Financial Connections (`/financial_connections/accounts`)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/financial_connections/accounts` | 🆕 `listFinancialConnectionsAccounts` | Paginated |

### Nested (foreign-key) lists — three high-value inclusions

These require a caller-supplied parent id; the live tests source the id
from the parent list op at runtime and **skip when the parent list is
empty** (a fresh test account frequently has none).

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/v1/subscription_items` | 🆕 `listSubscriptionItems` | `subscription` required; id sourced from `listSubscriptions` |
| GET | `/v1/invoices/{invoice}/lines` | 🆕 `listInvoiceLineItems` | `invoice` required; id sourced from `listInvoices` |
| GET | `/v1/customers/{customer}/balance_transactions` | 🆕 `listCustomerBalanceTransactions` | `customer` required; id sourced from `listCustomers` |

## Omissions (documented, not forgotten)

| Resource family | Endpoints | Reason (live-observed 2026-09-03) |
|-----------------|-----------|-----------------------------------|
| Issuing | `/v1/issuing/cards`, `/cardholders`, `/transactions`, `/authorizations`, `/disputes`, `/settlements` | `400` — "Your account is not set up to use Issuing." Feature-gated server-side; add if the provisioning account enables Issuing. |
| Feature/version-gated 404 | `/v1/test_clocks`, `/v1/radar/reviews`, `/v1/sigma/scheduled_queries`, `/v1/capital/financing_offers`, `/v1/capital/financing_summaries`, `/v1/treasury/*`, `/v1/payment_records`, `/v1/crypto/*`, `/v1/tax/forms`, `/v1/tax/transactions`, `/v1/financial_connections/sessions` | `404` — "Unrecognized request URL": not routed for this key/account configuration (feature not enabled or pinned API version predates the endpoint). Real documented endpoints; add if the provisioning account routes them. |
| Create-only (no GET) | Tokens, Ephemeral Keys, Confirmation Tokens, Customer Sessions, Account/Login Links, Billing Portal Sessions, Privacy Tokens, Meter Events + Adjustments (write), App Secrets, Account Links | No read surface — the read-only recipe cannot express them. |
| v2 API surface | `/v2/core/accounts`, `/v2/core/events`, `/v2/billing/meter-events`, `/v2/meter-event-streams`, Payment Records, Account Evaluation, Reserves, Balance Settings | Separate API surface with its own envelope, versioning, and pagination (page-token model); out of scope for this v1 recipe. Add as a sibling guide if ever needed. |
| Retrieve-by-id drill-downs | `GET /v1/charges/{id}`, `/v1/invoices/{id}`, `/v1/payment_intents/{id}`, … | Deliberate: Stripe **list items are the full object**, not summaries — a retrieve adds nothing a list item doesn't already carry, and requires a caller-supplied id. Omitted; the list ops cover read workflows. |
| Remaining nested foreign-key lists | customer cash-balance transactions, customer tax IDs, radar value-list items, external accounts, setup attempts, application-fee refunds, transfer reversals, active entitlements, credit-balance transactions/summaries, financial-connections transactions | Same class as the three included nested ops (caller-supplied parent id required); included only when a workflow needs them — each is one op + one chain test. |
| Mandates | `/v1/mandates/{id}` | Retrieve-only (no list endpoint exists) — falls under the retrieve-by-id rule above. |
| Discounts | `/v1/discounts/...` | No list or bare retrieve; only nested on customer/subscription/invoice objects. |
| Webhooks | `/v1/webhook_endpoints` list | Read-only and routable (200 observed) but **secret-bearing**: the list response includes each endpoint's signing secret. Excluded to keep this recipe's read surface secret-free; add only if a workflow needs it, with attention to output redaction. |
