/**
 * skill: file-parser
 *
 * Recursively scans a React project directory and returns a structured
 * inventory of all source files with their metadata.
 *
 * Used by: Orchestrator (Step 1 — Inventory & Classify)
 */

import { glob } from 'glob';
import { readFileSync, statSync } from 'fs';
import { extname, relative } from 'path';

/** @typedef {'js'|'jsx'|'ts'|'tsx'|'css'|'json'|'other'} FileKind */

/**
 * @typedef {Object} FileEntry
 * @property {string} absolutePath
 * @property {string} relativePath
 * @property {FileKind} kind
 * @property {number} sizeBytes
 * @property {boolean} hasDefaultExport
 * @property {string[]} namedExports
 */

/**
 * Parse all source files under a project root.
 *
 * @param {string} projectRoot - Absolute path to the legacy project root
 * @param {string[]} [ignore] - Glob patterns to ignore (defaults to node_modules, dist)
 * @returns {Promise<FileEntry[]>}
 */
export async function parseProjectFiles(projectRoot, ignore = []) {
  const defaultIgnore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
  ];

  const files = await glob('**/*.{js,jsx,ts,tsx,css,json}', {
    cwd: projectRoot,
    ignore: [...defaultIgnore, ...ignore],
    absolute: true,
  });

  return files.map((absolutePath) => {
    const ext = extname(absolutePath).slice(1);
    const content = readFileSync(absolutePath, 'utf-8');
    const { size } = statSync(absolutePath);

    return {
      absolutePath,
      relativePath: relative(projectRoot, absolutePath),
      kind: resolveKind(ext),
      sizeBytes: size,
      hasDefaultExport: /export\s+default\s/.test(content),
      namedExports: extractNamedExports(content),
    };
  });
}

/**
 * @param {string} ext
 * @returns {FileKind}
 */
function resolveKind(ext) {
  const map = { js: 'js', jsx: 'jsx', ts: 'ts', tsx: 'tsx', css: 'css', json: 'json' };
  return map[ext] ?? 'other';
}

/**
 * Lightweight named export extraction (regex-based, no AST).
 * For full AST extraction use the ast-modifier skill.
 *
 * @param {string} content
 * @returns {string[]}
 */
function extractNamedExports(content) {
  const matches = content.matchAll(/export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/g);
  return [...matches].map((m) => m[1]);
}
