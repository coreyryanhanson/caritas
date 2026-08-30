---
kind: api
schemaVersion: 1
domains:
  - mastodon.social
shortName: Mastodon
icon: 🐘
apiHost: https://mastodon.social
auth:
  # authorization_code + PKCE: user-token reads (timelines, accounts, …).
  # App tokens are rejected by most read endpoints on Mastodon — user
  # consent in the browser is required. Guide defaults to mastodon.social;
  # other instances need their own guide (per-instance OAuth).
  kind: oauth2
  grant: authorization_code
  tokenUrl: https://mastodon.social/oauth/token
  authorizeUrl: https://mastodon.social/oauth/authorize
  clientId:
    secret: client_key
  clientSecret:
    secret: client_secret
  scopes:
    - read
  tokenEndpointAuthMethod: client_secret_post
responseShape:
  format: json
  charset: utf-8
verified: "2026-08-29"
docs: https://docs.joinmastodon.org/
operations:
  - name: verifyCredentials
    via: restGet
    path: /api/v1/accounts/verify_credentials
    accept: json
    params: {}
---
