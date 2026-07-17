/**
 * skill: circular-deps-detector
 *
 * Detects circular dependencies and oversized barrel files across a project.
 * Uses a depth-first graph traversal (no external dep required).
 *
 * Used by: Orchestrator (Step 5 — Validation), FSD Slicer (pre-completion check)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { extractImports } from '../../ast-modifier/scripts/index.js';

const MAX_BARREL_EXPORTS = 20;

/**
 * @typedef {Object} Cycle
 * @property {string[]} path - The cycle path e.g. ['A', 'B', 'C', 'A']
 * @property {'same-slice'|'cross-slice'|'cross-layer'} severity
 */

/**
 * @typedef {Object} OversizedBarrel
 * @property {string} file
 * @property {number} exportCount
 * @property {string[]} exports
 */

/**
 * @typedef {Object} DetectionReport
 * @property {Cycle[]} cycles
 * @property {OversizedBarrel[]} oversizedBarrels
 * @property {boolean} hasBlockingIssues - true if any cross-layer cycle or barrel violation exists
 */

/**
 * Run full circular dependency and barrel analysis on a project.
 *
 * @param {string} srcRoot - Absolute path to the project's src/ directory
 * @param {string[]} filePaths - All .ts/.tsx file paths relative to srcRoot
 * @returns {DetectionReport}
 */
export function analyzeProject(srcRoot, filePaths) {
  const graph = buildImportGraph(srcRoot, filePaths);
  const cycles = detectCycles(graph);
  const oversizedBarrels = findOversizedBarrels(srcRoot, filePaths);

  const hasBlockingIssues =
    cycles.some((c) => c.severity === 'cross-layer') ||
    oversizedBarrels.length > 0;

  return { cycles, oversizedBarrels, hasBlockingIssues };
}

/**
 * Build an adjacency list import graph.
 *
 * @param {string} srcRoot
 * @param {string[]} filePaths
 * @returns {Map<string, string[]>} file → list of imported files (relative to srcRoot)
 */
function buildImportGraph(srcRoot, filePaths) {
  const graph = new Map();
  const fileSet = new Set(filePaths);

  for (const filePath of filePaths) {
    const absolutePath = resolve(srcRoot, filePath);
    let source;
    try {
      source = readFileSync(absolutePath, 'utf-8');
    } catch {
      graph.set(filePath, []);
      continue;
    }

    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const imports = extractImports(source, isTS);
    const deps = [];

    for (const { source: importPath } of imports) {
      const resolved = resolveToProjectPath(srcRoot, filePath, importPath, fileSet);
      if (resolved) deps.push(resolved);
    }

    graph.set(filePath, deps);
  }

  return graph;
}

/**
 * Detect cycles using DFS with path tracking (Johnson's algorithm simplified).
 *
 * @param {Map<string, string[]>} graph
 * @returns {Cycle[]}
 */
function detectCycles(graph) {
  const visited = new Set();
  const inStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cyclePath = [...path.slice(cycleStart), node];
      cycles.push({
        path: cyclePath,
        severity: classifyCycleSeverity(cyclePath),
      });
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of graph.get(node) ?? []) {
      dfs(dep, path);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const node of graph.keys()) {
    dfs(node, []);
  }

  return deduplicateCycles(cycles);
}

/**
 * Classify cycle severity based on FSD layers involved.
 *
 * @param {string[]} cyclePath
 * @returns {'same-slice'|'cross-slice'|'cross-layer'}
 */
function classifyCycleSeverity(cyclePath) {
  const FSD_LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

  const layers = cyclePath.map((p) => {
    const parts = p.split('/');
    return FSD_LAYERS.includes(parts[0]) ? parts[0] : null;
  }).filter(Boolean);

  const uniqueLayers = new Set(layers);

  if (uniqueLayers.size > 1) return 'cross-layer';

  const slices = cyclePath.map((p) => p.split('/').slice(0, 2).join('/'));
  const uniqueSlices = new Set(slices);

  if (uniqueSlices.size > 1) return 'cross-slice';

  return 'same-slice';
}

/**
 * Find barrel files (index.ts) that export more than MAX_BARREL_EXPORTS symbols.
 *
 * @param {string} srcRoot
 * @param {string[]} filePaths
 * @returns {OversizedBarrel[]}
 */
function findOversizedBarrels(srcRoot, filePaths) {
  const barrels = filePaths.filter(
    (f) => f.endsWith('/index.ts') || f.endsWith('/index.tsx') || f === 'index.ts'
  );

  const oversized = [];

  for (const barrelPath of barrels) {
    const absolutePath = resolve(srcRoot, barrelPath);
    let source;
    try {
      source = readFileSync(absolutePath, 'utf-8');
    } catch {
      continue;
    }

    // Match: export { A, B, C } from '...' and export type { X } from '...'
    const namedExportMatches = [
      ...source.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g),
    ];

    const allExports = namedExportMatches
      .flatMap((m) =>
        m[1].split(',').map((s) => s.trim().replace(/\s+as\s+\w+$/, ''))
      )
      .filter(Boolean);

    // Also count: export { default as X } style
    const defaultReExports = [...source.matchAll(/export\s+\*\s+from/g)].length;
    const totalCount = allExports.length + defaultReExports;

    if (totalCount > MAX_BARREL_EXPORTS) {
      oversized.push({
        file: barrelPath,
        exportCount: totalCount,
        exports: allExports,
      });
    }
  }

  return oversized;
}

/**
 * Resolve an import path (relative or aliased) to a project-relative path.
 *
 * @param {string} srcRoot
 * @param {string} fromFile
 * @param {string} importPath
 * @param {Set<string>} fileSet
 * @returns {string|null}
 */
function resolveToProjectPath(srcRoot, fromFile, importPath, fileSet) {
  let candidate;

  if (importPath.startsWith('@/')) {
    candidate = importPath.slice(2); // strip "@/"
  } else if (importPath.startsWith('.')) {
    const fromDir = dirname(resolve(srcRoot, fromFile));
    const abs = resolve(fromDir, importPath);
    candidate = abs.startsWith(srcRoot) ? abs.slice(srcRoot.length + 1) : null;
  } else {
    return null; // external package
  }

  if (!candidate) return null;

  // Try with extensions
  const extensions = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
  if (fileSet.has(candidate)) return candidate;

  for (const ext of extensions) {
    const withExt = candidate + ext;
    if (fileSet.has(withExt)) return withExt;
  }

  return null;
}

/**
 * Remove duplicate cycles (same set of nodes, different start point).
 *
 * @param {Cycle[]} cycles
 * @returns {Cycle[]}
 */
function deduplicateCycles(cycles) {
  const seen = new Set();
  return cycles.filter((c) => {
    const key = [...c.path].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
