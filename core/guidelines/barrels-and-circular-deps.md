# Guideline: Barrel Files & Dependency Circles

> **Status**: Shared — include in system prompts for: FSD Slicer, Dependency Fixer, Orchestrator
>
> Reference with: `See core/guidelines/barrels-and-circular-deps.md`

---

## 1. Barrel Files (`index.ts`) — Risks & Rules

### What is a barrel?
A barrel is an `index.ts` that re-exports from multiple modules in the same directory:

```ts
// src/shared/ui/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';
```

### Why they can hurt

| Risk | Cause | Impact |
|------|-------|--------|
| **Tree-shaking degradation** | Bundlers (Webpack/Rollup) can't statically analyse re-exports across large barrels | Unused code ships to production |
| **Slow TypeScript compilation** | Every consumer triggers resolution of the entire barrel | `tsc` time grows quadratically with barrel size |
| **Circular dependency creation** | Barrel A imports from Barrel B which imports from Barrel A | Runtime `undefined` errors, hard to debug |
| **Hidden coupling** | Developers import from the barrel instead of thinking about the actual dependency | Architecture degrades silently |

### Rules to enforce

1. **Max 20 named exports per barrel** — if a barrel grows beyond this, split the slice into sub-slices.
2. **Never barrel-import from the same layer** — e.g. `shared/ui/index.ts` must not import from `shared/api/index.ts`.
3. **One barrel per slice, at the slice root** — do not create nested barrels inside `ui/`, `model/`, `api/` segments.
4. **No re-export chains longer than 2 hops** — `A → index → B → index → C` is a smell; flatten it.
5. **Type-only exports use `export type`** — prevents value-graph side effects:
   ```ts
   export type { ButtonProps } from './Button'; // ✅
   export { ButtonProps } from './Button';      // ❌ pulls in runtime module
   ```

### When to flag for manual review
- A barrel exports more than 20 symbols → report to Orchestrator
- A barrel re-exports from a different FSD layer → hard violation, block migration
- A newly created barrel would create a cycle → block and report

---

## 2. Circular Dependencies — Detection & Resolution

### What is a circular dependency?
```
A imports B
B imports C
C imports A   ← cycle
```
At runtime, one of the modules will be `undefined` when first evaluated, causing subtle bugs.

### Common FSD circular patterns

```
features/auth → entities/user → features/auth   ❌ (layer cycle)
shared/ui/Form → shared/lib/validators → shared/ui/Form  ❌ (same-layer cycle)
pages/Home → widgets/Feed → pages/Home  ❌ (upper-layer cycle)
```

### How to resolve

| Pattern | Resolution |
|---------|-----------|
| **Entity ↔ Entity** | Use the `@x` cross-entity notation to make the dependency explicit and one-directional |
| **Feature ↔ Entity** | Extract the shared type/interface to `entities/<name>/model/types.ts` and import from there |
| **Shared ↔ Shared** | Extract the shared logic to a new `shared/lib/<name>` sub-module imported by both |
| **Feature ↔ Feature** | This is always a boundary violation — extract to a new shared entity or widget |

### `@x` notation (FSD standard for cross-entity imports)

```ts
// entities/product/ui/ProductCard.tsx needs the User type

// ✅ Correct — explicit cross-entity bridge
import type { User } from '@/entities/user/@x/product';

// Create the bridge file:
// entities/user/@x/product.ts
export type { User } from '../model/types';
```

This makes the dependency **visible, intentional, and one-directional**.

### Decision tree for the agent

```
Circular dep detected?
  └─ Both sides in same slice?
       └─ YES → extract to a shared sub-module inside that slice
       └─ NO, same layer?
            └─ YES → use @x if entities, else extract to shared/
            └─ NO, cross-layer?
                 └─ Always a boundary violation → report to Orchestrator, do NOT auto-fix
```

---

## 3. Checklist for Agents

Before completing any phase, verify:

- [ ] No barrel exports more than 20 symbols
- [ ] No barrel imports from a different FSD layer
- [ ] No re-export chains longer than 2 hops
- [ ] All type-only exports use `export type`
- [ ] No circular dependencies (run `circular-deps-detector` skill)
- [ ] Any `@x` bridges created are documented in the output contract
