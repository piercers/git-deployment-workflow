// Colored console output helpers

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

export function info(message: string): void {
  console.log(`${colors.blue}info${colors.reset} ${message}`);
}

export function success(message: string): void {
  console.log(`${colors.green}done${colors.reset} ${message}`);
}

export function warn(message: string): void {
  console.log(`${colors.yellow}warn${colors.reset} ${message}`);
}

export function error(message: string): void {
  console.error(`${colors.red}error${colors.reset} ${message}`);
}

export function step(message: string): void {
  console.log(`${colors.cyan}=>${colors.reset} ${message}`);
}

export function dim(message: string): void {
  console.log(`${colors.dim}${message}${colors.reset}`);
}

export function fatal(message: string): never {
  error(message);
  process.exit(1);
}
