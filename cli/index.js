#!/usr/bin/env node
/**
 * fsd-migrate CLI
 *
 * Lightweight command-line tool that triggers the n8n orchestration webhook
 * and streams progress back to the developer's terminal.
 *
 * Usage:
 *   fsd-migrate --project /path/to/legacy-react-app
 *   fsd-migrate --project ./my-app --n8n-url http://localhost:5678 --dry-run
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { migrate } from './commands/migrate.js';
import { validate } from './commands/validate.js';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);

program
  .name('fsd-migrate')
  .description('Agentic AI framework to refactor legacy React projects into FSD + TypeScript')
  .version(pkg.version);

program
  .command('migrate')
  .alias('m')
  .description('Run the full FSD migration pipeline on a React project')
  .requiredOption('-p, --project <path>', 'Path to the legacy React project root')
  .option('-u, --n8n-url <url>', 'n8n instance URL', 'http://localhost:5678')
  .option('--dry-run', 'Preview the migration plan without making changes', false)
  .option('--skip-ts', 'Skip TypeScript conversion (Phase 1)', false)
  .option('--skip-fsd', 'Skip FSD restructuring (Phase 2)', false)
  .option('--skip-imports', 'Skip import path fixing (Phase 3)', false)
  .option('--verbose', 'Enable verbose output', false)
  .action(async (options) => {
    await migrate({
      projectPath: resolve(options.project),
      n8nUrl: options.n8nUrl,
      dryRun: options.dryRun,
      skipTs: options.skipTs,
      skipFsd: options.skipFsd,
      skipImports: options.skipImports,
      verbose: options.verbose,
    });
  });

program
  .command('validate')
  .alias('v')
  .description('Validate FSD import boundaries on an already-migrated project')
  .requiredOption('-p, --project <path>', 'Path to the React project root')
  .option('--fix', 'Attempt to auto-fix violations', false)
  .action(async (options) => {
    await validate({
      projectPath: resolve(options.project),
      fix: options.fix,
    });
  });

program.parse();
