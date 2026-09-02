import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type TextMatch = {
  file: string;
  token: string;
};

type JsxElementWithAttributes = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

const libDir = dirname(fileURLToPath(import.meta.url));
const srcDir = join(libDir, "..");
const projectRoot = join(srcDir, "..");
const sourceExtensions = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const rawImageTagPattern = new RegExp("<" + "img\\b", "g");
const rawScriptTagPattern = new RegExp("<" + "script\\b", "g");
const reactComponentTypePattern = new RegExp(
  `\\b(?:React\\.FC|${"Function"}Component)\\b`,
  "g"
);
const serviceMediaHelperImportPattern =
  /import\s+\{[^}]*get(?:BranchQr|ProductImage|StoreLogo|UserProfile)Url[^}]*\}\s+from\s+["']@\/services\//g;
const directOrderCustomerServiceImportPattern =
  /import\s+\{[\s\S]*\b(?:fetchCateProducts|getProdItem|resolvePrinterDeviceContext)\b[\s\S]*\}\s+from\s+["']@\/services\//;
const routeFileNames = new Set([
  "default.tsx",
  "error.tsx",
  "global-error.tsx",
  "layout.tsx",
  "loading.tsx",
  "not-found.tsx",
  "page.tsx",
  "template.tsx"
]);
const allowedClientRouteFiles = new Set([
  "app/error.tsx",
  "app/global-error.tsx",
  "app/not-found.tsx",
  "app/(protected)/error.tsx",
  "app/(protected)/not-found.tsx"
]);
const allowedUiRouteFiles = new Set([
  "app/error.tsx",
  "app/not-found.tsx",
  "app/(protected)/error.tsx",
  "app/(protected)/not-found.tsx"
]);
const routeFileLineLimit = 80;
const suppressionPattern = new RegExp(
  `(?:eslint-${"disable"}(?:-next-line)?|@ts-${"ignore"}|@ts-${"expect-error"})`,
  "g"
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) return sourceFiles(fullPath);
    return entry.isFile() && sourceExtensions.has(extname(entry.name)) ? [fullPath] : [];
  });
}

function normalizedPath(path: string) {
  return relative(srcDir, path).split(sep).join("/");
}

function normalizedProjectPath(path: string) {
  return relative(projectRoot, path).split(sep).join("/");
}

function matchesInFiles(directory: string, pattern: RegExp): TextMatch[] {
  return sourceFiles(directory).flatMap((path) => {
    const content = readFileSync(path, "utf8");
    const matches = [...content.matchAll(pattern)];

    return matches.map((match) => ({
      file: normalizedPath(path),
      token: match[1] ?? match[0]
    }));
  });
}

function matchesInProjectFiles(directories: string[], pattern: RegExp): TextMatch[] {
  return directories.flatMap((directory) =>
    sourceFiles(directory).flatMap((path) => {
      const content = readFileSync(path, "utf8");
      const matches = [...content.matchAll(pattern)];

      return matches.map((match) => ({
        file: normalizedProjectPath(path),
        token: match[1] ?? match[0]
      }));
    })
  );
}

function sourceFileForPath(path: string) {
  const content = readFileSync(path, "utf8");
  const scriptKind = path.endsWith(".tsx") || path.endsWith(".jsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;

  return ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, scriptKind);
}

function explicitAnyTypes(directories: string[]) {
  return directories.flatMap((directory) =>
    sourceFiles(directory).flatMap((path) => {
      const source = sourceFileForPath(path);
      const matches: TextMatch[] = [];

      function visit(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          matches.push({
            file: normalizedProjectPath(path),
            token: `any at line ${line + 1}`
          });
        }
        ts.forEachChild(node, visit);
      }

      visit(source);
      return matches;
    })
  );
}

