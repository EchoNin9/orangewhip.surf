# Dependabot Remediation Plan

This document is the **canonical plan** for resolving Dependabot security and version-update warnings in orangewhip.surf. Use it when Dependabot fixes cannot be completed in one session.

---

## How to Reference This Plan in New Agent Sessions

When starting a new session to continue Dependabot work, tell the agent:

> **"Follow the Dependabot remediation plan in `docs/dependabot-remediation-plan.md`. Start with the highest-priority unresolved items. Update the plan's progress section as you complete work."**

Or more concisely:

> **"@docs/dependabot-remediation-plan.md — continue Dependabot fixes from where we left off."**

---

## Severity Order (Most → Least Severe)

Resolve in this order:

| Priority | Severity | Description | Typical Action |
|----------|----------|-------------|----------------|
| 1 | **Critical** | Known exploitable vulnerabilities (CVSS 9.0+) | Update immediately; may require breaking changes |
| 2 | **High** | Serious vulnerabilities (CVSS 7.0–8.9) | Update within days; test thoroughly |
| 3 | **Medium** | Moderate risk (CVSS 4.0–6.9) | Update in next maintenance window |
| 4 | **Low** | Minor or informational | Update when convenient |
| 5 | **Version updates** | No security impact, dependency freshness | Batch with other updates |

---

## Dependency Files in This Project

| File | Ecosystem | Notes |
|------|-----------|-------|
| `src/web/spa/package.json` | npm | React SPA (Vite, Tailwind, etc.) |
| `src/web/spa/package-lock.json` | npm | Lockfile — run `npm audit fix` or update deps |
| `src/lambda/requirements-test.txt` | pip | pytest, boto3 for Lambda tests |
| `infra/layer_requirements.txt` | pip | Pillow for thumbnail Lambda layer |
| `infra/versions.tf` | Terraform | AWS, archive, tls providers |
| `infra/.terraform.lock.hcl` | Terraform | Provider lockfile |
| `.github/workflows/main.yml` | GitHub Actions | actions/checkout, aws-actions, setup-python, setup-node, hashicorp/setup-terraform |
| `.github/workflows/dev.yml` | GitHub Actions | Same as main.yml |

**Excluded:** `_archive/` — archived code, not in production. Fix only if explicitly requested.

---

## Remediation Workflow (Per Item)

1. **Identify** the Dependabot PR or Security tab alert.
2. **Classify** severity using the table above.
3. **Update** the dependency:
   - **npm:** `npm update <pkg>` or bump version in `package.json`, then `npm install`
   - **pip:** Bump in `requirements*.txt`, reinstall, run tests
   - **Terraform:** Update `versions.tf` and run `terraform init -upgrade`
   - **GitHub Actions:** Update `uses: org/action@vX` to latest major
4. **Test:** Run `pytest src/lambda/tests -v` and `npm run build` in `src/web/spa`.
5. **Commit** with message: `deps: <ecosystem> bump <package> to <version> (Dependabot <severity>)`.

---

## Progress Log (Update as You Go)

Use this section to track what’s done and what’s left. Edit in place.

### Completed
- 2025-02-15: npm bump vite to 6.4.1 (Dependabot moderate — esbuild GHSA-67mh-4wv8-2f99)
- 2025-02-15: Verified main project (`src/web/spa`, `src/lambda`, `infra`) has no open Dependabot alerts. All 31 open alerts are in `_archive/` (excluded per plan).

### In Progress
- *(None)*

### Pending (by severity)
- **Critical:** *(none in production code)*
- **High:** *(none in production code)*
- **Medium:** *(none in production code)*
- **Low / Version:** GitHub Actions (actions/checkout v4, setup-terraform v3) — optional freshness updates when convenient. All alerts in `_archive/` are excluded.

---

## Notes for Multi-Session Work

- **One PR per ecosystem** (npm, pip, Terraform, Actions) is often easier to review.
- **Don’t batch critical + low** in the same PR; prioritize critical first.
- **Run full CI** before merging: `pytest` and `npm run build` must pass.
- **Update this file** when you complete or defer items so the next agent knows the state.
