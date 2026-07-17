/**
 * skill: ast-modifier
 *
 * Uses Babel's parser + traverse to perform precise AST-level transforms on
 * JavaScript/TypeScript source files.
 *
 * Used by: TS Migrator (prop-type → interface conversion)
 *          Dependency Fixer (import path rewriting)
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Parse a source file into a Babel AST.
 *
 * @param {string} source - Raw file content
 * @param {boolean} [isTypeScript] - Whether to enable TS plugins
 * @returns {import('@babel/types').File}
 */
export function parseAST(source, isTypeScript = false) {
  return parse(source, {
    sourceType: 'module',
    plugins: [
      'jsx',
      ...(isTypeScript ? ['typescript'] : []),
      'decorators-legacy',
      'classProperties',
    ],
  });
}

/**
 * Rewrite all import declarations that match a from→to path mapping.
 *
 * @param {string} source - Raw file content
 * @param {Record<string, string>} pathMap - { 'old/path': 'new/path' }
 * @param {boolean} [isTypeScript]
 * @returns {string} - Transformed source code
 */
export function rewriteImportPaths(source, pathMap, isTypeScript = false) {
  const ast = parseAST(source, isTypeScript);

  traverse(ast, {
    ImportDeclaration(path) {
      const currentValue = path.node.source.value;
      if (pathMap[currentValue]) {
        path.node.source = t.stringLiteral(pathMap[currentValue]);
      }
    },
    // Also handle dynamic imports: import('old/path')
    CallExpression(path) {
      if (
        path.node.callee.type === 'Import' &&
        path.node.arguments[0]?.type === 'StringLiteral' &&
        pathMap[path.node.arguments[0].value]
      ) {
        path.node.arguments[0] = t.stringLiteral(
          pathMap[path.node.arguments[0].value]
        );
      }
    },
  });

  return generate(ast, { retainLines: true }, source).code;
}

/**
 * Extract all import declarations from a source file.
 *
 * @param {string} source
 * @param {boolean} [isTypeScript]
 * @returns {{ source: string; specifiers: string[] }[]}
 */
export function extractImports(source, isTypeScript = false) {
  const ast = parseAST(source, isTypeScript);
  const imports = [];

  traverse(ast, {
    ImportDeclaration(path) {
      imports.push({
        source: path.node.source.value,
        specifiers: path.node.specifiers.map((s) => s.local.name),
      });
    },
  });

  return imports;
}

/**
 * Remove all PropTypes-related imports and assignments from a JSX file.
 * Used by TS Migrator after converting prop-types to TypeScript interfaces.
 *
 * @param {string} source
 * @returns {string}
 */
export function removePropTypes(source) {
  const ast = parseAST(source, false);

  traverse(ast, {
    // Remove: import PropTypes from 'prop-types'
    ImportDeclaration(path) {
      if (path.node.source.value === 'prop-types') {
        path.remove();
      }
    },
    // Remove: Component.propTypes = { ... }
    ExpressionStatement(path) {
      const expr = path.node.expression;
      if (
        t.isAssignmentExpression(expr) &&
        t.isMemberExpression(expr.left) &&
        t.isIdentifier(expr.left.property, { name: 'propTypes' })
      ) {
        path.remove();
      }
    },
  });

  return generate(ast, {}, source).code;
}
