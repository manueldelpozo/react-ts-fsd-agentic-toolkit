---
name: imports-linter
description: Validates FSD import boundary rules across a project. Detects upward imports, cross-slice imports, and internal path access violations. Use when verifying that a migrated project is fully FSD-compliant, or in CI to prevent regressions.
---

## What this skill does

Scans all `.ts`/`.tsx` files and reports violations of three FSD rules:

| Rule type | Description |
|-----------|-------------|
| `upward-import` | A lower layer imports from a higher layer (e.g. `shared` imports from `features`) |
| `cross-slice` | A slice imports directly from another slice in the same layer (use `@x` instead) |
| `internal-path` | A consumer bypasses `index.ts` and imports from an internal file path |

## When to call it

- **Orchestrator Step 5**: Post-migration validation — all three phases must be complete first
- **CLI `validate` command**: Standalone use without running a full migration
- **CI pipelines**: Exit code `1` on any violation

## Script

`skills/imports-linter/scripts/index.js`

### API

```js
import { lintImportBoundaries } from './scripts/index.js';

const violations = lintImportBoundaries('/path/to/src', filePaths);
// returns Violation[]
```

```ts
interface Violation {
  file: string;
  importPath: string;
  type: 'upward-import' | 'cross-slice' | 'internal-path';
  message: string;
}
```

### Helper functions

- `detectLayer(relativePath)` — returns the FSD layer name for a path
- `detectSlice(relativePath)` — returns the slice name within a layer

## Used by
- **Orchestrator** — Step 5: Validation
- **CLI** — `fsd-migrate validate` command
