/**
 * cli/commands/migrate.js
 *
 * Core migrate command handler.
 * Calls the n8n orchestrator webhook and streams progress to the terminal.
 */

import chalk from 'chalk';

const WEBHOOK_PATH = '/webhook/fsd-migrate';

/**
 * @param {object} opts
 * @param {string} opts.projectPath
 * @param {string} opts.n8nUrl
 * @param {boolean} opts.dryRun
 * @param {boolean} opts.skipTs
 * @param {boolean} opts.skipFsd
 * @param {boolean} opts.skipImports
 * @param {boolean} opts.verbose
 */
export async function migrate(opts) {
  const { projectPath, n8nUrl, dryRun, skipTs, skipFsd, skipImports, verbose } = opts;

  console.log(chalk.bold.cyan('\n🚀 FSD Migration Toolkit'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.white(`  Project:  ${chalk.yellow(projectPath)}`));
  console.log(chalk.white(`  n8n URL:  ${chalk.yellow(n8nUrl)}`));
  console.log(chalk.white(`  Dry Run:  ${chalk.yellow(dryRun)}`));
  console.log(chalk.gray('─'.repeat(50)));

  if (dryRun) {
    console.log(chalk.blue('\n📋 DRY RUN mode — no files will be modified\n'));
  }

  const payload = {
    projectRoot: projectPath,
    options: {
      dryRun,
      phases: {
        typescript: !skipTs,
        fsdStructure: !skipFsd,
        importPaths: !skipImports,
      },
    },
  };

  console.log(chalk.white('\n⏳ Triggering n8n orchestrator...'));

  let response;
  try {
    const res = await fetch(`${n8nUrl}${WEBHOOK_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`n8n returned ${res.status}: ${text}`);
    }

    response = await res.json();
  } catch (err) {
    console.error(chalk.red(`\n❌ Failed to reach n8n: ${err.message}`));
    console.error(chalk.gray('   Make sure n8n is running and the workflow is active.'));
    process.exit(1);
  }

  if (verbose) {
    console.log(chalk.gray('\nRaw response:'));
    console.log(JSON.stringify(response, null, 2));
  }

  printMigrationReport(response);
}

/**
 * @param {object} report
 */
function printMigrationReport(report) {
  console.log(chalk.bold.green('\n✅ Migration Complete'));
  console.log(chalk.gray('─'.repeat(50)));

  if (report.phase1) {
    const { conversions = [], manualReviewRequired = [] } = report.phase1;
    console.log(chalk.cyan(`\n  Phase 1 — TypeScript`));
    console.log(chalk.white(`    Files converted:        ${chalk.yellow(conversions.length)}`));
    console.log(chalk.white(`    Manual review needed:   ${chalk.yellow(manualReviewRequired.length)}`));
  }

  if (report.phase2) {
    const { filesMoved = [], publicAPIsCreated = [] } = report.phase2;
    console.log(chalk.cyan(`\n  Phase 2 — FSD Structure`));
    console.log(chalk.white(`    Files moved:            ${chalk.yellow(filesMoved.length)}`));
    console.log(chalk.white(`    Public APIs created:    ${chalk.yellow(publicAPIsCreated.length)}`));
  }

  if (report.phase3) {
    const { importsRewritten = 0, violationsFixed = [], circularDependenciesFound = [] } = report.phase3;
    console.log(chalk.cyan(`\n  Phase 3 — Import Paths`));
    console.log(chalk.white(`    Imports rewritten:      ${chalk.yellow(importsRewritten)}`));
    console.log(chalk.white(`    Violations fixed:       ${chalk.yellow(violationsFixed.length)}`));

    if (circularDependenciesFound.length > 0) {
      console.log(chalk.red(`\n  ⚠️  Circular dependencies found (manual fix required):`));
      circularDependenciesFound.forEach((dep) => {
        console.log(chalk.red(`     • ${dep}`));
      });
    }
  }

  if (report.validation?.violations?.length > 0) {
    console.log(chalk.yellow(`\n  ⚠️  Remaining violations: ${report.validation.violations.length}`));
    console.log(chalk.gray('     Run `fsd-migrate validate -p <project>` for details'));
  } else {
    console.log(chalk.green('\n  ✓ All FSD boundary checks passed'));
  }

  console.log(chalk.gray('\n' + '─'.repeat(50)));
  console.log(chalk.green('  Done! Review changes and run `tsc --noEmit` to verify types.\n'));
}
