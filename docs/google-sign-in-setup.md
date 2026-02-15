# Enable Google Sign-In (Sign in with Google) for OWS

This guide walks through enabling **Sign in with Google** for orangewhip.surf using AWS Cognito as the identity broker. OWS already uses Cognito for email/password auth; adding Google adds a federated identity provider (IdP).

---

## Overview

| Component | Role |
|-----------|------|
| **Google Cloud Console** | OAuth 2.0 credentials (Client ID, Client Secret) |
| **AWS Cognito** | User pool, hosted UI, token issuance |
| **OWS SPA** | Redirects to Cognito Hosted UI; handles callback with tokens |

Users click "Sign in with Google" → redirect to Cognito Hosted UI → choose Google → authenticate → redirect back to your app with Cognito tokens. Cognito creates or links a user in the pool and issues JWTs as usual.

---

## Prerequisites

- AWS Cognito User Pool (OWS already has this)
- Cognito domain configured (e.g. `ows-auth.auth.us-east-1.amazoncognito.com`)
- Google Cloud account

---

## Part 1: Google Cloud Console

### 1.1 Create or select a project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one (e.g. "Orange Whip Surf")

### 1.2 Configure OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. Choose **External** (unless you use Google Workspace)
3. Fill required fields:
   - **App name:** Orange Whip Surf (or your app name)
   - **User support email:** your email
   - **Developer contact:** your email
4. **Authorized domains** — **critical:**
   - Click **Add domain**
   - Add **`amazoncognito.com`** (required for Cognito Hosted UI)
   - If you use a custom Cognito domain (e.g. `auth.orangewhip.surf`), add **`orangewhip.surf`** as well
5. Save

### 1.3 Create OAuth 2.0 credentials

1. **APIs & Services → Credentials**
2. **Create credentials → OAuth client ID**
3. **Application type:** Web application
4. **Name:** e.g. "OWS Cognito"
5. **Authorized JavaScript origins:**
   - `https://ows-auth.auth.us-east-1.amazoncognito.com` (replace with your Cognito domain)
   - For local dev: `http://localhost:5173` (or your Vite port)
   - For staging: `https://stage.orangewhip.surf`
   - For production: `https://orangewhip.surf`
6. **Authorized redirect URIs:**
   - `https://ows-auth.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
   - (No trailing slash; must match exactly.)
7. Create and copy **Client ID** and **Client Secret**

---

## Part 2: AWS Cognito

### 2.1 Add Google as identity provider

**Option A: AWS Console**

1. **Cognito → User pools → your pool (ows-user-pool)**
2. **Sign-in experience → Federated identity provider sign-in**
3. **Add identity provider → Google**
4. Enter **Client ID** and **Client Secret** from Google
5. **Map attributes:**
   - User pool attribute **email** ← Google attribute **email**
   - (Add `name` → `name` or `preferred_username` if desired)
6. Save

**Option B: Terraform**

Add to `infra/main.tf` (or a dedicated `cognito-idp.tf`):

```hcl
resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.googleOAuthClientId
    client_secret    = var.googleOAuthClientSecret
    authorize_scopes = "email openid profile"
  }

  attribute_mapping = {
    email       = "email"
    name        = "name"
    username    = "sub"
  }
}
```

Add variables in `variables.tf`:

```hcl
variable "googleOAuthClientId" {
  description = "Google OAuth 2.0 Client ID for Cognito federated sign-in."
  type        = string
  default     = ""
}

variable "googleOAuthClientSecret" {
  description = "Google OAuth 2.0 Client Secret (sensitive)."
  type        = string
  default     = ""
  sensitive   = true
}
```

Pass values via `-var` or `tfvars` (never commit secrets).

### 2.2 Configure app client for Hosted UI

The Cognito app client must support the Hosted UI flow and Google.

**Required settings:**

| Setting | Value |
|---------|-------|
| **Callback URL(s)** | `https://orangewhip.surf/`, `https://stage.orangewhip.surf/`, `http://localhost:5173/` (dev) |
| **Sign out URL(s)** | Same as above |
| **Identity providers** | Cognito user pool, **Google** |
| **OAuth 2.0 grant types** | **Authorization code grant** (recommended for production) |
| **OpenID Connect scopes** | `email`, `openid`, `profile` |

**Terraform example** (extend `aws_cognito_user_pool_client.web`):

```hcl
callback_urls = [
  "https://orangewhip.surf/",
  "https://stage.orangewhip.surf/",
  "http://localhost:5173/"
]
logout_urls = [
  "https://orangewhip.surf/",
  "https://stage.orangewhip.surf/",
  "http://localhost:5173/"
]
allowed_oauth_flows                  = ["code"]
allowed_oauth_flows_user_pool_client = true
allowed_oauth_scopes                 = ["email", "openid", "profile"]
supported_identity_providers         = ["COGNITO", "Google"]
```

---

## Part 3: Frontend integration

### 3.1 Redirect to Hosted UI for Google sign-in

Add a "Sign in with Google" button that redirects to Cognito Hosted UI with `identity_provider=Google`:

