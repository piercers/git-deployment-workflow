// Hotfix branch commands

import { Command } from "commander";
import * as git from "../utils/git.js";
import * as github from "../utils/github.js";
import * as log from "../utils/log.js";
import {
  validateDate,
  warnIfDirtyWorkingTree,
  assertRemoteBranchExists,
  assertSafeArg,
  remoteBranchExists,
  localBranchExists,
} from "../utils/validate.js";

/**
 * Register hotfix lifecycle commands for urgent production fixes.
 *
 * Workflow:
 *   1. `hotfix create <date>`  — branch from latest production tag (v{date}[.N])
 *   2. `hotfix fix`            — create fix branch + PR targeting hotfix
 *   3. `hotfix rc <date>`      — tag hotfix RC for staging validation
 *   4. `hotfix promote <date>` — tag production patch (v{date}.N)
 *   5. `hotfix forward-merge`  — merge hotfix back into development
 *   6. `hotfix cleanup`        — delete hotfix branch
 */
export function registerHotfixCommands(program: Command): void {
  const hotfix = program
    .command("hotfix")
    .description("Hotfix branch commands for urgent production fixes");

  // ─────────────────────────────────────────────────────────────────
  // hotfix create <date>
  // ─────────────────────────────────────────────────────────────────
  hotfix
    .command("create")
    .description("Create a hotfix branch from a production tag")
    .argument("<date>", "Production tag date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);
      warnIfDirtyWorkingTree();

      const branchName = `hotfix/${date}`;
      const tagName = `v${date}`;

      // Check if hotfix branch already exists
      if (remoteBranchExists(branchName)) {
        log.fatal(`Hotfix branch ${branchName} already exists`);
      }

      // Fetch tags to ensure we have the latest
      git.fetchTags();

      // Find the latest production tag for this date
      // Could be v2026-02-15 or v2026-02-15.1, v2026-02-15.2, etc.
      const baseTags = git.listTags(`v${date}`);
      const patchTags = git.listTags(`v${date}.*`);

      if (baseTags.length === 0 && patchTags.length === 0) {
        log.fatal(
          `No production tag found for ${date}. Expected v${date} or v${date}.N`
        );
      }

      // Use the latest tag: highest patch number, or the base tag if no patches
      const latestTag =
        patchTags.length > 0
          ? patchTags.reduce((a, b) => {
              const patchA = parseInt(a.split(".").pop()!, 10) || 0;
              const patchB = parseInt(b.split(".").pop()!, 10) || 0;
              return patchB > patchA ? b : a;
            })
          : baseTags[0];

      log.info(`Creating hotfix branch from ${latestTag}`);
      log.info("");

      // Create hotfix branch from the tag
      git.checkoutNewBranch(branchName, latestTag);
      git.pushNewBranch(branchName);

      log.info("");
      log.success(`Hotfix branch created: ${branchName}`);
      log.success(`Based on production tag: ${latestTag}`);
      log.info("");
      log.info("Next steps:");
      log.info(`  1. Create a fix: 'workflow hotfix fix ${date} <ticket> <desc>'`);
      log.info(`  2. After fix is merged: 'workflow hotfix rc ${date}'`);
    });

  // ─────────────────────────────────────────────────────────────────
  // hotfix fix <date> <ticket-id> <description>
  // ─────────────────────────────────────────────────────────────────
  hotfix
    .command("fix")
    .description("Create a fix branch for the hotfix")
    .argument("<date>", "Hotfix date in YYYY-MM-DD format")
    .argument("<ticket-id>", "Ticket ID (e.g., PROJ-401)")
    .argument("<description>", "Short description (use-hyphens-for-spaces)")
    .action((date: string, ticketId: string, description: string) => {
      validateDate(date);
      assertSafeArg(ticketId, "ticket ID");
      assertSafeArg(description, "description");
      warnIfDirtyWorkingTree();

      const hotfixBranch = `hotfix/${date}`;
      assertRemoteBranchExists(hotfixBranch);

      const fixBranch = `fix/${ticketId}-${description}`;

      log.info(`Creating hotfix fix branch: ${fixBranch}`);
      log.info("");

      // Checkout hotfix branch and pull latest
      git.checkout(hotfixBranch);
      git.pull("origin", hotfixBranch);

      // Create fix branch
      git.checkoutNewBranch(fixBranch);
      git.pushNewBranch(fixBranch);

      // Create PR targeting hotfix branch
      const url = github.createPR({
        base: hotfixBranch,
        title: `[HOTFIX] ${ticketId}: ${description.replace(/-/g, " ")}`,
      });

      log.info("");
      log.success(`Fix branch created: ${fixBranch}`);
      log.info(`Pull request: ${url}`);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Make your fix and push commits");
      log.info("  2. Get PR reviewed and merged");
      log.info(`  3. Run 'workflow hotfix rc ${date}' to tag for staging validation`);
    });

  // ─────────────────────────────────────────────────────────────────
  // hotfix rc <date>
  // ─────────────────────────────────────────────────────────────────
  hotfix
    .command("rc")
    .description("Tag a hotfix release candidate for staging validation")
    .argument("<date>", "Hotfix date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `hotfix/${date}`;
      assertRemoteBranchExists(branchName);

      // Determine next hotfix RC number
      const nextRc = git.getNextHotfixRcNumber(date);
      const tagName = `rc-${date}-hotfix-${nextRc}`;

      log.info(`Creating hotfix release candidate: ${tagName}`);
      log.info("");

      // Checkout and pull latest
      git.checkout(branchName);
      git.pull("origin", branchName);

      // Tag and push
      git.tagAndPush(tagName);

      // Create GitHub pre-release
      const releaseUrl = github.createRelease({
        tag: tagName,
        title: `Hotfix RC ${date}-${nextRc}`,
        prerelease: true,
        generateNotes: true,
        target: branchName,
      });

      log.info("");
      log.success(`Hotfix release candidate tagged: ${tagName}`);
      log.info(`GitHub Release: ${releaseUrl}`);
      log.info("");
      log.info("Deploy to staging and validate the fix.");
      log.info("");
      log.info("When validated:");
      log.info(`  Run 'workflow hotfix promote ${date}' to deploy to production`);
    });

  // ─────────────────────────────────────────────────────────────────
  // hotfix promote <date>
  // ─────────────────────────────────────────────────────────────────
  hotfix
    .command("promote")
    .description("Tag the hotfix for production deployment")
    .argument("<date>", "Hotfix date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `hotfix/${date}`;
      assertRemoteBranchExists(branchName);

      // Determine next patch number
      const nextPatch = git.getNextPatchNumber(date);
      const tagName = `v${date}.${nextPatch}`;

      log.info(`Promoting hotfix to production: ${tagName}`);
      log.info("");

      // Checkout and pull latest
      git.checkout(branchName);
      git.pull("origin", branchName);

      // Tag and push
      git.tagAndPush(tagName);

      // Create GitHub release (not pre-release)
      const releaseUrl = github.createRelease({
        tag: tagName,
        title: `v${date}.${nextPatch}`,
        prerelease: false,
        generateNotes: true,
        target: branchName,
        latest: true,
      });

      log.info("");
      log.success(`Production hotfix tag created: ${tagName}`);
      log.info(`GitHub Release: ${releaseUrl}`);
      log.info("");
      log.info("Production deployment triggered.");
      log.info("");
      log.info("After production is stable:");
      log.info(`  1. Forward-merge: 'workflow hotfix forward-merge ${date}'`);
      log.info(`  2. Clean up: 'workflow hotfix cleanup ${date}'`);
    });

  // ─────────────────────────────────────────────────────────────────
  // hotfix forward-merge <date>
  // ─────────────────────────────────────────────────────────────────
  hotfix
    .command("forward-merge")
    .description("Open a PR to merge the hotfix back into development")
    .argument("<date>", "Hotfix date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `hotfix/${date}`;
      assertRemoteBranchExists(branchName);

      log.info(`Creating PR to forward-merge ${branchName} into development`);
      log.info("");

      // Checkout hotfix branch
      git.checkout(branchName);
      git.pull("origin", branchName);

      // Create PR from hotfix into development
      const url = github.createPR({
        base: "development",
        title: `Forward-merge ${branchName} into development`,
        body:
          "This PR merges the production hotfix back into development " +
          "to ensure the fix is not regressed in future releases.",
      });

      log.info("");
      log.success("Pull request created!");
      log.info(url);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Review and squash merge the PR into development");
      log.info(`  2. Clean up: 'workflow hotfix cleanup ${date}'`);
    });

  // ─────────────────────────────────────────────────────────────────
  // hotfix cleanup <date>
  // ─────────────────────────────────────────────────────────────────
  hotfix
    .command("cleanup")
    .description("Delete the hotfix branch after successful deployment")
    .argument("<date>", "Hotfix date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `hotfix/${date}`;

      log.info(`Cleaning up hotfix branch: ${branchName}`);
      log.info("");

      // Delete remote branch if it exists
      if (remoteBranchExists(branchName)) {
        git.deleteRemoteBranch(branchName);
        log.success(`Deleted remote branch: origin/${branchName}`);
      } else {
        log.info(`Remote branch origin/${branchName} does not exist (already deleted?)`);
      }

      // Delete local branch if it exists
      if (localBranchExists(branchName)) {
        // Make sure we're not on the branch we're trying to delete
        if (git.currentBranch() === branchName) {
          git.checkout("development");
        }
        git.deleteLocalBranch(branchName);
        log.success(`Deleted local branch: ${branchName}`);
      } else {
        log.info(`Local branch ${branchName} does not exist`);
      }

      log.info("");
      log.success("Hotfix cleanup complete!");
      log.info("");
      log.info("The hotfix tags remain as permanent record:");
      log.info(`  - rc-${date}-hotfix-* tags mark staging validation`);
      log.info(`  - v${date}.* tags mark production deployments`);
    });
}
