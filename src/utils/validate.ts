// Validation utilities

import * as log from "./log.js";
import { exec, commandExists } from "./shell.js";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ARG_REGEX = /^[a-zA-Z0-9._\-/]+$/;

/**
 * Validate that a string is safe for shell interpolation.
 * Rejects anything containing shell metacharacters.
 */
export function assertSafeArg(value: string, label: string): void {
  if (!SAFE_ARG_REGEX.test(value)) {
    log.fatal(
      `Invalid ${label}: "${value}". ` +
        `Only alphanumeric characters, hyphens, dots, underscores, and slashes are allowed.`
    );
  }
}

/**
 * Validate that a string is in YYYY-MM-DD format and represents a real calendar date
 */
export function validateDate(date: string): void {
  if (!DATE_REGEX.test(date)) {
    log.fatal(`Invalid date format: "${date}". Expected YYYY-MM-DD (e.g., 2026-02-15)`);
  }

  // Validate it's a real calendar date by checking parsed components match input
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    log.fatal(`Invalid date: "${date}" is not a valid calendar date`);
  }
}

/**
 * Validate that a category is one of the allowed types
 */
export function validateCategory(category: string): void {
  const allowed = ["feature", "fix", "chore", "refactor"];
  if (!allowed.includes(category)) {
    log.fatal(
      `Invalid category: "${category}". Must be one of: ${allowed.join(", ")}`
    );
  }
}

/**
 * Assert that a branch exists on the remote
 */
export function assertRemoteBranchExists(branch: string): void {
  try {
    exec(`git ls-remote --exit-code --heads origin ${branch}`, { silent: true });
  } catch {
    log.fatal(`Remote branch "origin/${branch}" does not exist`);
  }
}

/**
 * Assert that a branch exists locally
 */
export function assertLocalBranchExists(branch: string): void {
  try {
    exec(`git rev-parse --verify ${branch}`, { silent: true });
  } catch {
    log.fatal(`Local branch "${branch}" does not exist`);
  }
}

/**
 * Check if a branch exists on remote (returns boolean, doesn't exit)
 */
export function remoteBranchExists(branch: string): boolean {
  try {
    exec(`git ls-remote --exit-code --heads origin ${branch}`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a branch exists locally
 */
export function localBranchExists(branch: string): boolean {
  try {
    exec(`git rev-parse --verify ${branch}`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Assert that a tag exists
 */
export function assertTagExists(tag: string): void {
  try {
    exec(`git rev-parse --verify refs/tags/${tag}`, { silent: true });
  } catch {
    log.fatal(`Tag "${tag}" does not exist. Did you fetch tags? (git fetch --tags)`);
  }
}

/**
 * Check if a tag exists (returns boolean)
 */
export function tagExists(tag: string): boolean {
  try {
    exec(`git rev-parse --verify refs/tags/${tag}`, { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Warn if the working tree has uncommitted changes
 */
export function warnIfDirtyWorkingTree(): void {
  try {
    const status = exec("git status --porcelain", { silent: true });
    if (status) {
      log.warn("You have uncommitted changes. Consider committing or stashing them first.");
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Assert that the working tree is clean
 */
export function assertCleanWorkingTree(): void {
  try {
    const status = exec("git status --porcelain", { silent: true });
    if (status) {
      log.fatal("Working tree has uncommitted changes. Please commit or stash them first.");
    }
  } catch {
    // Ignore errors, proceed anyway
  }
}

/**
 * Assert that gh CLI is installed
 */
export function assertGhInstalled(): void {
  if (!commandExists("gh")) {
    log.fatal(
      "GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
    );
  }
}

/**
 * Assert that gh CLI is authenticated
 */
export function assertGhAuthenticated(): void {
  assertGhInstalled();
  try {
    exec("gh auth status", { silent: true });
  } catch {
    log.fatal(
      "GitHub CLI is not authenticated. Run 'gh auth login' to authenticate."
    );
  }
}
