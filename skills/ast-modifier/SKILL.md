---
name: ast-modifier
description: Performs precise AST-level transforms on JavaScript/TypeScript source files using Babel. Use when you need to rewrite import paths, remove PropTypes declarations, or extract import lists from source code without regex heuristics.
---

## What this skill does

Wraps Babel's `@babel/parser` + `@babel/traverse` to provide three deterministic transforms:

| Function | Description |
|----------|-------------|
| `parseAST(source, isTS?)` | Parse source into a Babel AST |
| `rewriteImportPaths(source, pathMap, isTS?)` | Replace import `from` values using an old→new map. Also handles dynamic `import()` calls. |
| `extractImports(source, isTS?)` | Return all import declarations as `{ source, specifiers }[]` |
| `removePropTypes(source)` | Strip `import PropTypes` and `Component.propTypes = {}` assignments |

## When to call it

- **TS Migrator**: call `removePropTypes` after converting prop-types to TypeScript interfaces
- **Dependency Fixer**: call `rewriteImportPaths` after the FSD Slicer moves files
- **Imports Linter**: call `extractImports` to build the import graph

## Script

`skills/ast-modifier/scripts/index.js`

### Example

```js
import { rewriteImportPaths } from './scripts/index.js';

const updated = rewriteImportPaths(source, {
  '../../components/Button': '@/shared/ui/Button',
}, true /* isTypeScript */);
```

## Used by
- **TS Migrator** — PropTypes removal
- **Dependency Fixer** — Import path rewriting
- **Imports Linter** — Import graph construction
