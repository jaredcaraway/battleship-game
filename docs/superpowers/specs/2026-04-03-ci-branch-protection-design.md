# CI & Branch Protection Setup

## Summary

Add a lightweight CI gate and branch protection to prevent untested code from reaching production. Current flow (push to main -> Hostinger auto-deploys) stays the same, but code must go through a PR with passing tests first.

## New Workflow

```
feature branch -> push -> open PR -> CI runs tests -> merge to main -> auto-deploy
```

Local pre-push hook provides an early safety net before code reaches GitHub.

## Components

### 1. GitHub Actions CI Workflow

**File:** `.github/workflows/ci.yml`

- **Trigger:** Pull requests targeting `main`
- **Environment:** Node.js 22 on ubuntu-latest
- **Steps:** Checkout, install dependencies (`npm ci`), run tests (`npm test`)
- **Single job**, no matrix — project targets one Node version

### 2. Branch Protection on `main`

- Require the CI status check to pass before merge
- No PR review requirement (solo developer, Claude auto-reviews)
- Block direct pushes to main
- Configured via `gh api` CLI

### 3. Fix `.env.test`

- Update `DATABASE_URL` from PostgreSQL (`postgresql://localhost/battleship_test`) to MySQL (`mysql://user:password@localhost:3306/battleship_test`)
- Existing tests are unit tests that don't hit the database, so this is a correctness fix for when integration tests are added later

### 4. Pre-push Git Hook

**File:** `.git/hooks/pre-push` (local only, not committed)

- Runs `npm test` before allowing any push
- Exits non-zero to block push if tests fail
- Lightweight — current test suite runs in under a second

## What Doesn't Change

- `npm start`, `npm run dev`, `npm test` scripts unchanged
- No new dependencies
- No build step added
- Hostinger deployment trigger unchanged (push to main)
- Test files and structure unchanged

## Constraints

- Pre-push hook is local to this machine (`.git/hooks/` is not tracked by git)
- Branch protection requires the repo to be on a GitHub plan that supports it (free repos support basic ruleset protection)
