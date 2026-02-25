# Deployment Reference

Quick reference for shipping code through staging and production. Everything can be done from the GitHub Actions tab — no local CLI required.

---

## Standard Release (development -> staging -> production)

### 1. Cut a release to staging

**Actions tab -> Release Lifecycle -> action: `cut`, date: `2026-02-23` -> Run workflow**

This branches `release/2026-02-23` off `development`, tags `rc-2026-02-23`, and **staging deploys automatically** from the tag.

### 2. Fix something on staging (if needed)

Locally:

```sh
workflow release fix 2026-02-23 PROJ-310 broken-search
# make your fix, push commits
# merge the PR on GitHub
```

Then re-tag staging:

**Actions tab -> Release Lifecycle -> action: `rc`, date: `2026-02-23` -> Run workflow**

Tags a new RC (`rc-2026-02-23-2`). **Staging redeploys automatically.**

### 3. Pull more work from development into staging (if needed)

These still use the CLI since they involve branch selection or SHAs:

```sh
# Merge all of development:
workflow release update 2026-02-23

# Or cherry-pick specific commits:
workflow release cherry-pick 2026-02-23 include-search abc123 def456
```

Merge the PR on GitHub, then re-tag staging:

**Actions tab -> Release Lifecycle -> action: `rc`, date: `2026-02-23` -> Run workflow**

### 4. Promote to production

**Actions tab -> Release Lifecycle -> action: `promote`, date: `2026-02-23` -> Run workflow**

Tags `v2026-02-23`. **Production deploys automatically.** A forward-merge PR into `development` opens and auto-merges. The release branch deletes itself after.

---

## Hotfix (production emergency)

### 1. Create the hotfix branch

**Actions tab -> Hotfix Lifecycle -> action: `create`, date: `2026-02-23` -> Run workflow**

Branches `hotfix/2026-02-23` from the latest production tag for that date (`v2026-02-23` or `v2026-02-23.N`).

### 2. Make and ship the fix to staging

Locally:

```sh
workflow hotfix fix 2026-02-23 PROJ-401 null-pointer-crash
# make your fix, push commits
# merge the PR on GitHub
```

Then tag for staging:

**Actions tab -> Hotfix Lifecycle -> action: `rc`, date: `2026-02-23` -> Run workflow**

Tags `rc-2026-02-23-hotfix-1`. **Staging deploys automatically.**

### 3. Promote to production

**Actions tab -> Hotfix Lifecycle -> action: `promote`, date: `2026-02-23` -> Run workflow**

Tags `v2026-02-23.1`. **Production deploys automatically.** Forward-merge PR and branch cleanup happen automatically, same as a standard release.

---

## Syncing back up

After any production deploy (release or hotfix), a forward-merge PR is automatically opened and set to auto-merge into `development`. Once checks pass, it merges itself. The branch deletes itself after.

**You don't need to do anything.** If auto-merge can't proceed (conflicts, failing checks), you'll see the PR sitting open — resolve conflicts and merge it manually using a **merge commit** (not squash).

If you need to open the forward-merge PR manually for any reason:

**Actions tab -> Auto Forward-Merge -> fill in branch, tag, and type -> Run workflow**

Or from the CLI:

```sh
workflow release forward-merge 2026-02-23
# or
workflow hotfix forward-merge 2026-02-23
```

