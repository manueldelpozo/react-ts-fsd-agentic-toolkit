/**
 * cli/commands/validate.js
 *
 * Validate command handler.
 * Runs the imports-linter skill directly (no n8n required) and reports violations.
 */

import chalk from 'chalk';
import { glob } from 'glob';
import { lintImportBoundaries } from '../../skills/imports-linter/index.js';

/**
 * @param {object} opts
 * @param {string} opts.projectPath
 * @param {boolean} opts.fix
 */
export async function validate({ projectPath, fix }) {
  console.log(chalk.bold.cyan('\n🔍 FSD Import Boundary Validator'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`  Project: ${chalk.yellow(projectPath)}`));
  console.log(chalk.gray('─'.repeat(50)));

  // Find all TS/TSX files relative to src/
  const srcPath = `${projectPath}/src`;
  const files = await glob('**/*.{ts,tsx}', {
    cwd: srcPath,
    ignore: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
  });

  if (files.length === 0) {
    console.log(chalk.yellow('\n  ⚠️  No TypeScript files found under src/'));
    console.log(chalk.gray('  Has the TS migration already been run?\n'));
    return;
  }

  console.log(chalk.white(`\n  Scanning ${chalk.yellow(files.length)} files...\n`));

  const violations = lintImportBoundaries(srcPath, files);

  if (violations.length === 0) {
    console.log(chalk.green('  ✅ No FSD boundary violations found!'));
    console.log(chalk.gray('  Your import structure is fully FSD-compliant.\n'));
    return;
  }

  // Group violations by type
  const byType = violations.reduce((acc, v) => {
    (acc[v.type] = acc[v.type] || []).push(v);
    return acc;
  }, {});

  console.log(chalk.red(`  ❌ Found ${violations.length} violation(s):\n`));

  for (const [type, items] of Object.entries(byType)) {
    const label = {
      'upward-import': '⬆️  Upward Imports',
      'cross-slice': '↔️  Cross-Slice Imports',
      'internal-path': '🔒 Internal Path Access',
    }[type] ?? type;

    console.log(chalk.bold.yellow(`  ${label} (${items.length})`));
    items.forEach((v) => {
      console.log(chalk.white(`    • ${chalk.gray(v.file)}`));
      console.log(chalk.white(`      imports: ${chalk.red(v.importPath)}`));
      console.log(chalk.white(`      ${chalk.gray(v.message)}`));
    });
    console.log();
  }

  if (fix) {
    console.log(chalk.blue('  🔧 Auto-fix mode not yet implemented for the validate command.'));
    console.log(chalk.gray('  Run `fsd-migrate migrate --project <path>` to trigger the full pipeline.\n'));
  } else {
    console.log(chalk.gray('  Run with --fix to attempt automatic remediation.\n'));
  }

  process.exit(1);
}
