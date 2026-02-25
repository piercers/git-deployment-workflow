// GitHub CLI (gh) command helpers

import { exec } from "./shell.js";
import * as log from "./log.js";
import { assertGhAuthenticated } from "./validate.js";

export interface CreatePROptions {
  base: string;
  title?: string;
  body?: string;
  draft?: boolean;
}

/**
 * Create a pull request from the current branch
 */
export function createPR(options: CreatePROptions): string {
  assertGhAuthenticated();

  const args = [`--base ${options.base}`];

  if (options.title) {
    args.push(`--title "${options.title}"`);
  }

  if (options.body) {
    // Use --body-file with process substitution to handle complex bodies
    args.push(`--body "${options.body.replace(/"/g, '\\"')}"`);
  }

  if (options.draft) {
    args.push("--draft");
  }

  log.step(`Creating pull request targeting ${options.base}`);
  const url = exec(`gh pr create ${args.join(" ")}`);
  return url;
}

/**
 * Create a pull request and return the URL, filling title/body interactively if not provided
 */
export function createPRInteractive(base: string): string {
  assertGhAuthenticated();
  log.step(`Opening PR creation (targeting ${base})`);
  const url = exec(`gh pr create --base ${base} --fill`);
  return url;
}

export interface CreateReleaseOptions {
  tag: string;
  title: string;
  prerelease?: boolean;
  generateNotes?: boolean;
  target?: string;
  latest?: boolean;
}

/**
 * Create a GitHub release
 */
export function createRelease(options: CreateReleaseOptions): string {
  assertGhAuthenticated();

  const args = [options.tag, `--title "${options.title}"`];

  if (options.prerelease) {
    args.push("--prerelease");
  }

  if (options.generateNotes) {
    args.push("--generate-notes");
  }

  if (options.target) {
    args.push(`--target ${options.target}`);
  }

  if (options.latest) {
    args.push("--latest");
  }

  const releaseType = options.prerelease ? "pre-release" : "release";
  log.step(`Creating GitHub ${releaseType} for tag ${options.tag}`);
  const url = exec(`gh release create ${args.join(" ")}`);
  return url;
}

/**
 * Check if a PR already exists for the current branch
 */
export function prExists(): boolean {
  try {
    exec("gh pr view --json number", { silent: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the URL of an existing PR for the current branch
 */
export function getPRUrl(): string | null {
  try {
    const result = exec("gh pr view --json url --jq .url", { silent: true });
    return result || null;
  } catch {
    return null;
  }
}
