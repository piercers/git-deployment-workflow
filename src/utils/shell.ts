// Shell execution helpers

import { execSync, type ExecSyncOptions } from "node:child_process";
import * as log from "./log.js";

export interface ExecOptions {
  cwd?: string;
  silent?: boolean;
}

/**
 * Execute a command and return stdout as a string.
 * Throws on non-zero exit code.
 */
export function exec(cmd: string, options: ExecOptions = {}): string {
  const execOptions: ExecSyncOptions = {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options.cwd,
  };

  if (!options.silent) {
    log.dim(`$ ${cmd}`);
  }

  try {
    const result = execSync(cmd, execOptions);
    return (result as string).trim();
  } catch (err) {
    const error = err as Error & { stderr?: Buffer | string; status?: number };
    const stderr = error.stderr?.toString().trim() || error.message;
    throw new Error(`Command failed: ${cmd}\n${stderr}`);
  }
}

/**
 * Execute a command with inherited stdio (shows output in real-time).
 * Returns nothing, throws on non-zero exit code.
 */
export function execLive(cmd: string, options: ExecOptions = {}): void {
  const execOptions: ExecSyncOptions = {
    stdio: "inherit",
    cwd: options.cwd,
  };

  if (!options.silent) {
    log.dim(`$ ${cmd}`);
  }

  try {
    execSync(cmd, execOptions);
  } catch (err) {
    const error = err as Error & { status?: number };
    throw new Error(`Command failed with exit code ${error.status}: ${cmd}`);
  }
}

/**
 * Check if a command exists in PATH
 */
export function commandExists(cmd: string): boolean {
  try {
    exec(`which ${cmd}`, { silent: true });
    return true;
  } catch {
    return false;
  }
}
