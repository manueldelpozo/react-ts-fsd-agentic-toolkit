---
name: file-parser
description: Recursively scans a React project directory and returns a structured inventory of all source files with their kind, size, and export metadata. Use when the Orchestrator needs to build the initial file inventory before classification.
---

## What this skill does

Traverses a project root (ignoring `node_modules`, `dist`, `.git`) and returns a `FileEntry[]` with:
- File path (absolute + relative)
- Kind: `js | jsx | ts | tsx | css | json | other`
- Size in bytes
- Whether it has a default export
- List of named exports (regex-based, no AST overhead)

## When to call it

Call this skill **first**, before any other agent phase. It provides the raw input the Orchestrator needs to classify files into FSD layers.

## Script

`skills/file-parser/scripts/index.js`

### API

```js
import { parseProjectFiles } from './scripts/index.js';

const files = await parseProjectFiles('/path/to/legacy-react-app');
// returns FileEntry[]
```

### FileEntry shape

| Field | Type | Description |
|-------|------|-------------|
| `absolutePath` | `string` | Full absolute path |
| `relativePath` | `string` | Relative to project root |
| `kind` | `'js'\|'jsx'\|'ts'\|'tsx'\|'css'\|'json'\|'other'` | File type |
| `sizeBytes` | `number` | File size in bytes |
| `hasDefaultExport` | `boolean` | Whether the file has a default export |
| `namedExports` | `string[]` | List of named exports (regex-based) |

## Used by
- **Orchestrator** — Step 1: Inventory & Classify
