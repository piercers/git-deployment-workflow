#!/usr/bin/env node

// Git Deployment Workflow CLI
// Automates the git branching and release workflow

import { Command } from "commander";
import { registerFeatureCommands } from "./commands/feature.js";
import { registerReleaseCommands } from "./commands/release.js";
import { registerHotfixCommands } from "./commands/hotfix.js";

const program = new Command();

program
  .name("workflow")
  .description("CLI tool to automate the git deployment workflow")
  .version("1.0.0");

// Register all command groups
registerFeatureCommands(program);
registerReleaseCommands(program);
registerHotfixCommands(program);

// Add helpful examples to the main help
program.addHelpText(
  "after",
  `
Examples:
  $ workflow feature start feature PROJ-142 avatar-upload
  $ workflow feature pr

  $ workflow release cut 2026-02-15
  $ workflow release fix 2026-02-15 PROJ-310 cart-rounding-error
  $ workflow release rc 2026-02-15
  $ workflow release promote 2026-02-15
  $ workflow release forward-merge 2026-02-15
  $ workflow release cleanup 2026-02-15

  $ workflow hotfix create 2026-02-15
  $ workflow hotfix fix 2026-02-15 PROJ-401 payment-timeout
  $ workflow hotfix rc 2026-02-15
  $ workflow hotfix promote 2026-02-15
  $ workflow hotfix forward-merge 2026-02-15
  $ workflow hotfix cleanup 2026-02-15

Documentation:
  See git-workflow.md for the complete workflow documentation.
`
);

program.parse();