function typeScriptEnums(directories: string[]) {
  return directories.flatMap((directory) =>
    sourceFiles(directory).flatMap((path) => {
      const source = sourceFileForPath(path);
      const matches: TextMatch[] = [];

      function visit(node: ts.Node) {
        if (ts.isEnumDeclaration(node)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          matches.push({
            file: normalizedProjectPath(path),
            token: `enum ${node.name.text} at line ${line + 1}`
          });
        }
        ts.forEachChild(node, visit);
      }

      visit(source);
      return matches;
    })
  );
}

function runtimeImportNames(importClause: ts.ImportClause | undefined) {
  if (!importClause || importClause.isTypeOnly) return [];

  const names: string[] = [];
  if (importClause.name) names.push(importClause.name.text);

  const bindings = importClause.namedBindings;
  if (!bindings) return names;

  if (ts.isNamespaceImport(bindings)) names.push(`* as ${bindings.name.text}`);
  if (ts.isNamedImports(bindings)) {
    names.push(
      ...bindings.elements
        .filter((element) => !element.isTypeOnly)
        .map((element) => element.name.text)
    );
  }

  return names;
}

// invoice-print-window lives under services/printer for co-location with the rest of
// the printing layer (per CLAUDE.md), but it only renders HTML/manages print windows —
// it does no apiRequest data access, so it's exempt from the service-layer-isolation guard.
const printRenderingServiceSpecifier = "@/services/printer/invoice-print-window";

function runtimeServiceImports(directory: string): TextMatch[] {
  return sourceFiles(directory).flatMap((path) => {
    const content = readFileSync(path, "utf8");
    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);

    return source.statements.flatMap((statement) => {
      if (!ts.isImportDeclaration(statement)) return [];
      const specifier = statement.moduleSpecifier;
      if (
        !ts.isStringLiteral(specifier) ||
        !specifier.text.startsWith("@/services/") ||
        specifier.text === printRenderingServiceSpecifier
      )
        return [];

      const names = runtimeImportNames(statement.importClause);
      if (!names.length) return [];

      return [{
        file: normalizedPath(path),
        token: `${specifier.text}: ${names.join(", ")}`
      }];
    });
  });
}

function hasUseClientDirective(content: string) {
  const source = ts.createSourceFile("source.tsx", content, ts.ScriptTarget.Latest, true);

  return source.statements.some((statement) =>
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === "use client"
  );
}

function appRouteFiles() {
  return sourceFiles(join(srcDir, "app"))
    .filter((path) => routeFileNames.has(path.split(sep).at(-1) ?? ""));
}

function runtimeUiImports(path: string): TextMatch[] {
  const source = sourceFileForPath(path);

  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement)) return [];
    const specifier = statement.moduleSpecifier;
    if (
      !ts.isStringLiteral(specifier) ||
      !specifier.text.startsWith("@/components/ui/")
    )
      return [];

    const names = runtimeImportNames(statement.importClause);
    if (!names.length) return [];

    return [{
      file: normalizedPath(path),
      token: `${specifier.text}: ${names.join(", ")}`
    }];
  });
}

function jsxAttribute(
  node: JsxElementWithAttributes,
  source: ts.SourceFile,
  name: string
) {
  return node.attributes.properties.find((property): property is ts.JsxAttribute =>
    ts.isJsxAttribute(property) && property.name.getText(source) === name
  );
}

function jsxAttributeStringValue(attribute: ts.JsxAttribute) {
  const initializer = attribute.initializer;
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    ts.isStringLiteral(initializer.expression)
  )
    return initializer.expression.text;

  return null;
}

function internalAnchorNavigationMatches(directories: string[]) {
  return directories.flatMap((directory) =>
    sourceFiles(directory).flatMap((path) => {
      const source = sourceFileForPath(path);
      const matches: TextMatch[] = [];

      function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const href = jsxAttribute(node, source, "href");
          const hrefValue = href ? jsxAttributeStringValue(href) : null;
          const hasDownload = Boolean(jsxAttribute(node, source, "download"));
          const isInternalHref = hrefValue?.startsWith("/") && !hrefValue.startsWith("//");

          if (node.tagName.getText(source) === "a" && isInternalHref && !hasDownload) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            matches.push({
              file: normalizedProjectPath(path),
              token: `${hrefValue} at line ${line + 1}`
            });
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(source);
      return matches;
    })
  );
}

