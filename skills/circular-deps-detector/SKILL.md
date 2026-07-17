---
name: circular-deps-detector
description: Detects circular dependencies and oversized barrel files in a TypeScript project using DFS graph traversal. Use after the FSD Slicer and Dependency Fixer phases to verify no cycles were introduced and no barrel exceeds the 20-export limit.
---

## What this skill does

Runs two analyses in a single pass:

### 1. Circular Dependency Detection
Builds a full import graph and runs DFS cycle detection. Each cycle is classified by severity:

| Severity | Meaning | Agent action |
|----------|---------|-------------|
| `same-slice` | Cycle within one slice | Auto-extractable to internal sub-module |
| `cross-slice` | Cycle between slices in same layer | Use `@x` notation |
| `cross-layer` | Cycle crossing FSD layers | **Blocking** — report to Orchestrator, never auto-fix |

### 2. Oversized Barrel Detection
Counts named exports in every `index.ts`/`index.tsx`. Flags any barrel exceeding **20 exports** as a tree-shaking and compilation risk.

## When to call it

- **Dependency Fixer**: after all imports are rewritten, before marking phase complete
- **FSD Slicer**: after all `index.ts` barrels are generated
- **Orchestrator Step 5**: final validation gate — `hasBlockingIssues: true` must block the migration report

## Script

`skills/circular-deps-detector/scripts/index.js`

### API

```js
import { analyzeProject } from './scripts/index.js';

const report = analyzeProject('/path/to/src', filePaths);
// returns DetectionReport
```

```ts
interface DetectionReport {
  cycles: Cycle[];
  oversizedBarrels: OversizedBarrel[];
  hasBlockingIssues: boolean;
}
```

## Knowledge reference
See `core/guidelines/barrels-and-circular-deps.md` for the full rules this skill enforces.

## Used by
- **Orchestrator** — Step 5: Validation
- **FSD Slicer** — pre-completion barrel check
- **Dependency Fixer** — post-fix cycle verification
