// PRISM INGEST — AST extraction via the TypeScript compiler API (W-IMPORT, D3).
//
// `typescript@5.7.2` is ALREADY a project dependency, so component/import/copy
// extraction adds ZERO supply-chain surface. `ts.createSourceFile(..., TSX)` is
// pure syntactic parsing — no Program, no type-checker, no config resolution — so
// it is robust to a repo that does not compile. Every entry point fails open: a
// parse error yields a best-effort regex fallback, never a dead end (I-FAILOPEN).

import ts from 'typescript';

export interface SourceFacts {
  /** The default-exported component name (PascalCase), or null. */
  componentName: string | null;
  /** Named exports (component + util names). */
  exports: string[];
  /** Local import module specifiers ('./x', '../y', '@/z'). */
  localImports: string[];
  /** package specifiers imported ('react', 'next/font/google', 'stripe'). */
  packageImports: string[];
  /** `'use client'` directive present. */
  isClient: boolean;
  /** `'use server'` directive OR a top-level `'use server'`-marked action. */
  hasServerAction: boolean;
  /** Copy, classified by nearest JSX tag. */
  headings: string[];
  cta: string[];
  body: string[];
}

function scriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (fileName.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

export function parseSource(fileName: string, text: string): ts.SourceFile | null {
  try {
    return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKind(fileName));
  } catch {
    return null;
  }
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'title']);
const CTA_TAGS = new Set(['button', 'a']);

function tagNameOf(el: ts.JsxOpeningElement | ts.JsxSelfClosingElement): string {
  const t = el.tagName;
  return ts.isIdentifier(t) ? t.getText() : t.getText();
}

/** True for a lowercase HTML-ish tag (`h1`, `button`) vs a component (`Hero`). */
function isHtmlTag(name: string): boolean {
  return /^[a-z]/.test(name);
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** One syntactic pass per source file. Never throws. */
export function extractSourceFacts(fileName: string, text: string): SourceFacts {
  const facts: SourceFacts = {
    componentName: null,
    exports: [],
    localImports: [],
    packageImports: [],
    isClient: /^\s*['"]use client['"]/m.test(text.slice(0, 400)),
    hasServerAction: /^\s*['"]use server['"]/m.test(text.slice(0, 400)),
    headings: [],
    cta: [],
    body: [],
  };

  const sf = parseSource(fileName, text);
  if (!sf) {
    // Regex fallback for copy (headings only) so import never dead-ends.
    const h = [...text.matchAll(/<h[1-3][^>]*>([^<]{2,120})<\/h[1-3]>/gi)].map((m) => cleanText(m[1]));
    facts.headings = dedupe(h).slice(0, 12);
    return facts;
  }

  const tagStack: string[] = [];

  const visit = (node: ts.Node): void => {
    // Imports.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith('.') || spec.startsWith('@/')) facts.localImports.push(spec);
      else facts.packageImports.push(spec);
    }
    // Exports (named function/const/class + default).
    if (ts.isFunctionDeclaration(node) && node.name) {
      const isExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      const isDefault = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (isExport) facts.exports.push(node.name.text);
      if (isDefault && /^[A-Z]/.test(node.name.text)) facts.componentName ??= node.name.text;
    }
    if (ts.isVariableStatement(node)) {
      const isExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExport) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) facts.exports.push(d.name.text);
        }
      }
    }
    if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) {
      if (/^[A-Z]/.test(node.expression.text)) facts.componentName ??= node.expression.text;
    }

    // JSX element: push its HTML tag while traversing its children (the text
    // sibling lives on the JsxElement, not the JsxOpeningElement — so the stack
    // must wrap the element's whole subtree).
    if (ts.isJsxElement(node)) {
      const name = tagNameOf(node.openingElement);
      const html = isHtmlTag(name);
      if (html) tagStack.push(name.toLowerCase());
      ts.forEachChild(node, visit);
      if (html) tagStack.pop();
      return;
    }

    if (ts.isJsxText(node)) {
      const t = cleanText(node.text);
      if (t.length >= 2 && t.length <= 300 && !/^[\s{}]*$/.test(t)) {
        const top = tagStack[tagStack.length - 1];
        if (top && HEADING_TAGS.has(top)) facts.headings.push(t);
        else if (top && CTA_TAGS.has(top)) facts.cta.push(t);
        else facts.body.push(t);
      }
    }

    ts.forEachChild(node, visit);
  };

  try {
    visit(sf);
  } catch {
    /* partial facts are fine — fail open */
  }

  facts.exports = dedupe(facts.exports).slice(0, 60);
  facts.localImports = dedupe(facts.localImports).slice(0, 60);
  facts.packageImports = dedupe(facts.packageImports).slice(0, 80);
  facts.headings = dedupe(facts.headings).slice(0, 12);
  facts.cta = dedupe(facts.cta).slice(0, 8);
  facts.body = dedupe(facts.body).slice(0, 12);
  return facts;
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}

/** Map an import specifier to a component base name ('./Hero' → 'Hero'). */
export function importBaseName(spec: string): string {
  const last = spec.split('/').pop() ?? spec;
  return last.replace(/\.(tsx?|jsx?)$/, '');
}