describe("project refactor guards", () => {
  it("keeps the packaged Electron server outside ASAR and shell-free", () => {
    const mainProcess = readFileSync(join(projectRoot, "electron/main.ts"), "utf8");

    expect(mainProcess).toContain("process.resourcesPath");
    expect(mainProcess).toContain("assertNextServerPortAvailable(PORT)");
    expect(mainProcess).toContain("utilityProcess.fork");
    expect(mainProcess).not.toContain("node_modules");
    expect(mainProcess).not.toContain(".bin");
    expect(mainProcess).not.toContain("shell: true");
  });

  it("keeps chart.js removed from package manifests", () => {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8")
    ) as PackageManifest;
    const dependencySections = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies"
    ] as const;
    const sectionsWithChartJs = dependencySections.filter((section) => (
      Boolean(manifest[section]?.["chart.js"])
    ));
    const lockfile = readFileSync(join(projectRoot, "package-lock.json"), "utf8");

    expect(sectionsWithChartJs).toEqual([]);
    expect(lockfile).not.toContain("\"node_modules/chart.js\"");
  });

  it("keeps raw image tags limited to generated print templates", () => {
    const allowedRawImageFiles = new Set([
      "services/printer/invoice-print-window.ts",
      "features/pos/table-selection/table-qr-dialog.tsx",
      "features/pos/table-selection/branch-menu-qr-dialog.tsx"
    ]);
    const disallowedRawImages = matchesInFiles(srcDir, rawImageTagPattern)
      .filter((match) => !allowedRawImageFiles.has(match.file));

    expect(disallowedRawImages).toEqual([]);
  });

  it("keeps native script tags out of app code", () => {
    expect(matchesInFiles(join(srcDir, "app"), rawScriptTagPattern)).toEqual([]);
  });

  it("keeps internal navigation on next/link instead of native anchors", () => {
    expect(internalAnchorNavigationMatches([
      join(srcDir, "app"),
      join(srcDir, "features"),
      join(srcDir, "components")
    ])).toEqual([]);
  }, 15_000);

  it("keeps destructive confirmation dialogs backed by AlertDialog", () => {
    const confirmDialog = readFileSync(
      join(srcDir, "components/common/confirm-dialog.tsx"),
      "utf8"
    );

    expect(confirmDialog).toContain('from "@/components/ui/alert-dialog"');
    expect(confirmDialog).toContain("<AlertDialog ");
    expect(confirmDialog).not.toContain('from "@/components/ui/dialog"');
  });

  it("keeps feature UI free of space utilities and custom pulse loaders", () => {
    const featureMatches = matchesInFiles(
      join(srcDir, "features"),
      /(?:^|[\s"'`])(-?space-[xy]-[^\s"'`]+|animate-pulse)(?=[\s"'`])/g
    );

    expect(featureMatches).toEqual([]);
  });

  it("keeps component UI cleanup exceptions narrow", () => {
    const allowedComponentMatches = new Set([
      "components/ui/avatar.tsx:-space-x-2",
      "components/ui/skeleton.tsx:animate-pulse"
    ]);
    const disallowedComponentMatches = matchesInFiles(
      join(srcDir, "components"),
      /(?:^|[\s"'`])(-?space-[xy]-[^\s"'`]+|animate-pulse)(?=[\s"'`])/g
    ).filter((match) => !allowedComponentMatches.has(`${match.file}:${match.token}`));

    expect(disallowedComponentMatches).toEqual([]);
  });

  it("keeps source free of lint and TypeScript suppressions", () => {
    expect(matchesInProjectFiles([srcDir, join(projectRoot, "scripts")], suppressionPattern)).toEqual([]);
  });

  // เทสต์สองตัวนี้ parse AST ทั้ง src/ + scripts/ — เกิน 5s ได้เมื่อรันทั้ง suite พร้อมกัน
  it("keeps source free of explicit any types", () => {
    expect(explicitAnyTypes([srcDir, join(projectRoot, "scripts")])).toEqual([]);
  }, 15_000);

  it("keeps source free of TypeScript enums and React FC aliases", () => {
    expect(typeScriptEnums([srcDir, join(projectRoot, "scripts")])).toEqual([]);
    expect(matchesInProjectFiles([srcDir, join(projectRoot, "scripts")], reactComponentTypePattern)).toEqual([]);
  }, 15_000);

  it("keeps app, feature, and reusable component code free of runtime service imports", () => {
    const imports = [
      ...runtimeServiceImports(join(srcDir, "app")),
      ...runtimeServiceImports(join(srcDir, "features")),
      ...runtimeServiceImports(join(srcDir, "components"))
    ];

    expect(imports).toEqual([]);
  });

  it("keeps app route files as server components by default", () => {
    const clientRouteFiles = appRouteFiles()
      .map((path) => ({
        file: normalizedPath(path),
        token: "\"use client\""
      }))
      .filter((match) => hasUseClientDirective(readFileSync(join(srcDir, match.file), "utf8")))
      .filter((match) => !allowedClientRouteFiles.has(match.file));

    expect(clientRouteFiles).toEqual([]);
  });

  it("keeps app route files thin and delegates UI to components", () => {
    const oversizedRouteFiles = appRouteFiles()
      .map((path) => {
        const lineCount = readFileSync(path, "utf8").split(/\r?\n/).length;
        return {
          file: normalizedPath(path),
          token: `${lineCount} lines`
        };
      })
      .filter((match) => Number(match.token.split(" ")[0]) > routeFileLineLimit);
    const directUiImports = appRouteFiles()
      .flatMap(runtimeUiImports)
      .filter((match) => !allowedUiRouteFiles.has(match.file));

    expect(oversizedRouteFiles).toEqual([]);
    expect(directUiImports).toEqual([]);
  });

  it("keeps a complete root error boundary", () => {
    const globalError = readFileSync(join(srcDir, "app/global-error.tsx"), "utf8");

    expect(globalError).toContain('"use client"');
    expect(globalError).toContain("<html");
    expect(globalError).toContain("<body");
    expect(globalError).toContain("unstable_retry");
  });

  it("keeps search-param routes behind visible Suspense fallbacks", () => {
    const suspenseRoutes = [
      "app/pos/page.tsx",
      "app/home/page.tsx",
      "app/login/page.tsx",
      "app/(protected)/printers/form/page.tsx",
    ];

    const missingFallback = suspenseRoutes.filter((route) => (
      !readFileSync(join(srcDir, route), "utf8").includes("<Suspense fallback={")
    ));

    expect(missingFallback).toEqual([]);
  });

  it("keeps deprecated Next Image priority props out of source", () => {
    expect(matchesInFiles(srcDir, /\bpriority(?:\s*=|\s*>)/g)).toEqual([]);
  });

  it("keeps the staff order workflow behind store actions", () => {
    const workflow = readFileSync(
      join(srcDir, "features/pos/order-customer/use-order-customer-workflow.ts"),
      "utf8"
    );

    expect(workflow).not.toMatch(directOrderCustomerServiceImportPattern);
  });

  it("keeps media URL helpers imported from lib/image", () => {
    const allowedServiceReExports = new Set([
      "services/branch.ts",
      "services/product/requests.ts",
      "services/store.ts",
      "services/user.ts"
    ]);
    const disallowedImports = matchesInFiles(srcDir, serviceMediaHelperImportPattern)
      .filter((match) => !allowedServiceReExports.has(match.file));

    expect(disallowedImports).toEqual([]);
  });
});