```javascript
// Example: build Cognito redirect URL
const domain = 'ows-auth.auth.us-east-1.amazoncognito.com';  // from config
const clientId = window.COGNITO_CLIENT_ID;
const redirectUri = encodeURIComponent(window.location.origin + '/');
const scope = 'openid email profile';
const responseType = 'code';  // Authorization Code grant

const url = `https://${domain}/oauth2/authorize?` +
  `identity_provider=Google` +
  `&response_type=${responseType}` +
  `&client_id=${clientId}` +
  `&redirect_uri=${redirectUri}` +
  `&scope=${scope}`;

window.location.href = url;
```

### 3.2 Handle callback (parse tokens from redirect)

After Google sign-in, Cognito redirects to your callback URL with `?code=...` (authorization code). Use PKCE to exchange the code for tokens:

1. On app load, check `/` path for `?code=` query param.
2. If present, exchange `code` for tokens via Cognito token endpoint.
3. Store tokens (same format as `auth.js` uses: `ows_access_token`, etc.).
4. Remove `?code=...` from URL and redirect to `/`.
5. Call `refreshAuth()` so the app sees the user as signed in.

**PKCE flow:** Generate `code_verifier` and `code_challenge` before redirect; store `code_verifier` in sessionStorage; send `code_challenge` in the authorize URL; include `code_verifier` when exchanging the code.

See [AWS: Using PKCE in authorization code grants](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html).

### 3.3 Extend auth.js

`auth.js` currently stores tokens from `InitiateAuth`. For Hosted UI callbacks, add logic to:

- Detect `?code=` in URL.
- Exchange code for tokens.
- Call `storeTokens()` with the same format.
- Optionally expose `signInWithGoogle()` that builds the redirect URL.

---

## Part 4: Common mistakes to avoid

### 4.1 Google OAuth consent screen

| Mistake | Fix |
|---------|-----|
| Forgetting **amazoncognito.com** in Authorized domains | Google will reject the redirect. Add it before creating credentials. |
| Using wrong domain (e.g. `cognito.amazonaws.com`) | Use `amazoncognito.com` only. |
| Custom Cognito domain: not adding your app domain | If using `auth.orangewhip.surf`, add `orangewhip.surf` to Authorized domains. |

### 4.2 Redirect URIs

| Mistake | Fix |
|---------|-----|
| Trailing slash mismatch | `https://.../oauth2/idpresponse` — no trailing slash. Must match exactly. |
| Wrong Cognito domain | Use your pool’s domain prefix and region (e.g. `ows-auth.auth.us-east-1.amazoncognito.com`). |
| Wrong callback URL in app client | Callback URLs in Cognito must match where you redirect after login (e.g. `https://orangewhip.surf/`). |

### 4.3 Scopes

| Mistake | Fix |
|---------|-----|
| Using `OpenID` instead of `openid` | Use lowercase `openid`; `OpenID` causes `400 Invalid_scope` from Google. |
| Missing `email` or `profile` | Include `email`, `openid`, `profile` so Cognito can map attributes. |

### 4.4 Cognito

| Mistake | Fix |
|---------|-----|
| Email not mapped from Google | Map Google `email` → User pool `email` in IdP config. |
| Email required but IdP doesn’t send it | Ensure Google consent includes email scope. |
| Using Implicit grant in production | Prefer `response_type=code` (Authorization Code) with PKCE. |
| App client missing callback URLs | Add callback and sign-out URLs for your app origins. |
| Google not in supported identity providers | Enable "Google" in app client settings. |

### 4.5 Token handling

| Mistake | Fix |
|---------|-----|
| Using access token where ID token is expected | Use ID token for user identity; access token for API calls. |
| Wrong region in JWKS | Use the same region as your user pool (e.g. `us-east-1`). |

### 4.6 Testing

| Mistake | Fix |
|---------|-----|
| Testing only in production | Add `http://localhost:5173` to callback URLs and Google origins for local dev. |
| Caching old redirect | Clear cookies or use incognito for testing. |

---

## Part 5: Verification

1. **Cognito → User pools → your pool → App integration**
   - Confirm domain: `ows-auth.auth.us-east-1.amazoncognito.com`)
   - Confirm app client has callback URLs and Google enabled.

2. **Test Hosted UI directly:**
   ```
   https://ows-auth.auth.us-east-1.amazoncognito.com/login?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=https://orangewhip.surf/&scope=openid+email+profile
   ```
   You should see "Sign in with Google" and be able to complete the flow.

3. **In your app:** Click "Sign in with Google" → redirect → sign in → redirect back with tokens.

---

## Reference: OWS-specific values

| Item | Value |
|------|-------|
| Cognito domain prefix | `ows-auth` (from `cognitoDomainPrefix` variable) |
| Region | `us-east-1` |

Construct full domain: `https://ows-auth.auth.us-east-1.amazoncognito.com`

---

## Further reading

- [AWS: Set up Google as a social identity provider](https://repost.aws/knowledge-center/cognito-google-social-identity-provider)
- [AWS: Using PKCE in authorization code grants](https://docs.aws.amazon.com/cognito/latest/developerguide/using-pkce-in-authorization-code.html)
- [AWS: Federated identity provider sign-in](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html)
