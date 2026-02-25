// Feature branch commands

import { Command } from "commander";
import * as git from "../utils/git.js";
import * as github from "../utils/github.js";
import * as log from "../utils/log.js";
import {
  validateCategory,
  warnIfDirtyWorkingTree,
  assertSafeArg,
} from "../utils/validate.js";

/**
 * Register `feature start` and `feature pr` commands.
 *
 * Workflow:
 *   1. `feature start <category> <ticket> <desc>` — branch off development
 *   2. engineer commits work
 *   3. `feature pr` — open PR targeting development (squash merge)
 */
export function registerFeatureCommands(program: Command): void {
  const feature = program
    .command("feature")
    .description("Feature branch commands");

  feature
    .command("start")
    .description("Create a new feature branch from development")
    .argument("<category>", "Branch category: feature, fix, chore, or refactor")
    .argument("<ticket-id>", "Ticket ID (e.g., PROJ-142)")
    .argument("<description>", "Short description (use-hyphens-for-spaces)")
    .action((category: string, ticketId: string, description: string) => {
      validateCategory(category);
      assertSafeArg(ticketId, "ticket ID");
      assertSafeArg(description, "description");
      warnIfDirtyWorkingTree();

      const branchName = `${category}/${ticketId}-${description}`;

      log.info(`Creating feature branch: ${branchName}`);
      log.info("");

      // Checkout development and pull latest
      git.checkout("development");
      git.pull("origin", "development");

      // Create and push the new branch
      git.checkoutNewBranch(branchName);
      git.pushNewBranch(branchName);

      log.info("");
      log.success(`Created and pushed branch: ${branchName}`);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Do your work and commit as needed");
      log.info(`  2. Run 'workflow feature pr' to open a pull request`);
    });

  feature
    .command("pr")
    .description("Open a pull request for the current feature branch")
    .option("--draft", "Create as a draft PR")
    .action((options: { draft?: boolean }) => {
      const branch = git.currentBranch();

      // Validate we're on a feature branch
      const validPrefixes = ["feature/", "fix/", "chore/", "refactor/"];
      const isFeatureBranch = validPrefixes.some((prefix) =>
        branch.startsWith(prefix)
      );

      if (!isFeatureBranch) {
        log.fatal(
          `Current branch "${branch}" doesn't look like a feature branch.\n` +
            `Expected format: <category>/<ticket-id>-<description>\n` +
            `Categories: ${validPrefixes.map((p) => p.slice(0, -1)).join(", ")}`
        );
      }

      // Check if PR already exists
      const existingPR = github.getPRUrl();
      if (existingPR) {
        log.info(`A pull request already exists for this branch:`);
        log.info(existingPR);
        return;
      }

      log.info(`Creating pull request for branch: ${branch}`);
      log.info("Targeting: development");
      log.info("");

      // Push any unpushed commits first
      git.push();

      // Create PR targeting development
      const prOptions: github.CreatePROptions = {
        base: "development",
        draft: options.draft,
      };

      // Extract a sensible title from branch name
      // e.g., feature/PROJ-142-avatar-upload -> PROJ-142: avatar upload
      const match = branch.match(/^[^/]+\/([A-Za-z]+-\d+)-(.+)$/);
      if (match) {
        const [, ticketId, desc] = match;
        const title = `${ticketId}: ${desc.replace(/-/g, " ")}`;
        prOptions.title = title;
      }

      const url = github.createPR(prOptions);

      log.info("");
      log.success("Pull request created!");
      log.info(url);
      log.info("");
      log.info("Next steps:");
      log.info("  1. Get the PR reviewed and approved");
      log.info("  2. Squash merge via GitHub (branch will auto-delete)");
    });
}
