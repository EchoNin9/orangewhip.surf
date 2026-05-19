# Claude Code Rules — orangewhip.surf

Project context, architecture, directory layout, naming, and design system live in [.cursorrules](.cursorrules). Read that first. The rules below override or extend it for Claude Code specifically.

## Branch & merge policy
- **Default target is `develop`.** Work happens on the current `claude/...` worktree branch, then gets merged into `develop` and pushed. CI deploys `develop` → staging.
- **Never open a PR to `main` or merge to `main` unless I explicitly ask.** "Ship it", "push it", "commit it" all mean develop, not main.
- **Never force-push, never push to `main` or `stage` directly, never delete branches** without explicit approval.

## Validate, commit, push
Use the `ship-to-develop` skill for the validate → commit → merge-to-develop → push sequence. It runs the right validator for what changed (pytest, SPA typecheck/build, terraform validate, browser smoke for UI), then commits, merges to develop, and pushes. Do not skip the skill — its checks are the autonomy gate.

Once the skill reports green, commit & push autonomously without asking. Still ask before anything destructive (force-push, branch deletion, history rewrite, PR to main).