Manual branch cleanup (only if auto-cleanup didn't run):

```sh
workflow release cleanup 2026-02-23
# or
workflow hotfix cleanup 2026-02-23
```

---

## What happens automatically

| You do | What happens next |
|---|---|
| Merge feature PR into `development` | Dev deploys |
| Run Release Lifecycle: `cut` or `rc` | Staging deploys |
| Run Hotfix Lifecycle: `rc` | Staging deploys |
| Run Release Lifecycle: `promote` | Production deploys, forward-merge PR opens + auto-merges |
| Run Hotfix Lifecycle: `promote` | Production deploys, forward-merge PR opens + auto-merges |
| Forward-merge PR merges | Release/hotfix branch deletes |

---

## GitHub Actions Reference

Nine workflows power the automation. Here's what each one does, when it fires, and why it exists.

### Release Lifecycle (`release-lifecycle.yml`)

**When:** Manually triggered from the Actions tab (`workflow_dispatch`).

**Inputs:** Action dropdown (`cut`, `rc`, `promote`) and a date (`YYYY-MM-DD`).

**What it does:**
- **`cut`** — Creates `release/<date>` from `development`, tags `rc-<date>`, creates a GitHub pre-release. Staging deploys from the tag.
- **`rc`** — Finds the next RC number, tags `rc-<date>-N` on the release branch, creates a GitHub pre-release. Staging redeploys.
- **`promote`** — Tags `v<date>` on the release branch, creates a GitHub release. Production deploys from the tag.

**Why:** Replaces the local CLI commands `workflow release cut/rc/promote`. The engineer stays in the browser — no terminal, no git checkout, no local state.

---

### Hotfix Lifecycle (`hotfix-lifecycle.yml`)

**When:** Manually triggered from the Actions tab (`workflow_dispatch`).

**Inputs:** Action dropdown (`create`, `rc`, `promote`) and a date (`YYYY-MM-DD`).

**What it does:**
- **`create`** — Finds the latest production tag for the date, creates `hotfix/<date>` from it.
- **`rc`** — Tags `rc-<date>-hotfix-N` on the hotfix branch, creates a GitHub pre-release. Staging deploys.
- **`promote`** — Tags `v<date>.N` on the hotfix branch, creates a GitHub release. Production deploys.

**Why:** During a production incident, fewer tools means fewer mistakes. Click a button instead of running CLI commands under pressure.

---

### Deploy Dev (`deploy-dev.yml`)

**When:** Push to `development` (i.e., every time a feature PR is squash-merged).

**What it does:** Builds the project, deploys to the dev environment, posts a Slack notification, and comments on the merged PR with a link to the deploy run.

**Why:** Dev should always reflect the latest state of `development`. No one should have to remember to deploy after merging a feature.

**Concurrency:** Cancels any in-progress dev deploy if a newer push arrives.

---

### Deploy Staging (`deploy-staging.yml`)

**When:** Any tag matching `rc-*` is pushed. This covers:
- `rc-2026-02-23` (first RC from release cut)
- `rc-2026-02-23-2` (subsequent RC from release rc)
- `rc-2026-02-23-hotfix-1` (hotfix RC from hotfix rc)

**What it does:** Parses the tag to determine whether it's a release or hotfix RC, builds, deploys to staging, appends deploy status to the GitHub Release body, and sends a Slack notification.

**Why:** Staging deploys should be a side effect of tagging, not a manual step. The engineer tags the RC and walks away.

**Concurrency:** Cancels any in-progress staging deploy if a newer RC is tagged.

---

### Deploy Production (`deploy-production.yml`)

**When:** Any tag matching `v*` is pushed. This covers:
- `v2026-02-23` (release promotion)
- `v2026-02-23.1` (hotfix promotion)

**What it does:** Builds, deploys to production, runs a health check, updates the GitHub Release body with deploy status, sends a Slack notification, and fires a `repository_dispatch` event to trigger the forward-merge workflow.

**Why:** Production deploys are the highest-stakes operation. This workflow adds a health check and automatically kicks off the forward-merge so fixes don't get lost.

**Concurrency:** Never cancels an in-progress production deploy.

---

### Auto Forward-Merge (`auto-forward-merge.yml`)

**When:** Automatically triggered by the production deploy workflow via `repository_dispatch`. Can also be triggered manually via `workflow_dispatch` in the Actions tab.

**What it does:** Checks whether the release/hotfix branch has commits that `development` doesn't. If so, opens a PR from the release/hotfix branch into `development` with the `forward-merge` label and enables auto-merge. Skips if a forward-merge PR already exists or if there's nothing to merge.

**Why:** Engineers forget to forward-merge. When they do, fixes made on the release branch silently regress in the next release. This eliminates that risk entirely.

---

### Auto Cleanup (`auto-cleanup.yml`)

**When:** A pull request is merged into `development` where the source branch is `release/*` or `hotfix/*` (i.e., a forward-merge PR).

**What it does:** Deletes the remote release/hotfix branch, comments on the PR confirming cleanup and listing the preserved tags, and sends a Slack notification.

**Why:** Stale release and hotfix branches clutter the repo. Tags are the permanent record of what shipped — the branches are disposable once forward-merged.

---

### PR Validation (`pr-validation.yml`)

**When:** Any pull request is opened, updated, or edited.

**What it does:**
1. **Branch naming** — Validates the source branch matches an allowed pattern (`feature/*`, `fix/*`, `chore/*`, `refactor/*`, `release/*`, `hotfix/*`, `cherry-pick/*`). Fails the check if not.
2. **Target enforcement** — Validates the PR targets the correct branch (features -> `development`, cherry-picks -> `release/*`, forward-merges -> `development`). Fails the check if wrong.
3. **Merge method hint** — Comments on the PR recommending squash merge for feature PRs or merge commit for forward-merge PRs.
4. **Build** — Runs `npm ci && npm run build` to catch compile errors before merge.

**Why:** Wrong branch targets and incorrect merge methods are the most common mistakes in this workflow. Catching them in CI is cheaper than debugging a broken release branch.

---

### CLI Build (`cli-build.yml`)

**When:** Push to `development` or PR targeting `development`, but only if files in `src/`, `package.json`, `package-lock.json`, or `tsconfig.json` changed.

**What it does:** Runs `npm ci && npm run build` across Node 18, 20, and 22. Verifies the CLI entry point (`node dist/cli.js --help`) works.

**Why:** The CLI tool is what the team uses to run this entire workflow. If it breaks, no one can cut releases. This catches TypeScript errors before they hit `development`.

---

### Workflow chain visualized

```
feature PR merged
  -> deploy-dev.yml (deploys dev)
  -> cli-build.yml (if src/ changed)

Actions tab: Release Lifecycle (cut / rc)
Actions tab: Hotfix Lifecycle (rc)
  -> rc-* tag pushed
    -> deploy-staging.yml (deploys staging)

Actions tab: Release Lifecycle (promote)
Actions tab: Hotfix Lifecycle (promote)
  -> v* tag pushed
    -> deploy-production.yml (deploys production)
      -> auto-forward-merge.yml (opens PR + auto-merge)
        -> PR merges itself
          -> auto-cleanup.yml (deletes branch)

any PR opened
  -> pr-validation.yml (checks naming, target, build)
```

---

## Quick reference

### From the Actions tab (primary method)

| Action | Workflow | Input |
|---|---|---|
| Cut release to staging | Release Lifecycle | action: `cut`, date |
| Re-tag staging | Release Lifecycle | action: `rc`, date |
| Ship to production | Release Lifecycle | action: `promote`, date |
| Start hotfix | Hotfix Lifecycle | action: `create`, date |
| Hotfix to staging | Hotfix Lifecycle | action: `rc`, date |
| Ship hotfix to production | Hotfix Lifecycle | action: `promote`, date |

### From the CLI (for local operations)

```sh
# Feature work
workflow feature start feature PROJ-142 avatar-upload
workflow feature pr

# Staging fixes (requires local code changes)
workflow release fix    2026-02-23 PROJ-310 broken-search
workflow hotfix fix     2026-02-23 PROJ-401 fix-desc

# Pull dev work into release (requires branch/SHA selection)
workflow release update      2026-02-23
workflow release cherry-pick 2026-02-23 include-search abc123 def456
```
