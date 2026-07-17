/**
 * skill: imports-linter
 *
 * Validates FSD import boundary rules across a project.
 * Wraps Steiger's rule engine concepts in a lightweight Node.js implementation.
 *
 * Used by: Orchestrator (Step 5 — Validation)
 */

import { extractImports } from '../../ast-modifier/scripts/index.js';
import { readFileSync } from 'fs';
import { resolve, relative } from 'path';

/** FSD layer order (index = priority; lower index = higher layer) */
const FSD_LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

/**
 * @typedef {Object} Violation
 * @property {string} file - File containing the violation
 * @property {string} importPath - The offending import path
 * @property {'upward-import'|'cross-slice'|'internal-path'} type
 * @property {string} message
 */

/**
 * Determine the FSD layer of a given file path.
 *
 * @param {string} relativePath - Path relative to src/
 * @returns {string|null} layer name or null if not in FSD structure
 */
export function detectLayer(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  for (const layer of FSD_LAYERS) {
    if (normalized.startsWith(`${layer}/`) || normalized === layer) {
      return layer;
    }
  }
  return null;
}

/**
 * Determine the slice name within a layer.
 * e.g. "features/auth/ui/LoginForm.tsx" → "auth"
 *
 * @param {string} relativePath
 * @returns {string|null}
 */
export function detectSlice(relativePath) {
  const parts = relativePath.replace(/\\/g, '/').split('/');
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Lint all project files for FSD import boundary violations.
 *
 * @param {string} projectRoot - Absolute path to project src/
 * @param {string[]} filePaths - All .ts/.tsx file paths (relative to projectRoot)
 * @returns {Violation[]}
 */
export function lintImportBoundaries(projectRoot, filePaths) {
  const violations = [];

  for (const filePath of filePaths) {
    const absolutePath = resolve(projectRoot, filePath);
    let source;
    try {
      source = readFileSync(absolutePath, 'utf-8');
    } catch {
      continue;
    }

    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const imports = extractImports(source, isTS);
    const fileLayer = detectLayer(filePath);
    const fileSlice = detectSlice(filePath);

    for (const { source: importPath } of imports) {
      // Only check local/aliased imports
      if (!importPath.startsWith('@/') && !importPath.startsWith('.')) continue;

      const resolvedImport = resolveAliasedPath(importPath);
      if (!resolvedImport) continue;

      const importLayer = detectLayer(resolvedImport);
      const importSlice = detectSlice(resolvedImport);

      if (!importLayer || !fileLayer) continue;

      const fileLayerIdx = FSD_LAYERS.indexOf(fileLayer);
      const importLayerIdx = FSD_LAYERS.indexOf(importLayer);

      // Rule 1: Upward imports (lower layer importing from upper layer)
      if (importLayerIdx < fileLayerIdx) {
        violations.push({
          file: filePath,
          importPath,
          type: 'upward-import',
          message: `Layer "${fileLayer}" cannot import from higher layer "${importLayer}"`,
        });
      }

      // Rule 2: Cross-slice imports within same layer (excluding shared)
      if (
        importLayerIdx === fileLayerIdx &&
        fileLayer !== 'shared' &&
        fileLayer !== 'app' &&
        fileSlice !== importSlice
      ) {
        violations.push({
          file: filePath,
          importPath,
          type: 'cross-slice',
          message: `Slice "${fileSlice}" in "${fileLayer}" cannot directly import from slice "${importSlice}". Use @x notation.`,
        });
      }

      // Rule 3: Internal path access (bypassing index.ts)
      const pathParts = resolvedImport.split('/');
      if (
        pathParts.length > 2 &&
        importLayer !== 'app' &&
        !importPath.includes('/@x/')
      ) {
        violations.push({
          file: filePath,
          importPath,
          type: 'internal-path',
          message: `Import bypasses public API index.ts. Use "@/${importLayer}/${importSlice}" instead of "${importPath}"`,
        });
      }
    }
  }

  return violations;
}

/**
 * Resolve a path alias like "@/shared/ui/Button" to "shared/ui/Button".
 * Strips the leading "@/" prefix.
 *
 * @param {string} importPath
 * @returns {string|null}
 */
function resolveAliasedPath(importPath) {
  if (importPath.startsWith('@/')) {
    return importPath.slice(2); // remove "@/"
  }
  return null; // relative paths need context — handled by caller
}
