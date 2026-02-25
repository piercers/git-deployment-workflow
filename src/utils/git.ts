// Git command helpers

import { exec } from "./shell.js";
import * as log from "./log.js";

/**
 * Get the current branch name
 */
export function currentBranch(): string {
  return exec("git rev-parse --abbrev-ref HEAD", { silent: true });
}

/**
 * Checkout a branch
 */
export function checkout(branch: string): void {
  log.step(`Checking out ${branch}`);
  exec(`git checkout ${branch}`);
}

/**
 * Checkout a new branch from an optional starting point
 */
export function checkoutNewBranch(branch: string, from?: string): void {
  if (from) {
    log.step(`Creating branch ${branch} from ${from}`);
    exec(`git checkout -b ${branch} ${from}`);
  } else {
    log.step(`Creating branch ${branch}`);
    exec(`git checkout -b ${branch}`);
  }
}

/**
 * Pull from remote
 */
export function pull(remote: string = "origin", branch?: string): void {
  const target = branch || currentBranch();
  log.step(`Pulling latest from ${remote}/${target}`);
  exec(`git pull ${remote} ${target}`);
}

/**
 * Push a new branch with upstream tracking
 */
export function pushNewBranch(branch: string, remote: string = "origin"): void {
  log.step(`Pushing ${branch} to ${remote} with upstream tracking`);
  exec(`git push -u ${remote} ${branch}`);
}

/**
 * Push the current branch
 */
export function push(remote: string = "origin"): void {
  const branch = currentBranch();
  log.step(`Pushing ${branch} to ${remote}`);
  exec(`git push ${remote} ${branch}`);
}

/**
 * Create a tag
 */
export function createTag(tag: string): void {
  log.step(`Creating tag ${tag}`);
  exec(`git tag ${tag}`);
}

/**
 * Push a tag to remote
 */
export function pushTag(tag: string, remote: string = "origin"): void {
  log.step(`Pushing tag ${tag} to ${remote}`);
  exec(`git push ${remote} ${tag}`);
}

/**
 * Create and push a tag
 */
export function tagAndPush(tag: string, remote: string = "origin"): void {
  createTag(tag);
  pushTag(tag, remote);
}

/**
 * Delete a remote branch
 */
export function deleteRemoteBranch(branch: string, remote: string = "origin"): void {
  log.step(`Deleting remote branch ${remote}/${branch}`);
  exec(`git push ${remote} --delete ${branch}`);
}

/**
 * Delete a local branch
 */
export function deleteLocalBranch(branch: string): void {
  log.step(`Deleting local branch ${branch}`);
  exec(`git branch -D ${branch}`);
}

/**
 * Fetch from remote
 */
export function fetch(args: string = ""): void {
  log.step("Fetching from remote");
  exec(`git fetch origin ${args}`.trim());
}

/**
 * Fetch tags
 */
export function fetchTags(): void {
  log.step("Fetching tags");
  exec("git fetch origin --tags");
}

/**
 * Cherry-pick a commit
 */
export function cherryPick(sha: string): void {
  log.step(`Cherry-picking ${sha}`);
  exec(`git cherry-pick ${sha}`);
}

/**
 * List tags matching a pattern
 */
export function listTags(pattern: string): string[] {
  try {
    const result = exec(`git tag -l "${pattern}"`, { silent: true });
    if (!result) return [];
    return result.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get the next RC number for a date.
 * Returns null if no base rc-{date} tag exists (use `release cut` first).
 * e.g., if rc-2026-02-15 and rc-2026-02-15-2 exist, returns 3
 */
export function getNextRcNumber(date: string): number | null {
  const baseTags = listTags(`rc-${date}`);
  if (baseTags.length === 0) return null;

  const numberedTags = listTags(`rc-${date}-*`);
  let maxNumber = 1; // base tag counts as 1
  for (const tag of numberedTags) {
    const match = tag.match(new RegExp(`^rc-${date}-(\\d+)$`));
    if (match) {
      maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
    }
  }

  return maxNumber + 1;
}

/**
 * Get the next hotfix RC number for a date
 * e.g., if rc-2026-02-15-hotfix-1 exists, returns 2
 */
export function getNextHotfixRcNumber(date: string): number {
  const tags = listTags(`rc-${date}-hotfix-*`);
  if (tags.length === 0) return 1;

  let maxNumber = 0;
  for (const tag of tags) {
    const match = tag.match(new RegExp(`^rc-${date}-hotfix-(\\d+)$`));
    if (match) {
      maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
    }
  }

  return maxNumber + 1;
}

/**
 * Get the next patch number for a production tag.
 * e.g., if v2026-02-15 and v2026-02-15.1 exist, returns 2
 */
export function getNextPatchNumber(date: string): number {
  const patchTags = listTags(`v${date}.*`);
  if (patchTags.length === 0) return 1;

  let maxPatch = 0;
  for (const tag of patchTags) {
    const match = tag.match(new RegExp(`^v${date}\\.(\\d+)$`));
    if (match) {
      maxPatch = Math.max(maxPatch, parseInt(match[1], 10));
    }
  }

  return maxPatch + 1;
}
