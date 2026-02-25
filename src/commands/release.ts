// Release branch commands

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
  tagExists,
} from "../utils/validate.js";

/**
 * Register release lifecycle commands.
 *
 * Workflow:
 *   1. `release cut <date>`    — branch off development, tag first RC
 *   2. `release fix` / `release cherry-pick` / `release update` — add changes
 *   3. `release rc <date>`     — tag subsequent RCs for staging
 *   4. `release promote <date>` — tag production release (v{date})
 *   5. `release forward-merge`  — merge fixes back into development
 *   6. `release cleanup`        — delete release branch
 */
export function registerReleaseCommands(program: Command): void {
  const release = program
    .command("release")
    .description("Release branch commands");

  // ─────────────────────────────────────────────────────────────────
  // release cut <date>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("cut")
    .description("Create a release branch from development and tag the first RC")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);
      warnIfDirtyWorkingTree();

      const branchName = `release/${date}`;
      const tagName = `rc-${date}`;

      // Check if release branch already exists
      if (remoteBranchExists(branchName)) {
        log.fatal(`Release branch ${branchName} already exists`);
      }

      // Check if RC tag already exists
      if (tagExists(tagName)) {
        log.fatal(`Tag ${tagName} already exists`);
      }

      log.info(`Cutting release: ${branchName}`);
      log.info("");

      // Checkout development and pull latest
      git.checkout("development");
      git.pull("origin", "development");

      // Create release branch
      git.checkoutNewBranch(branchName);
      git.pushNewBranch(branchName);

      // Tag and push RC
      git.tagAndPush(tagName);

      // Create GitHub pre-release
      const releaseUrl = github.createRelease({
        tag: tagName,
        title: `RC ${date}`,
        prerelease: true,
        generateNotes: true,
        target: branchName,
      });

      log.info("");
      log.success(`Release branch created: ${branchName}`);
      log.success(`Release candidate tagged: ${tagName}`);
      log.info(`GitHub Release: ${releaseUrl}`);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Deploy to staging and validate");
      log.info(`  2. If fixes needed: 'workflow release fix ${date} <ticket> <desc>'`);
      log.info(`  3. When ready: 'workflow release promote ${date}'`);
    });

  // ─────────────────────────────────────────────────────────────────
  // release rc <date>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("rc")
    .description("Tag a new release candidate on the release branch")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `release/${date}`;
      assertRemoteBranchExists(branchName);

      // Determine next RC number
      const nextRc = git.getNextRcNumber(date);
      if (nextRc === null) {
        log.fatal(`No existing RC tags found for ${date}. Use 'workflow release cut ${date}' first.`);
      }

      const tagName = `rc-${date}-${nextRc}`;

      log.info(`Creating release candidate: ${tagName}`);
      log.info("");

      // Checkout and pull latest
      git.checkout(branchName);
      git.pull("origin", branchName);

      // Tag and push
      git.tagAndPush(tagName);

      // Create GitHub pre-release
      const releaseUrl = github.createRelease({
        tag: tagName,
        title: `RC ${date}-${nextRc}`,
        prerelease: true,
        generateNotes: true,
        target: branchName,
      });

      log.info("");
      log.success(`Release candidate tagged: ${tagName}`);
      log.info(`GitHub Release: ${releaseUrl}`);
      log.info("");
      log.info("Staging will be redeployed with this release candidate.");
    });

  // ─────────────────────────────────────────────────────────────────
  // release update <date>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("update")
    .description("Open a PR to merge development into the release branch")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `release/${date}`;
      assertRemoteBranchExists(branchName);

      log.info(`Creating PR to merge development into ${branchName}`);
      log.info("");

      // Checkout development to create PR from there
      git.checkout("development");
      git.pull("origin", "development");

      // Create PR from development into release branch
      const url = github.createPR({
        base: branchName,
        title: `Update ${branchName} with latest development`,
        body: "This PR merges the latest work from development into the release branch.",
      });

      log.info("");
      log.success("Pull request created!");
      log.info(url);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Review and merge the PR (use standard merge commit)");
      log.info(`  2. Run 'workflow release rc ${date}' to tag a new release candidate`);
    });

  // ─────────────────────────────────────────────────────────────────
  // release cherry-pick <date> <branch-name> <sha...>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("cherry-pick")
    .description("Cherry-pick specific commits from development into the release")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .argument("<branch-name>", "Name for the cherry-pick branch (e.g., include-search)")
    .argument("<shas...>", "SHA(s) to cherry-pick")
    .action((date: string, branchName: string, shas: string[]) => {
      validateDate(date);
      assertSafeArg(branchName, "branch name");
      shas.forEach((sha) => assertSafeArg(sha, "SHA"));
      warnIfDirtyWorkingTree();

      const releaseBranch = `release/${date}`;
      assertRemoteBranchExists(releaseBranch);

      const cherryPickBranch = `cherry-pick/${branchName}`;

      log.info(`Cherry-picking ${shas.length} commit(s) into ${releaseBranch}`);
      log.info("");

      // Checkout release branch and pull latest
      git.checkout(releaseBranch);
      git.pull("origin", releaseBranch);

      // Create cherry-pick branch
      git.checkoutNewBranch(cherryPickBranch);

      // Cherry-pick each commit
      for (const sha of shas) {
        git.cherryPick(sha);
      }

      // Push the branch
      git.pushNewBranch(cherryPickBranch);

      // Create PR into release branch
      const url = github.createPR({
        base: releaseBranch,
        title: `Cherry-pick: ${branchName}`,
        body: `Cherry-picked commits:\n${shas.map((s) => `- ${s}`).join("\n")}`,
      });

      log.info("");
      log.success(`Cherry-pick branch created: ${cherryPickBranch}`);
      log.info(`Pull request: ${url}`);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Review and merge the PR");
      log.info(`  2. Run 'workflow release rc ${date}' to tag a new release candidate`);
    });

  // ─────────────────────────────────────────────────────────────────
  // release fix <date> <ticket-id> <description>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("fix")
    .description("Create a fix branch for staging issues")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .argument("<ticket-id>", "Ticket ID (e.g., PROJ-310)")
    .argument("<description>", "Short description (use-hyphens-for-spaces)")
    .action((date: string, ticketId: string, description: string) => {
      validateDate(date);
      assertSafeArg(ticketId, "ticket ID");
      assertSafeArg(description, "description");
      warnIfDirtyWorkingTree();

      const releaseBranch = `release/${date}`;
      assertRemoteBranchExists(releaseBranch);

      const fixBranch = `fix/${ticketId}-${description}`;

      log.info(`Creating staging fix branch: ${fixBranch}`);
      log.info("");

      // Checkout release branch and pull latest
      git.checkout(releaseBranch);
      git.pull("origin", releaseBranch);

      // Create fix branch
      git.checkoutNewBranch(fixBranch);
      git.pushNewBranch(fixBranch);

      // Create PR targeting release branch
      const url = github.createPR({
        base: releaseBranch,
        title: `${ticketId}: ${description.replace(/-/g, " ")}`,
      });

      log.info("");
      log.success(`Fix branch created: ${fixBranch}`);
      log.info(`Pull request: ${url}`);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Make your fix and push commits");
      log.info("  2. Get PR reviewed and merged");
      log.info(`  3. Run 'workflow release rc ${date}' to tag a new release candidate`);
      log.info(`  4. Run 'workflow release forward-merge ${date}' to merge fixes into development`);
    });

  // ─────────────────────────────────────────────────────────────────
  // release promote <date>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("promote")
    .description("Tag the release for production and create GitHub Release")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `release/${date}`;
      assertRemoteBranchExists(branchName);

      const tagName = `v${date}`;

      // Check if production tag already exists
      if (tagExists(tagName)) {
        log.fatal(`Production tag ${tagName} already exists. Did you mean to create a hotfix?`);
      }

      log.info(`Promoting ${branchName} to production`);
      log.info("");

      // Checkout and pull latest
      git.checkout(branchName);
      git.pull("origin", branchName);

      // Tag and push
      git.tagAndPush(tagName);

      // Create GitHub release (not pre-release)
      const releaseUrl = github.createRelease({
        tag: tagName,
        title: `v${date}`,
        prerelease: false,
        generateNotes: true,
        target: branchName,
        latest: true,
      });

      log.info("");
      log.success(`Production tag created: ${tagName}`);
      log.info(`GitHub Release: ${releaseUrl}`);
      log.info("");
      log.info("Production deployment triggered.");
      log.info("");
      log.info("After production is stable:");
      log.info(`  1. If fixes were made: 'workflow release forward-merge ${date}'`);
      log.info(`  2. Clean up: 'workflow release cleanup ${date}'`);
    });

  // ─────────────────────────────────────────────────────────────────
  // release forward-merge <date>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("forward-merge")
    .description("Open a PR to merge release branch fixes back into development")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `release/${date}`;
      assertRemoteBranchExists(branchName);

      log.info(`Creating PR to forward-merge ${branchName} into development`);
      log.info("");

      // Checkout release branch
      git.checkout(branchName);
      git.pull("origin", branchName);

      // Create PR from release into development
      const url = github.createPR({
        base: "development",
        title: `Forward-merge ${branchName} staging fixes into development`,
        body:
          "This PR merges staging fixes from the release branch back into development " +
          "to ensure they are not lost in future releases.",
      });

      log.info("");
      log.success("Pull request created!");
      log.info(url);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Review and squash merge the PR into development");
      log.info(`  2. Clean up: 'workflow release cleanup ${date}'`);
    });

  // ─────────────────────────────────────────────────────────────────
  // release cleanup <date>
  // ─────────────────────────────────────────────────────────────────
  release
    .command("cleanup")
    .description("Delete the release branch after successful deployment")
    .argument("<date>", "Release date in YYYY-MM-DD format")
    .action((date: string) => {
      validateDate(date);

      const branchName = `release/${date}`;

      log.info(`Cleaning up release branch: ${branchName}`);
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
      log.success("Release cleanup complete!");
      log.info("");
      log.info("The release tags remain as permanent record:");
      log.info(`  - rc-${date}* tags mark what was deployed to staging`);
      log.info(`  - v${date} tag marks what was deployed to production`);
    });
}
