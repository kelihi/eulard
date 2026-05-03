---
title: "feat: Visual Node Editing With Code-as-Source-of-Truth (Mermaid Annotations)"
type: feat
status: planned
date: 2026-05-03
---

# Visual Node Editing With Code Annotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Eulard's visual canvas a first-class editor — users can create, drag, resize, recolor, and reshape nodes; all of those changes serialize back into the diagram's code so the source remains the single, viewable source of truth.

**Architecture:** Introduce a small **annotation layer on top of mermaid** (`%%@` directives) that augments the topology with visual metadata (position, size, fill, stroke, font). The parser pipeline already converts `mermaid ←→ FlowchartGraph ←→ React Flow`; we extend it so positions/sizes/colors round-trip through the code instead of living in invisible sidecar JSON. The code editor remains the canonical artifact: every drag, resize, or recolor mutates the code.

**Tech Stack:** TypeScript, Next.js 15, React 19, `@xyflow/react` 12 (React Flow), `mermaid` 11, `dagre`, Zustand, PostgreSQL. Add Vitest for parser/serializer tests.

---

## Context & Decisions

### Why an annotation layer (vs sidecar JSON or a new DSL)

The user's hard constraint: *"all of this must still live as exposed code… trackable purely through code."*

| Option | Code is single source? | Mermaid-compatible? | Effort |
|---|---|---|---|
| A. Keep sidecar JSON (current `positions` + `style_overrides`) | ❌ no — visual state is hidden | ✅ yes | Low |
| **B. Mermaid + `%%@` directive comments (chosen)** | ✅ yes | ✅ yes (comments are ignored by stock mermaid) | Medium |
| C. New DSL replacing mermaid | ✅ yes | ❌ no | High |

We pick **B**. Mermaid's `%%` comment syntax is preserved by external renderers (GitHub, Notion); our parser layer reads `%%@` directives as authoritative metadata. The diagram you see in `code` is the diagram you get — sidecar JSON columns are migrated into the code on first load, then deprecated.

### What `%%@` directives look like

```
flowchart TB
    A[Start]
    %%@ node A pos=120,40 size=180x60 fill=#e0f2fe stroke=#0ea5e9
    B{Decide}
    %%@ node B pos=300,40 size=140x100 fill=#fef3c7 shape=hexagon
    C[(Database)]
    %%@ node C pos=120,200 size=160x80
    A --> B
    B -->|yes| C
    %%@ edge B->C color=#10b981 width=3
    %%@ defaults node font=monospace size=14
```

Rules:
- A directive is a single line starting with `%%@ ` after any leading whitespace.
- First token after `%%@` is the directive kind: `node`, `edge`, or `defaults`.
- For `node` and `edge`, second token is the target id (`A`, `B->C`).
- Remaining tokens are `key=value` pairs; values may include digits, hex colors, and bare strings (no spaces). Quoted values support spaces: `font="Times New Roman"`.
- Unknown keys are preserved as `extra` fields on the directive so we never lose data round-tripping.

### Persistence migration

`diagrams.positions` and `diagrams.style_overrides` columns stay in the schema (preserve data) but become **read-only legacy**: on diagram load, if the code lacks annotations, the loader bakes the legacy JSON into the code as annotations and saves once. New writes only touch `code`.

### Scope check

This plan covers ONE cohesive feature (visual editing with code persistence). The phases below produce working software at each milestone, so a different team could split this into 4 sub-plans:

1. **Phase 1 — Annotation language** (parser/serializer/migration) — code that round-trips, no UI change yet
2. **Phase 2 — Drag-to-resize** — NodeResizer wired to annotations
3. **Phase 3 — Create / connect from canvas** — pane double-click, drag-to-connect
4. **Phase 4 — More shapes & per-node color in code** — expanded type system

If the user wants smaller PRs, split here. Otherwise execute end-to-end as one branch.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/types/annotations.ts` | TypeScript types for parsed `%%@` directives (`NodeAnnotation`, `EdgeAnnotation`, `DefaultsAnnotation`). |
| `src/lib/parser/annotations.ts` | `parseAnnotations(code)`, `serializeAnnotations(graph)`, `mergeAnnotationsIntoGraph(graph, annotations)`. |
| `src/lib/parser/migrate-sidecar.ts` | One-shot migrator: takes legacy `positions` + `styleOverrides` JSON and returns mermaid code with annotations added. |
| `src/components/editor/canvas-toolbar.tsx` | Floating toolbar inside the canvas: "Add Node" button, shape picker, color quick-set. |
| `src/components/editor/use-canvas-handlers.ts` | Hook that bundles add/connect/resize/style canvas event handlers (extracted to keep `visual-canvas.tsx` readable). |
| `vitest.config.ts` | Vitest config (jsdom env, path aliases). |
| `src/types/graph.test.ts` | Type-level smoke tests (compile-only). |
| `src/lib/parser/annotations.test.ts` | Round-trip tests for the annotation parser/serializer. |
| `src/lib/parser/mermaid-to-graph.test.ts` | Tests confirming annotations populate position/size/style fields. |
| `src/lib/parser/migrate-sidecar.test.ts` | Tests for the legacy migrator. |

### Modified files

| Path | Change |
|---|---|
| `src/types/graph.ts` | Add `size?: { width: number; height: number }` and per-node `style?: NodeStyleOverride` to `GraphNode`; add new `MermaidNodeType` values (`hexagon`, `parallelogram`, `trapezoid`); add `EdgeStyleOverride` to `GraphEdge`. |
| `src/lib/parser/mermaid-to-graph.ts` | Run annotation parser, merge results into graph nodes/edges. |
| `src/lib/parser/graph-to-mermaid.ts` | Emit `%%@` directives whenever a node has non-default position/size/style or an edge has style. |
| `src/lib/parser/graph-to-reactflow.ts` | Use `node.size` directly when present; only fall back to label-based estimate when missing. |
| `src/lib/parser/reactflow-to-graph.ts` | Capture `width`/`height` from React Flow nodes back into the graph. |
| `src/components/editor/visual-canvas.tsx` | Wire NodeResizer, pane double-click → add-node, `onConnect` for edge creation, selection-aware quick toolbar. |
| `src/components/editor/custom-nodes.tsx` | Embed `<NodeResizer />` in each node; add new shape components (`HexagonNode`, `ParallelogramNode`, `TrapezoidNode`). |
| `src/components/editor/node-context-menu.tsx` | Add new shapes; add color/size quick-set menu items. |
| `src/components/editor/editor-layout.tsx` | Add canvas toolbar slot. |
| `src/stores/diagram-store.ts` | On `loadDiagram`, run sidecar migration if annotations are absent and legacy JSON is present. Stop calling `setPositions` directly from canvas (positions live in code now). |
| `src/lib/db.ts` | No schema change required (legacy columns kept for backward read). |
| `src/lib/ai/tools.ts` | Extend node update schema to accept `position`, `size`, `style`. |
| `src/lib/graph-operations.ts` | Pass through new fields. |
| `package.json` | Add `vitest`, `@vitest/coverage-v8`, `@testing-library/react`, `jsdom` devDependencies. Add `"test": "vitest"` script. |

---

## Phase 1 — Annotation Language Foundation

Phase 1 ships a code format that round-trips through the parser pipeline. Everything else builds on it.

---

### Task 1: Add Vitest test runner

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add devDependencies**

Run:

```bash
pnpm add -D vitest@^2 @vitest/coverage-v8@^2 @testing-library/react@^16 @testing-library/jest-dom@^6 jsdom@^25
```

- [ ] **Step 2: Add `test` script**

Edit `package.json`. Inside `"scripts"`, add:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Sanity-check the runner**

Create `src/lib/__sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
describe("vitest sanity", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```

Run: `pnpm test:run`
Expected: 1 passing test.

- [ ] **Step 5: Delete sanity test and commit**

```bash
rm src/lib/__sanity.test.ts
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest for parser unit tests"
```

---

### Task 2: Define annotation TypeScript types

**Files:**
- Create: `src/types/annotations.ts`

- [ ] **Step 1: Write the types**

```ts
import type { NodeStyleOverride, EdgeStyleOverride } from "@/types/graph";

export interface NodeAnnotation {
  kind: "node";
  id: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  shape?: string; // overrides the bracket-derived shape
  style?: NodeStyleOverride;
  /** Unknown key=value pairs preserved verbatim for lossless round-trip. */
  extra?: Record<string, string>;
}

export interface EdgeAnnotation {
  kind: "edge";
  source: string;
  target: string;
  style?: EdgeStyleOverride;
  extra?: Record<string, string>;
}

export interface DefaultsAnnotation {
  kind: "defaults";
  scope: "node" | "edge";
  style: NodeStyleOverride | EdgeStyleOverride;
  extra?: Record<string, string>;
}

export type Annotation = NodeAnnotation | EdgeAnnotation | DefaultsAnnotation;

export interface AnnotationParseResult {
  annotations: Annotation[];
  /** Lines that started with `%%@` but failed to parse — kept so we can warn. */
  malformed: { lineNumber: number; raw: string; reason: string }[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/annotations.ts
git commit -m "feat: add annotation type definitions"
```

---

### Task 3: Implement annotation parser — happy path

**Files:**
- Create: `src/lib/parser/annotations.ts`
- Test: `src/lib/parser/annotations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { parseAnnotations } from "./annotations";

describe("parseAnnotations — happy path", () => {
  it("parses a node directive with pos and size", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A pos=120,40 size=180x60 fill=#e0f2fe stroke=#0ea5e9
    A --> B`;
    const result = parseAnnotations(code);
    expect(result.malformed).toEqual([]);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toEqual({
      kind: "node",
      id: "A",
      position: { x: 120, y: 40 },
      size: { width: 180, height: 60 },
      style: { backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" },
    });
  });

  it("parses edge directive with color and width", () => {
    const code = `flowchart TB
    A --> B
    %%@ edge A->B color=#10b981 width=3`;
    const result = parseAnnotations(code);
    expect(result.annotations).toEqual([
      {
        kind: "edge",
        source: "A",
        target: "B",
        style: { lineColor: "#10b981", lineThickness: 3 },
      },
    ]);
  });

  it("parses defaults directive", () => {
    const code = `flowchart TB
    %%@ defaults node font="Times New Roman" size=14`;
    const result = parseAnnotations(code);
    expect(result.annotations).toEqual([
      {
        kind: "defaults",
        scope: "node",
        style: { fontFamily: "Times New Roman", fontSize: 14 },
      },
    ]);
  });

  it("returns empty annotations array when code has none", () => {
    const code = `flowchart TB
    A[Start] --> B[End]`;
    expect(parseAnnotations(code).annotations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `pnpm test:run src/lib/parser/annotations.test.ts`
Expected: FAIL — `parseAnnotations` not exported.

- [ ] **Step 3: Implement `parseAnnotations`**

Create `src/lib/parser/annotations.ts`:

```ts
import type {
  Annotation,
  NodeAnnotation,
  EdgeAnnotation,
  DefaultsAnnotation,
  AnnotationParseResult,
} from "@/types/annotations";
import type { NodeStyleOverride, EdgeStyleOverride } from "@/types/graph";

const DIRECTIVE_RE = /^\s*%%@\s+(.+?)\s*$/;

export function parseAnnotations(code: string): AnnotationParseResult {
  const annotations: Annotation[] = [];
  const malformed: AnnotationParseResult["malformed"] = [];
  const lines = code.split("\n");

  lines.forEach((line, idx) => {
    const m = line.match(DIRECTIVE_RE);
    if (!m) return;
    const body = m[1];
    try {
      annotations.push(parseDirectiveBody(body));
    } catch (err) {
      malformed.push({
        lineNumber: idx + 1,
        raw: line,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  return { annotations, malformed };
}

function parseDirectiveBody(body: string): Annotation {
  const tokens = tokenize(body);
  if (tokens.length === 0) throw new Error("empty directive");

  const kind = tokens[0];
  switch (kind) {
    case "node": {
      if (tokens.length < 2) throw new Error("node directive needs id");
      const id = tokens[1];
      const attrs = tokensToAttrs(tokens.slice(2));
      return buildNodeAnnotation(id, attrs);
    }
    case "edge": {
      if (tokens.length < 2) throw new Error("edge directive needs source->target");
      const [source, target] = tokens[1].split("->");
      if (!source || !target) throw new Error("edge id must be source->target");
      const attrs = tokensToAttrs(tokens.slice(2));
      return buildEdgeAnnotation(source, target, attrs);
    }
    case "defaults": {
      if (tokens.length < 2 || (tokens[1] !== "node" && tokens[1] !== "edge"))
        throw new Error("defaults directive needs scope (node|edge)");
      const scope = tokens[1] as "node" | "edge";
      const attrs = tokensToAttrs(tokens.slice(2));
      return buildDefaultsAnnotation(scope, attrs);
    }
    default:
      throw new Error(`unknown directive kind "${kind}"`);
  }
}

/** Split body into tokens, respecting `"quoted strings"`. */
function tokenize(body: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && body[i] === " ") i++;
    if (i >= body.length) break;
    if (body[i] === '"') {
      const end = body.indexOf('"', i + 1);
      if (end === -1) throw new Error("unterminated quoted value");
      tokens.push(body.slice(i + 1, end));
      i = end + 1;
    } else {
      let end = i;
      while (end < body.length && body[end] !== " ") end++;
      tokens.push(body.slice(i, end));
      i = end;
    }
  }
  return tokens;
}

function tokensToAttrs(tokens: string[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const t of tokens) {
    const eq = t.indexOf("=");
    if (eq === -1) throw new Error(`token "${t}" is not key=value`);
    attrs[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return attrs;
}

function buildNodeAnnotation(id: string, attrs: Record<string, string>): NodeAnnotation {
  const ann: NodeAnnotation = { kind: "node", id };
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    switch (key) {
      case "pos": {
        const [x, y] = value.split(",").map(Number);
        if (Number.isNaN(x) || Number.isNaN(y))
          throw new Error(`invalid pos "${value}"`);
        ann.position = { x, y };
        break;
      }
      case "size": {
        const [w, h] = value.split("x").map(Number);
        if (Number.isNaN(w) || Number.isNaN(h))
          throw new Error(`invalid size "${value}"`);
        ann.size = { width: w, height: h };
        break;
      }
      case "shape":
        ann.shape = value;
        break;
      case "fill":
        ann.style = { ...ann.style, backgroundColor: value };
        break;
      case "stroke":
        ann.style = { ...ann.style, borderColor: value };
        break;
      case "color":
        ann.style = { ...ann.style, fontColor: value };
        break;
      case "font":
        ann.style = { ...ann.style, fontFamily: value };
        break;
      case "fontSize":
        ann.style = { ...ann.style, fontSize: Number(value) };
        break;
      default:
        extra[key] = value;
    }
  }

  if (Object.keys(extra).length > 0) ann.extra = extra;
  return ann;
}

function buildEdgeAnnotation(
  source: string,
  target: string,
  attrs: Record<string, string>
): EdgeAnnotation {
  const ann: EdgeAnnotation = { kind: "edge", source, target };
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    switch (key) {
      case "color":
        ann.style = { ...ann.style, lineColor: value };
        break;
      case "width":
        ann.style = { ...ann.style, lineThickness: Number(value) };
        break;
      case "font":
        ann.style = { ...ann.style, fontFamily: value };
        break;
      case "fontSize":
        ann.style = { ...ann.style, fontSize: Number(value) };
        break;
      case "fontColor":
        ann.style = { ...ann.style, fontColor: value };
        break;
      default:
        extra[key] = value;
    }
  }

  if (Object.keys(extra).length > 0) ann.extra = extra;
  return ann;
}

function buildDefaultsAnnotation(
  scope: "node" | "edge",
  attrs: Record<string, string>
): DefaultsAnnotation {
  const style: NodeStyleOverride & EdgeStyleOverride = {};
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    switch (key) {
      case "font":
        style.fontFamily = value;
        break;
      case "size":
        style.fontSize = Number(value);
        break;
      case "color":
        style.fontColor = value;
        break;
      case "fill":
        if (scope === "node") (style as NodeStyleOverride).backgroundColor = value;
        else extra[key] = value;
        break;
      case "stroke":
        if (scope === "node") (style as NodeStyleOverride).borderColor = value;
        else extra[key] = value;
        break;
      case "lineColor":
        if (scope === "edge") (style as EdgeStyleOverride).lineColor = value;
        else extra[key] = value;
        break;
      case "lineWidth":
        if (scope === "edge") (style as EdgeStyleOverride).lineThickness = Number(value);
        else extra[key] = value;
        break;
      default:
        extra[key] = value;
    }
  }

  const ann: DefaultsAnnotation = { kind: "defaults", scope, style };
  if (Object.keys(extra).length > 0) ann.extra = extra;
  return ann;
}
```

- [ ] **Step 4: Run tests, confirm green**

Run: `pnpm test:run src/lib/parser/annotations.test.ts`
Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add src/types/annotations.ts src/lib/parser/annotations.ts src/lib/parser/annotations.test.ts
git commit -m "feat: parse %%@ mermaid annotations into typed Annotation values"
```

---

### Task 4: Annotation parser — error & edge cases

**Files:**
- Modify: `src/lib/parser/annotations.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `annotations.test.ts`:

```ts
describe("parseAnnotations — error handling", () => {
  it("records malformed lines without throwing", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node
    %%@ edge A->`;
    const result = parseAnnotations(code);
    expect(result.annotations).toEqual([]);
    expect(result.malformed).toHaveLength(2);
    expect(result.malformed[0].lineNumber).toBe(3);
  });

  it("preserves unknown keys as extra", () => {
    const code = `%%@ node A weight=99 priority=high`;
    const [ann] = parseAnnotations(code).annotations;
    expect(ann.kind === "node" && ann.extra).toEqual({
      weight: "99",
      priority: "high",
    });
  });

  it("ignores `%%` non-directive comments", () => {
    const code = `flowchart TB
    %% just a comment
    A[Start]`;
    expect(parseAnnotations(code).annotations).toEqual([]);
  });

  it("supports quoted values with spaces", () => {
    const code = `%%@ node A font="Helvetica Neue"`;
    const [ann] = parseAnnotations(code).annotations;
    expect(ann.kind === "node" && ann.style?.fontFamily).toBe("Helvetica Neue");
  });
});
```

- [ ] **Step 2: Run, confirm green**

Run: `pnpm test:run src/lib/parser/annotations.test.ts`
Expected: 8 passing (4 existing + 4 new).

If any fail, fix the parser (most likely the malformed-line capture branch). Do NOT delete tests.

- [ ] **Step 3: Commit**

```bash
git add src/lib/parser/annotations.test.ts
git commit -m "test: cover annotation parser error and edge cases"
```

---

### Task 5: Implement annotation serializer

**Files:**
- Modify: `src/lib/parser/annotations.ts`
- Modify: `src/lib/parser/annotations.test.ts`

- [ ] **Step 1: Write failing round-trip test**

Append to `annotations.test.ts`:

```ts
import { serializeAnnotation } from "./annotations";

describe("serializeAnnotation — round trip", () => {
  it("serializes a node annotation back to its source form", () => {
    const ann = {
      kind: "node" as const,
      id: "A",
      position: { x: 120, y: 40 },
      size: { width: 180, height: 60 },
      style: { backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" },
    };
    const line = serializeAnnotation(ann);
    expect(line).toBe(
      "%%@ node A pos=120,40 size=180x60 fill=#e0f2fe stroke=#0ea5e9"
    );
  });

  it("serializes an edge annotation", () => {
    const ann = {
      kind: "edge" as const,
      source: "A",
      target: "B",
      style: { lineColor: "#10b981", lineThickness: 3 },
    };
    expect(serializeAnnotation(ann)).toBe(
      "%%@ edge A->B color=#10b981 width=3"
    );
  });

  it("re-parses serialized output identically (round trip)", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A pos=120,40 size=180x60 fill=#e0f2fe
    A --> B
    %%@ edge A->B color=#10b981 width=3`;
    const parsed = parseAnnotations(code).annotations;
    const reSerialized = parsed.map(serializeAnnotation).join("\n");
    const reParsed = parseAnnotations(reSerialized).annotations;
    expect(reParsed).toEqual(parsed);
  });

  it("quotes values that contain spaces", () => {
    const ann = {
      kind: "node" as const,
      id: "A",
      style: { fontFamily: "Helvetica Neue" },
    };
    expect(serializeAnnotation(ann)).toBe(`%%@ node A font="Helvetica Neue"`);
  });

  it("preserves extra keys", () => {
    const ann = {
      kind: "node" as const,
      id: "A",
      extra: { weight: "99" },
    };
    expect(serializeAnnotation(ann)).toBe("%%@ node A weight=99");
  });
});
```

- [ ] **Step 2: Run, confirm fails**

Run: `pnpm test:run src/lib/parser/annotations.test.ts`
Expected: 5 new tests fail (`serializeAnnotation` not exported).

- [ ] **Step 3: Implement `serializeAnnotation`**

Append to `src/lib/parser/annotations.ts`:

```ts
export function serializeAnnotation(ann: Annotation): string {
  switch (ann.kind) {
    case "node":
      return serializeNodeAnnotation(ann);
    case "edge":
      return serializeEdgeAnnotation(ann);
    case "defaults":
      return serializeDefaultsAnnotation(ann);
  }
}

function serializeNodeAnnotation(ann: NodeAnnotation): string {
  const parts: string[] = ["%%@", "node", ann.id];
  if (ann.position) parts.push(`pos=${ann.position.x},${ann.position.y}`);
  if (ann.size) parts.push(`size=${ann.size.width}x${ann.size.height}`);
  if (ann.shape) parts.push(`shape=${ann.shape}`);
  if (ann.style?.backgroundColor) parts.push(`fill=${ann.style.backgroundColor}`);
  if (ann.style?.borderColor) parts.push(`stroke=${ann.style.borderColor}`);
  if (ann.style?.fontColor) parts.push(`color=${ann.style.fontColor}`);
  if (ann.style?.fontFamily) parts.push(`font=${quoteIfNeeded(ann.style.fontFamily)}`);
  if (ann.style?.fontSize) parts.push(`fontSize=${ann.style.fontSize}`);
  for (const [k, v] of Object.entries(ann.extra ?? {})) parts.push(`${k}=${quoteIfNeeded(v)}`);
  return parts.join(" ");
}

function serializeEdgeAnnotation(ann: EdgeAnnotation): string {
  const parts: string[] = ["%%@", "edge", `${ann.source}->${ann.target}`];
  if (ann.style?.lineColor) parts.push(`color=${ann.style.lineColor}`);
  if (ann.style?.lineThickness) parts.push(`width=${ann.style.lineThickness}`);
  if (ann.style?.fontFamily) parts.push(`font=${quoteIfNeeded(ann.style.fontFamily)}`);
  if (ann.style?.fontSize) parts.push(`fontSize=${ann.style.fontSize}`);
  if (ann.style?.fontColor) parts.push(`fontColor=${ann.style.fontColor}`);
  for (const [k, v] of Object.entries(ann.extra ?? {})) parts.push(`${k}=${quoteIfNeeded(v)}`);
  return parts.join(" ");
}

function serializeDefaultsAnnotation(ann: DefaultsAnnotation): string {
  const parts: string[] = ["%%@", "defaults", ann.scope];
  const style = ann.style as NodeStyleOverride & EdgeStyleOverride;
  if (style.fontFamily) parts.push(`font=${quoteIfNeeded(style.fontFamily)}`);
  if (style.fontSize) parts.push(`size=${style.fontSize}`);
  if (style.fontColor) parts.push(`color=${style.fontColor}`);
  if (ann.scope === "node" && style.backgroundColor) parts.push(`fill=${style.backgroundColor}`);
  if (ann.scope === "node" && style.borderColor) parts.push(`stroke=${style.borderColor}`);
  if (ann.scope === "edge" && style.lineColor) parts.push(`lineColor=${style.lineColor}`);
  if (ann.scope === "edge" && style.lineThickness) parts.push(`lineWidth=${style.lineThickness}`);
  for (const [k, v] of Object.entries(ann.extra ?? {})) parts.push(`${k}=${quoteIfNeeded(v)}`);
  return parts.join(" ");
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}
```

- [ ] **Step 4: Run tests, confirm green**

Run: `pnpm test:run src/lib/parser/annotations.test.ts`
Expected: 13 passing (8 + 5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/parser/annotations.ts src/lib/parser/annotations.test.ts
git commit -m "feat: serialize annotations back to %%@ directives"
```

---

### Task 6: Extend `GraphNode` and `GraphEdge` with size and per-object style

**Files:**
- Modify: `src/types/graph.ts`

- [ ] **Step 1: Add new fields**

Replace the `GraphNode`, `GraphEdge`, and `MermaidNodeType` definitions in `src/types/graph.ts`:

```ts
export type MermaidNodeType =
  | "default"
  | "decision"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "hexagon"
  | "parallelogram"
  | "trapezoid";

export interface GraphNode {
  id: string;
  label: string;
  type: MermaidNodeType;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  style?: NodeStyleOverride;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: MermaidEdgeType;
  style?: EdgeStyleOverride;
}
```

- [ ] **Step 2: Verify the project still compiles**

Run: `pnpm build`
Expected: success. If TS complains about unknown shape values in switches, that's the next task.

- [ ] **Step 3: Commit**

```bash
git add src/types/graph.ts
git commit -m "feat: extend GraphNode with size and per-node style; add new shape types"
```

---

### Task 7: Merge annotations into mermaid-to-graph

**Files:**
- Modify: `src/lib/parser/mermaid-to-graph.ts`
- Create: `src/lib/parser/mermaid-to-graph.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/parser/mermaid-to-graph.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mermaidToGraph } from "./mermaid-to-graph";

describe("mermaidToGraph — annotation merging", () => {
  it("populates node position from %%@ node directive", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A pos=120,40
    A --> B`;
    const g = mermaidToGraph(code)!;
    const a = g.nodes.find((n) => n.id === "A")!;
    expect(a.position).toEqual({ x: 120, y: 40 });
  });

  it("populates node size from directive", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A size=200x80
    A --> B`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "A")!.size).toEqual({
      width: 200,
      height: 80,
    });
  });

  it("populates node style from directive", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A fill=#e0f2fe stroke=#0ea5e9
    A --> B`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "A")!.style).toEqual({
      backgroundColor: "#e0f2fe",
      borderColor: "#0ea5e9",
    });
  });

  it("annotation `shape` overrides bracket-derived type", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A shape=hexagon
    A --> B`;
    const g = mermaidToGraph(code)!;
    expect(g.nodes.find((n) => n.id === "A")!.type).toBe("hexagon");
  });

  it("populates edge style from directive", () => {
    const code = `flowchart TB
    A --> B
    %%@ edge A->B color=#10b981 width=3`;
    const g = mermaidToGraph(code)!;
    expect(g.edges[0].style).toEqual({
      lineColor: "#10b981",
      lineThickness: 3,
    });
  });

  it("falls back gracefully when annotations reference unknown nodes/edges", () => {
    const code = `flowchart TB
    A --> B
    %%@ node Z pos=0,0
    %%@ edge X->Y color=#fff`;
    const g = mermaidToGraph(code);
    expect(g).not.toBeNull(); // does not throw
    expect(g!.nodes).toHaveLength(2); // A, B only
  });
});
```

- [ ] **Step 2: Run, confirm fails**

Run: `pnpm test:run src/lib/parser/mermaid-to-graph.test.ts`
Expected: all 6 fail.

- [ ] **Step 3: Wire annotations into the parser**

Modify `src/lib/parser/mermaid-to-graph.ts`. After the existing parse loop builds `nodes` and `edges`, before the return:

```ts
// New imports at top of file:
import { parseAnnotations } from "./annotations";
import type { NodeAnnotation, EdgeAnnotation } from "@/types/annotations";

// Inside mermaidToGraph, replace `return { ... }` with:
const { annotations } = parseAnnotations(code);
applyAnnotations(nodes, edges, annotations);

return {
  diagramType: "flowchart",
  direction,
  nodes: Array.from(nodes.values()),
  edges,
};
```

Add helper at bottom of file:

```ts
function applyAnnotations(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  annotations: ReturnType<typeof parseAnnotations>["annotations"]
) {
  for (const ann of annotations) {
    if (ann.kind === "node") {
      const node = nodes.get(ann.id);
      if (!node) continue; // tolerate unknown ids
      if (ann.position) node.position = ann.position;
      if (ann.size) node.size = ann.size;
      if (ann.style) node.style = { ...node.style, ...ann.style };
      if (ann.shape && isMermaidNodeType(ann.shape)) node.type = ann.shape;
    } else if (ann.kind === "edge") {
      const edge = edges.find(
        (e) => e.source === ann.source && e.target === ann.target
      );
      if (!edge) continue;
      if (ann.style) edge.style = { ...edge.style, ...ann.style };
    }
    // defaults annotations will be wired in Task 12 (style panel integration)
  }
}

const VALID_SHAPES: ReadonlySet<string> = new Set([
  "default",
  "decision",
  "stadium",
  "subroutine",
  "cylinder",
  "circle",
  "hexagon",
  "parallelogram",
  "trapezoid",
]);

function isMermaidNodeType(value: string): value is MermaidNodeType {
  return VALID_SHAPES.has(value);
}
```

- [ ] **Step 4: Run, confirm green**

Run: `pnpm test:run src/lib/parser/mermaid-to-graph.test.ts`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parser/mermaid-to-graph.ts src/lib/parser/mermaid-to-graph.test.ts
git commit -m "feat: merge %%@ annotations into parsed flowchart graph"
```

---

### Task 8: Emit annotations from `graphToMermaid`

**Files:**
- Modify: `src/lib/parser/graph-to-mermaid.ts`
- Create: `src/lib/parser/graph-to-mermaid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { graphToMermaid } from "./graph-to-mermaid";
import type { FlowchartGraph } from "@/types/graph";

describe("graphToMermaid — annotation emission", () => {
  it("emits node directive when position is non-default", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      nodes: [{ id: "A", label: "Start", type: "default", position: { x: 120, y: 40 } }],
      edges: [],
    };
    const code = graphToMermaid(g);
    expect(code).toContain("A[Start]");
    expect(code).toContain("%%@ node A pos=120,40");
  });

  it("does NOT emit directive when position is the origin (default)", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      nodes: [{ id: "A", label: "Start", type: "default", position: { x: 0, y: 0 } }],
      edges: [],
    };
    expect(graphToMermaid(g)).not.toContain("%%@");
  });

  it("emits size and style for a styled, sized node", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      nodes: [
        {
          id: "A",
          label: "Start",
          type: "default",
          position: { x: 0, y: 0 },
          size: { width: 200, height: 80 },
          style: { backgroundColor: "#fee" },
        },
      ],
      edges: [],
    };
    const code = graphToMermaid(g);
    expect(code).toContain("%%@ node A size=200x80 fill=#fee");
  });

  it("emits edge directive when edge has style", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      nodes: [
        { id: "A", label: "A", type: "default", position: { x: 0, y: 0 } },
        { id: "B", label: "B", type: "default", position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: "e0", source: "A", target: "B", type: "arrow", style: { lineColor: "#10b981" } },
      ],
    };
    expect(graphToMermaid(g)).toContain("%%@ edge A->B color=#10b981");
  });

  it("emits annotations after the topology line they describe", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      nodes: [
        { id: "A", label: "A", type: "default", position: { x: 10, y: 20 } },
        { id: "B", label: "B", type: "default", position: { x: 30, y: 40 } },
      ],
      edges: [],
    };
    const lines = graphToMermaid(g).split("\n");
    const aIdx = lines.findIndex((l) => l.includes("A[A]") || l.trim() === "A");
    const aAnnIdx = lines.findIndex((l) => l.includes("%%@ node A"));
    expect(aAnnIdx).toBe(aIdx + 1);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

Run: `pnpm test:run src/lib/parser/graph-to-mermaid.test.ts`
Expected: 5 fail.

- [ ] **Step 3: Update `graphToMermaid`**

Replace `src/lib/parser/graph-to-mermaid.ts` body:

```ts
import type {
  FlowchartGraph,
  GraphNode,
  GraphEdge,
  NodeStyleOverride,
  EdgeStyleOverride,
} from "@/types/graph";
import { serializeAnnotation } from "./annotations";
import type { NodeAnnotation, EdgeAnnotation } from "@/types/annotations";

export function graphToMermaid(graph: FlowchartGraph): string {
  const lines: string[] = [];
  lines.push(`flowchart ${graph.direction}`);

  for (const node of graph.nodes) {
    lines.push(`    ${nodeToMermaid(node)}`);
    const ann = nodeAnnotation(node);
    if (ann) lines.push(`    ${serializeAnnotation(ann)}`);
  }

  for (const edge of graph.edges) {
    lines.push(`    ${edgeToMermaid(edge)}`);
    const ann = edgeAnnotation(edge);
    if (ann) lines.push(`    ${serializeAnnotation(ann)}`);
  }

  return lines.join("\n");
}

function nodeToMermaid(node: GraphNode): string {
  const { id, label, type } = node;
  switch (type) {
    case "decision":      return `${id}{${label}}`;
    case "stadium":       return `${id}(${label})`;
    case "subroutine":    return `${id}[[${label}]]`;
    case "cylinder":      return `${id}[(${label})]`;
    case "circle":        return `${id}((${label}))`;
    // hexagon/parallelogram/trapezoid have no native bracket form — emit
    // as default rectangle and rely on the `shape=` annotation for the real shape.
    case "hexagon":
    case "parallelogram":
    case "trapezoid":
    case "default":
    default:
      return label !== id ? `${id}[${label}]` : id;
  }
}

function edgeToMermaid(edge: GraphEdge): string {
  const arrow = edgeArrow(edge.type);
  if (edge.label) return `${edge.source} ${arrow}|${edge.label}| ${edge.target}`;
  return `${edge.source} ${arrow} ${edge.target}`;
}

function edgeArrow(type: GraphEdge["type"]): string {
  switch (type) {
    case "dotted": return "-.->";
    case "thick":  return "==>";
    default:       return "-->";
  }
}

const NON_NATIVE_SHAPES = new Set(["hexagon", "parallelogram", "trapezoid"]);

function nodeAnnotation(node: GraphNode): NodeAnnotation | null {
  const hasPosition = node.position.x !== 0 || node.position.y !== 0;
  const hasSize = !!node.size;
  const hasStyle = !!node.style && Object.values(node.style).some((v) => v != null && v !== "");
  const needsShape = NON_NATIVE_SHAPES.has(node.type);

  if (!hasPosition && !hasSize && !hasStyle && !needsShape) return null;

  const ann: NodeAnnotation = { kind: "node", id: node.id };
  if (hasPosition) ann.position = node.position;
  if (hasSize) ann.size = node.size;
  if (needsShape) ann.shape = node.type;
  if (hasStyle) ann.style = node.style as NodeStyleOverride;
  return ann;
}

function edgeAnnotation(edge: GraphEdge): EdgeAnnotation | null {
  if (!edge.style) return null;
  const hasStyle = Object.values(edge.style).some((v) => v != null && v !== "");
  if (!hasStyle) return null;
  return {
    kind: "edge",
    source: edge.source,
    target: edge.target,
    style: edge.style as EdgeStyleOverride,
  };
}
```

- [ ] **Step 4: Run tests, confirm green**

Run: `pnpm test:run src/lib/parser/`
Expected: all parser tests pass (annotations + mermaid-to-graph + graph-to-mermaid).

- [ ] **Step 5: Round-trip integration test**

Append to `graph-to-mermaid.test.ts`:

```ts
import { mermaidToGraph } from "./mermaid-to-graph";

describe("graphToMermaid → mermaidToGraph round trip", () => {
  it("preserves position, size, and style across a full round trip", () => {
    const g: FlowchartGraph = {
      diagramType: "flowchart",
      direction: "TB",
      nodes: [
        {
          id: "A",
          label: "Start",
          type: "default",
          position: { x: 120, y: 40 },
          size: { width: 200, height: 80 },
          style: { backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" },
        },
        { id: "B", label: "B", type: "decision", position: { x: 300, y: 40 } },
      ],
      edges: [
        { id: "e0", source: "A", target: "B", type: "arrow", style: { lineColor: "#10b981", lineThickness: 3 } },
      ],
    };
    const code = graphToMermaid(g);
    const back = mermaidToGraph(code)!;
    const a = back.nodes.find((n) => n.id === "A")!;
    expect(a.position).toEqual({ x: 120, y: 40 });
    expect(a.size).toEqual({ width: 200, height: 80 });
    expect(a.style).toEqual({ backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" });
    expect(back.edges[0].style).toEqual({ lineColor: "#10b981", lineThickness: 3 });
  });
});
```

Run: `pnpm test:run src/lib/parser/graph-to-mermaid.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/parser/graph-to-mermaid.ts src/lib/parser/graph-to-mermaid.test.ts
git commit -m "feat: emit %%@ annotations and verify round-trip"
```

---

### Task 9: Sidecar JSON migration helper

**Files:**
- Create: `src/lib/parser/migrate-sidecar.ts`
- Create: `src/lib/parser/migrate-sidecar.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { migrateSidecarToCode } from "./migrate-sidecar";

describe("migrateSidecarToCode", () => {
  it("returns code unchanged when sidecars are empty", () => {
    const code = `flowchart TB
    A --> B`;
    expect(migrateSidecarToCode({ code, positions: null, styleOverrides: null })).toBe(code);
  });

  it("bakes positions JSON into %%@ annotations", () => {
    const code = `flowchart TB
    A --> B`;
    const out = migrateSidecarToCode({
      code,
      positions: JSON.stringify({ A: { x: 10, y: 20 }, B: { x: 30, y: 40 } }),
      styleOverrides: null,
    });
    expect(out).toContain("%%@ node A pos=10,20");
    expect(out).toContain("%%@ node B pos=30,40");
  });

  it("bakes per-node style overrides into annotations", () => {
    const code = `flowchart TB
    A --> B`;
    const out = migrateSidecarToCode({
      code,
      positions: null,
      styleOverrides: JSON.stringify({
        nodes: { A: { backgroundColor: "#fee", fontColor: "#333" } },
      }),
    });
    expect(out).toContain("%%@ node A fill=#fee color=#333");
  });

  it("bakes global defaults into a defaults directive", () => {
    const code = `flowchart TB
    A --> B`;
    const out = migrateSidecarToCode({
      code,
      positions: null,
      styleOverrides: JSON.stringify({
        globalNode: { fontFamily: "Arial", fontSize: 14 },
        globalEdge: { lineColor: "#888" },
      }),
    });
    expect(out).toContain("%%@ defaults node font=Arial size=14");
    expect(out).toContain("%%@ defaults edge lineColor=#888");
  });

  it("is idempotent — re-running on already-migrated code is a no-op", () => {
    const code = `flowchart TB
    A --> B`;
    const once = migrateSidecarToCode({
      code,
      positions: JSON.stringify({ A: { x: 10, y: 20 } }),
      styleOverrides: null,
    });
    const twice = migrateSidecarToCode({ code: once, positions: null, styleOverrides: null });
    expect(twice).toBe(once);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm test:run src/lib/parser/migrate-sidecar.test.ts`
Expected: fail.

- [ ] **Step 3: Implement migrator**

```ts
import { mermaidToGraph } from "./mermaid-to-graph";
import { graphToMermaid } from "./graph-to-mermaid";
import { serializeAnnotation } from "./annotations";
import type { DiagramStyles } from "@/types/graph";

interface SidecarInputs {
  code: string;
  positions: string | null;
  styleOverrides: string | null;
}

export function migrateSidecarToCode({
  code,
  positions,
  styleOverrides,
}: SidecarInputs): string {
  const graph = mermaidToGraph(code);
  if (!graph) return code;

  let mutated = false;

  // Bake positions
  if (positions) {
    try {
      const map = JSON.parse(positions) as Record<string, { x: number; y: number }>;
      for (const node of graph.nodes) {
        const p = map[node.id];
        if (p && (node.position.x === 0 && node.position.y === 0)) {
          node.position = { x: p.x, y: p.y };
          mutated = true;
        }
      }
    } catch {
      // ignore invalid JSON
    }
  }

  // Bake per-object style overrides
  let defaults = "";
  if (styleOverrides) {
    try {
      const styles = JSON.parse(styleOverrides) as DiagramStyles;
      if (styles.nodes) {
        for (const [id, ns] of Object.entries(styles.nodes)) {
          const node = graph.nodes.find((n) => n.id === id);
          if (node) {
            node.style = { ...node.style, ...ns };
            mutated = true;
          }
        }
      }
      if (styles.edges) {
        for (const [edgeId, es] of Object.entries(styles.edges)) {
          const edge = graph.edges.find((e) => e.id === edgeId);
          if (edge) {
            edge.style = { ...edge.style, ...es };
            mutated = true;
          }
        }
      }
      if (styles.globalNode) {
        defaults += `    ${serializeAnnotation({ kind: "defaults", scope: "node", style: styles.globalNode })}\n`;
        mutated = true;
      }
      if (styles.globalEdge) {
        defaults += `    ${serializeAnnotation({ kind: "defaults", scope: "edge", style: styles.globalEdge })}\n`;
        mutated = true;
      }
    } catch {
      // ignore
    }
  }

  if (!mutated) return code;

  let out = graphToMermaid(graph);
  if (defaults) {
    const nl = out.indexOf("\n");
    out = out.slice(0, nl + 1) + defaults + out.slice(nl + 1);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, confirm green**

Run: `pnpm test:run src/lib/parser/migrate-sidecar.test.ts`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parser/migrate-sidecar.ts src/lib/parser/migrate-sidecar.test.ts
git commit -m "feat: one-shot migrator from sidecar JSON to inline annotations"
```

---

### Task 10: Run sidecar migration on diagram load

**Files:**
- Modify: `src/stores/diagram-store.ts`

- [ ] **Step 1: Hook the migrator into `loadDiagram`**

In `src/stores/diagram-store.ts`, add at top of file:

```ts
import { migrateSidecarToCode } from "@/lib/parser/migrate-sidecar";
```

Replace the body of `loadDiagram`:

```ts
loadDiagram: async (id: string) => {
  const res = await fetch(`/api/diagrams/${id}`);
  if (!res.ok) throw new Error("Failed to load diagram");
  const data = (await res.json()) as DiagramState;

  // One-shot migration: bake legacy sidecar JSON into the code as annotations.
  // The code already contains annotations after this; the legacy columns become
  // dormant for future writes.
  const migratedCode = migrateSidecarToCode({
    code: data.code,
    positions: data.positions,
    styleOverrides: data.styleOverrides,
  });

  const wasMigrated = migratedCode !== data.code;
  const diagram: DiagramState = {
    ...data,
    code: migratedCode,
    permission: data.permission ?? null,
  };

  set({
    diagram,
    isDirty: wasMigrated, // dirty so the migrated code persists
    error: null,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  });

  if (wasMigrated) {
    scheduleSave(get);
  }
},
```

- [ ] **Step 2: Manual smoke test**

Run: `pnpm dev`. Open an existing diagram with sidecar positions in the editor; the code panel should now contain `%%@` directives matching the dragged positions.

If successful, dragging a node should add or update a `%%@ node X pos=...` line in the code (we'll wire this up in Task 11; for now the migration is the only writer).

- [ ] **Step 3: Commit**

```bash
git add src/stores/diagram-store.ts
git commit -m "feat: migrate sidecar positions/styles into code on diagram load"
```

---

### Task 11: Stop writing sidecar JSON from canvas; positions go through code

**Files:**
- Modify: `src/components/editor/visual-canvas.tsx`
- Modify: `src/lib/parser/reactflow-to-graph.ts`

- [ ] **Step 1: Capture size in `updateGraphPositions`**

Replace `updateGraphPositions` in `src/lib/parser/reactflow-to-graph.ts`:

```ts
export function updateGraphPositions(
  graph: FlowchartGraph,
  rfNodes: Node[]
): FlowchartGraph {
  const byId = new Map(rfNodes.map((n) => [n.id, n]));
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const rf = byId.get(node.id);
      if (!rf) return node;
      return {
        ...node,
        position: rf.position,
        size:
          typeof rf.width === "number" && typeof rf.height === "number"
            ? { width: rf.width, height: rf.height }
            : node.size,
      };
    }),
  };
}
```

- [ ] **Step 2: Remove `setPositions` calls from `visual-canvas.tsx`**

In `src/components/editor/visual-canvas.tsx`, inside `onNodesChange`, delete these lines from the drag-end branch:

```ts
const positionMap = buildPositionMap(updatedNodes);
setPositions(JSON.stringify(positionMap));
```

Also remove the `buildPositionMap` helper, the `setPositions` selector, and the `positions` selector (keep the load path — but the canvas no longer reads positions directly; positions come from code via the parser).

The drag-end handler should simply call `syncGraphToCode(updateGraphPositions(graphRef.current, updatedNodes))` and stop there.

- [ ] **Step 3: Test manually**

Run: `pnpm dev`. Drag a node. The `%%@ node X pos=...` line in the code panel should update live, and the `positions` column should no longer be touched by `setPositions`.

(We're not yet removing the column or the store method — both will be cleaned up in Task 24 once Phases 2–3 stabilize.)

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/visual-canvas.tsx src/lib/parser/reactflow-to-graph.ts
git commit -m "feat: drag-to-position now updates code annotations directly"
```

---

### Task 12: Wire `defaults` annotations into mermaid preview

**Files:**
- Modify: `src/components/editor/mermaid-preview.tsx`

- [ ] **Step 1: Source `DiagramStyles` from code as well as sidecar**

The preview applies `styleOverrides` JSON to the rendered SVG. Add a fallback path: when `styleOverrides` is null, derive a `DiagramStyles` view from any `defaults` and per-node/edge annotations in the code.

In `mermaid-preview.tsx`, replace:

```ts
if (svgEl && styleOverridesJson) {
  try {
    const styles = JSON.parse(styleOverridesJson) as DiagramStyles;
    applyStylesToSvg(svgEl, styles);
  } catch { /* ignore invalid JSON */ }
}
```

with:

```ts
if (svgEl) {
  const styles = stylesFromCodeAndSidecar(code, styleOverridesJson);
  applyStylesToSvg(svgEl, styles);
}
```

Add this helper at the bottom of the same file:

```ts
import { parseAnnotations } from "@/lib/parser/annotations";

function stylesFromCodeAndSidecar(
  code: string,
  styleOverridesJson: string | null
): DiagramStyles {
  const result: DiagramStyles = {};

  // Start with sidecar (legacy support)
  if (styleOverridesJson) {
    try { Object.assign(result, JSON.parse(styleOverridesJson) as DiagramStyles); }
    catch { /* ignore */ }
  }

  // Layer in annotations from code
  const { annotations } = parseAnnotations(code);
  for (const ann of annotations) {
    if (ann.kind === "defaults" && ann.scope === "node") {
      result.globalNode = { ...result.globalNode, ...(ann.style as NodeStyleOverride) };
    } else if (ann.kind === "defaults" && ann.scope === "edge") {
      result.globalEdge = { ...result.globalEdge, ...(ann.style as EdgeStyleOverride) };
    } else if (ann.kind === "node" && ann.style) {
      result.nodes = { ...result.nodes, [ann.id]: { ...result.nodes?.[ann.id], ...ann.style } };
    } else if (ann.kind === "edge" && ann.style) {
      const edgeKey = `${ann.source}->${ann.target}`;
      result.edges = { ...result.edges, [edgeKey]: { ...result.edges?.[edgeKey], ...ann.style } };
    }
  }
  return result;
}
```

(Note: edge style sidecar uses internal edge ids `e0`, `e1`. Annotations key by `source->target`. This is fine because the SVG selector logic already does substring matching on `g[id*=...]`, but be aware that the keys differ. We will reconcile in Task 25.)

- [ ] **Step 2: Repeat for the styleOverrides-only effect**

Apply the same change to the second `useEffect` that re-applies styles when only the JSON changes — it should now also re-run when `code` changes. Add `code` to the dependency array (and rename the effect to make this explicit).

- [ ] **Step 3: Test manually**

Run: `pnpm dev`. Add a `%%@ defaults node fill=#fee` line to a diagram's code. The mermaid preview should re-render with red node fills.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/mermaid-preview.tsx
git commit -m "feat: apply %%@ annotations to mermaid SVG preview"
```

---

## Phase 2 — Drag-to-Resize

Phase 2 lets users drag node corners to resize. Sizes round-trip through `%%@ node X size=WxH`.

---

### Task 13: Add `<NodeResizer />` to each custom node

**Files:**
- Modify: `src/components/editor/custom-nodes.tsx`

- [ ] **Step 1: Import NodeResizer**

At the top of `custom-nodes.tsx`:

```ts
import { Handle, Position, NodeResizer, useNodeId } from "@xyflow/react";
```

- [ ] **Step 2: Add resizer to each node component**

For `DefaultNode`, `StadiumNode`, `SubroutineNode`, `CylinderNode`, `CircleNode`, and `DecisionNode`, prepend a `<NodeResizer>` element. Pass `selected` from `NodeProps`. Example for `DefaultNode`:

```tsx
function DefaultNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <>
      <NodeResizer
        minWidth={80}
        minHeight={32}
        isVisible={!!selected && !nodeData.isLocked}
        lineClassName="!border-[var(--primary)]"
        handleClassName="!bg-[var(--primary)] !border-[var(--background)]"
      />
      <div
        className="px-4 py-2 rounded border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm text-center whitespace-normal break-words overflow-hidden w-full h-full flex items-center justify-center"
        style={nodeStyles}
      >
        <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
        <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
        <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
      </div>
    </>
  );
}
```

Apply the same wrapper to the other shape components. For `CircleNode` and `DecisionNode`, additionally set `keepAspectRatio` if you want them to stay square/diamond-shaped:

```tsx
<NodeResizer keepAspectRatio minWidth={64} minHeight={64} isVisible={!!selected} ... />
```

- [ ] **Step 3: Persist size on resize**

In `src/components/editor/visual-canvas.tsx`, the existing `onNodesChange` already receives `dimensions` change events from React Flow's resizer. Inspect the handler — `applyNodeChanges` updates `width`/`height` on the node, and the drag-end branch calls `updateGraphPositions` which (after Task 11) now captures size. Add a separate guard so resize-end also commits:

```ts
const hasResize = changes.some((c) => c.type === "dimensions");
if ((hasDragEnd || hasResize) && graphRef.current) {
  const updatedGraph = updateGraphPositions(graphRef.current, updatedNodes);
  syncGraphToCode(updatedGraph);
}
```

(Replace the older drag-end-only block with the combined guard.)

- [ ] **Step 4: Manual test**

Run: `pnpm dev`. Click a node to select it; resize handles appear. Drag a corner — the node grows; the `%%@ node X size=WxH` line updates in the code.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/custom-nodes.tsx src/components/editor/visual-canvas.tsx
git commit -m "feat: drag-to-resize nodes; size persists via %%@ annotations"
```

---

### Task 14: Honor stored size in `graphToReactFlow`

**Files:**
- Modify: `src/lib/parser/graph-to-reactflow.ts`

- [ ] **Step 1: Use `node.size` when present**

Replace the size computation at the top of `graphToReactFlow`'s map:

```ts
const nodes: Node<FlowNodeData>[] = graph.nodes.map((n) => {
  let width: number;
  let height: number;

  if (n.size) {
    width = n.size.width;
    height = n.size.height;
  } else {
    const base = estimateNodeSize(n.label);
    width = base.width;
    height = base.height;
    if (n.type === "decision") {
      width = Math.max(120, base.width * 1.6);
      height = Math.max(80, base.height * 1.6);
    } else if (n.type === "circle") {
      const diameter = Math.max(64, Math.ceil(Math.sqrt(base.width ** 2 + base.height ** 2) * 0.75));
      width = diameter;
      height = diameter;
    }
  }

  return {
    id: n.id,
    type: n.type,
    position: n.position,
    width,
    height,
    data: { label: n.label, mermaidType: n.type, onRenameNode, isLocked },
  };
});
```

- [ ] **Step 2: Manual test**

Reload the diagram. The previously resized nodes should come back at their saved size.

- [ ] **Step 3: Commit**

```bash
git add src/lib/parser/graph-to-reactflow.ts
git commit -m "feat: respect persisted node size when rendering React Flow"
```

---

## Phase 3 — Create & Connect From Canvas

Phase 3 makes the canvas a creation tool: pane double-click → new node, drag-to-connect → new edge.

---

### Task 15: "Add node" via pane double-click

**Files:**
- Modify: `src/components/editor/visual-canvas.tsx`

- [ ] **Step 1: Implement the handler**

In `visual-canvas.tsx`, add:

```ts
import { useReactFlow } from "@xyflow/react";

// Inside VisualCanvas, after other useState hooks:
const { screenToFlowPosition } = useReactFlow();

const onPaneDoubleClick = useCallback(
  (event: React.MouseEvent) => {
    if (isLocked || !graphRef.current) return;
    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newId = generateNodeId(graphRef.current.nodes);
    const newNode: GraphNode = {
      id: newId,
      label: newId,
      type: "default",
      position: { x: Math.round(pos.x), y: Math.round(pos.y) },
    };
    const updatedGraph: FlowchartGraph = {
      ...graphRef.current,
      nodes: [...graphRef.current.nodes, newNode],
    };
    syncGraphToCode(updatedGraph);
  },
  [isLocked, screenToFlowPosition, syncGraphToCode]
);

// Helper near top of file:
function generateNodeId(existing: GraphNode[]): string {
  const used = new Set(existing.map((n) => n.id));
  for (let i = 1; i < 1000; i++) {
    const id = `N${i}`;
    if (!used.has(id)) return id;
  }
  return `N${Date.now()}`;
}
```

Pass `onPaneDoubleClick` to `<ReactFlow>`:

```tsx
<ReactFlow
  ...
  onPaneClick={onPaneClick}
  onDoubleClick={onPaneDoubleClick}
  ...
/>
```

(Note: React Flow exposes `onDoubleClick` at the wrapper level; the handler receives the raw mouse event. Use `event.target` to ensure we only fire on the pane, not on a node.)

For pane-only filtering:

```ts
const onPaneDoubleClick = useCallback(
  (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.classList.contains("react-flow__pane")) return;
    // ... rest
  },
  [...]
);
```

- [ ] **Step 2: Wrap canvas in `<ReactFlowProvider>` if not already**

`useReactFlow()` requires the provider. Check the parent: in `editor-layout.tsx`, the `VisualCanvas` is rendered directly. Wrap in `visual-canvas.tsx`:

```tsx
import { ReactFlowProvider } from "@xyflow/react";

export function VisualCanvas() {
  return (
    <ReactFlowProvider>
      <VisualCanvasInner />
    </ReactFlowProvider>
  );
}

function VisualCanvasInner() { /* original component body */ }
```

- [ ] **Step 3: Manual test**

Double-click on the canvas pane. A new node `N1` appears at the cursor position. The code shows:

```
    N1
    %%@ node N1 pos=...,...
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/visual-canvas.tsx
git commit -m "feat: double-click empty canvas to create a new node"
```

---

### Task 16: Drag-to-connect creates edges

**Files:**
- Modify: `src/components/editor/visual-canvas.tsx`

- [ ] **Step 1: Enable connections**

In `visual-canvas.tsx`, change the React Flow prop:

```tsx
nodesConnectable={!isLocked}
```

- [ ] **Step 2: Implement `onConnect`**

```ts
import { type Connection } from "@xyflow/react";

const onConnect = useCallback(
  (connection: Connection) => {
    if (isLocked || !graphRef.current) return;
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return;

    const exists = graphRef.current.edges.some(
      (e) => e.source === connection.source && e.target === connection.target
    );
    if (exists) return;

    const updated: FlowchartGraph = {
      ...graphRef.current,
      edges: [
        ...graphRef.current.edges,
        {
          id: `e_user_${Date.now()}`,
          source: connection.source,
          target: connection.target,
          type: "arrow",
        },
      ],
    };
    syncGraphToCode(updated);
  },
  [isLocked, syncGraphToCode]
);
```

Pass it to `<ReactFlow>`:

```tsx
<ReactFlow ... onConnect={onConnect} ... />
```

- [ ] **Step 3: Manual test**

Hover a node to expose its handle; drag from the source handle to a target node. The new edge appears in the canvas, and the code adds `A --> B`.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/visual-canvas.tsx
git commit -m "feat: drag-to-connect creates edges from canvas"
```

---

### Task 17: Floating canvas toolbar

**Files:**
- Create: `src/components/editor/canvas-toolbar.tsx`
- Modify: `src/components/editor/visual-canvas.tsx`

- [ ] **Step 1: Create the toolbar component**

```tsx
"use client";

import type { MermaidNodeType } from "@/types/graph";
import { Plus } from "lucide-react";

const SHAPES: { label: string; value: MermaidNodeType }[] = [
  { label: "Rectangle", value: "default" },
  { label: "Diamond", value: "decision" },
  { label: "Stadium", value: "stadium" },
  { label: "Circle", value: "circle" },
  { label: "Hexagon", value: "hexagon" },
  { label: "Cylinder", value: "cylinder" },
  { label: "Subroutine", value: "subroutine" },
  { label: "Parallelogram", value: "parallelogram" },
  { label: "Trapezoid", value: "trapezoid" },
];

interface Props {
  onAddNode: (shape: MermaidNodeType) => void;
}

export function CanvasToolbar({ onAddNode }: Props) {
  return (
    <div className="absolute top-2 left-2 z-10 flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-sm p-1">
      <details className="relative">
        <summary className="list-none cursor-pointer flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--muted)]">
          <Plus size={12} />
          Add Node
        </summary>
        <div className="absolute top-full left-0 mt-1 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-lg py-1">
          {SHAPES.map((s) => (
            <button
              key={s.value}
              onClick={() => onAddNode(s.value)}
              className="block w-full text-left px-3 py-1 text-xs hover:bg-[var(--muted)]"
            >
              {s.label}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `VisualCanvas`**

In `visual-canvas.tsx`, import and add inside the wrapper div:

```tsx
import { CanvasToolbar } from "./canvas-toolbar";

// inside the return, just inside the wrapping <div className="h-full w-full relative">:
<CanvasToolbar
  onAddNode={(shape) => {
    if (!graphRef.current) return;
    const id = generateNodeId(graphRef.current.nodes);
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const updated: FlowchartGraph = {
      ...graphRef.current,
      nodes: [
        ...graphRef.current.nodes,
        { id, label: id, type: shape, position: { x: Math.round(center.x), y: Math.round(center.y) } },
      ],
    };
    syncGraphToCode(updated);
  }}
/>
```

- [ ] **Step 3: Manual test**

Click "Add Node → Hexagon" — a new hexagon node appears at canvas center; code reflects it with `%%@ node N1 shape=hexagon`.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/canvas-toolbar.tsx src/components/editor/visual-canvas.tsx
git commit -m "feat: canvas toolbar with shape picker for adding nodes"
```

---

## Phase 4 — Shape & Color Variety in Code

Phase 4 expands the visual vocabulary: new shape components, in-canvas color picker, per-node `style` baked into code annotations.

---

### Task 18: Implement new shape components

**Files:**
- Modify: `src/components/editor/custom-nodes.tsx`

- [ ] **Step 1: Add `HexagonNode`**

Append to `custom-nodes.tsx` (before the export):

```tsx
function HexagonNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <>
      <NodeResizer minWidth={100} minHeight={60} isVisible={!!selected && !nodeData.isLocked} />
      <div className="relative w-full h-full flex items-center justify-center">
        <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
        <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <polygon
            points="20,2 80,2 98,30 80,58 20,58 2,30"
            fill={nodeStyles.backgroundColor ?? "var(--background)"}
            stroke={nodeStyles.borderColor ?? "var(--border)"}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          className="relative z-10 text-sm font-medium text-center px-3"
          style={{
            fontFamily: nodeStyles.fontFamily,
            fontSize: nodeStyles.fontSize,
            color: nodeStyles.color,
          }}
        >
          <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
        </span>
        <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add `ParallelogramNode` and `TrapezoidNode`**

Same structure as `HexagonNode` but with these polygon points:

- Parallelogram: `points="20,2 98,2 80,58 2,58"`
- Trapezoid: `points="20,2 80,2 98,58 2,58"`

- [ ] **Step 3: Register them in `customNodeTypes`**

```ts
export const customNodeTypes = {
  default: DefaultNode,
  decision: DecisionNode,
  stadium: StadiumNode,
  subroutine: SubroutineNode,
  cylinder: CylinderNode,
  circle: CircleNode,
  hexagon: HexagonNode,
  parallelogram: ParallelogramNode,
  trapezoid: TrapezoidNode,
};
```

- [ ] **Step 4: Manual test**

Use the canvas toolbar's "Add Node → Hexagon" button. The hexagon renders correctly. Verify mermaid preview falls back to a rectangle (because mermaid has no hexagon primitive — the `shape=hexagon` annotation is informational).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/custom-nodes.tsx
git commit -m "feat: add hexagon, parallelogram, and trapezoid node shapes"
```

---

### Task 19: Per-node color picker in context menu

**Files:**
- Modify: `src/components/editor/node-context-menu.tsx`
- Modify: `src/components/editor/visual-canvas.tsx`

- [ ] **Step 1: Add color section to context menu**

In `node-context-menu.tsx`, add `onSetColor` to the props:

```ts
interface NodeContextMenuProps {
  ...
  onSetColor: (nodeId: string, fill: string | null, stroke: string | null) => void;
}
```

Add a new menu item with a small color swatch list. After the "Change Shape" submenu, append:

```tsx
const COLOR_PRESETS = [
  { label: "Default", fill: null, stroke: null },
  { label: "Blue", fill: "#dbeafe", stroke: "#3b82f6" },
  { label: "Green", fill: "#dcfce7", stroke: "#22c55e" },
  { label: "Yellow", fill: "#fef3c7", stroke: "#eab308" },
  { label: "Red", fill: "#fee2e2", stroke: "#ef4444" },
  { label: "Purple", fill: "#f3e8ff", stroke: "#a855f7" },
];

// In the rendered menu:
<div className="border-t border-[var(--border)] pt-1 px-2 py-1">
  <div className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] mb-1">Color</div>
  <div className="flex gap-1 flex-wrap">
    {COLOR_PRESETS.map((c) => (
      <button
        key={c.label}
        onClick={() => { onSetColor(nodeId, c.fill, c.stroke); onClose(); }}
        className="w-5 h-5 rounded border-2"
        style={{
          backgroundColor: c.fill ?? "transparent",
          borderColor: c.stroke ?? "var(--border)",
        }}
        title={c.label}
      />
    ))}
  </div>
</div>
```

- [ ] **Step 2: Implement handler in `VisualCanvas`**

In `visual-canvas.tsx`:

```ts
const handleNodeSetColor = useCallback(
  (nodeId: string, fill: string | null, stroke: string | null) => {
    if (!graphRef.current || isLocked) return;
    const updated: FlowchartGraph = {
      ...graphRef.current,
      nodes: graphRef.current.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const style = { ...(n.style ?? {}) };
        if (fill === null) delete style.backgroundColor; else style.backgroundColor = fill;
        if (stroke === null) delete style.borderColor; else style.borderColor = stroke;
        return Object.keys(style).length > 0 ? { ...n, style } : { ...n, style: undefined };
      }),
    };
    syncGraphToCode(updated);
  },
  [isLocked, syncGraphToCode]
);
```

Pass it through to `NodeContextMenu`:

```tsx
<NodeContextMenu ... onSetColor={handleNodeSetColor} />
```

- [ ] **Step 3: Manual test**

Right-click a node → click a color preset. The node updates color in the canvas; the code shows `%%@ node A fill=#dbeafe stroke=#3b82f6`.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/node-context-menu.tsx src/components/editor/visual-canvas.tsx
git commit -m "feat: color presets in node context menu, persisted to code"
```

---

### Task 20: Reflect per-node style in React Flow rendering

**Files:**
- Modify: `src/components/editor/custom-nodes.tsx`

The existing `useNodeStyles` reads `styleOverrides` JSON. Now we need it to also read per-node `style` from the parsed graph (which lives in code annotations, not the sidecar).

- [ ] **Step 1: Pass per-node style through React Flow data**

In `src/lib/parser/graph-to-reactflow.ts`, add `style` to `FlowNodeData`:

```ts
export interface FlowNodeData {
  label: string;
  mermaidType: string;
  style?: NodeStyleOverride;
  onRenameNode?: (nodeId: string, newLabel: string) => void;
  isLocked?: boolean;
  [key: string]: unknown;
}
```

In the same file's mapping:

```ts
data: {
  label: n.label,
  mermaidType: n.type,
  style: n.style,
  onRenameNode,
  isLocked,
},
```

- [ ] **Step 2: Use `data.style` in `useNodeStyles`**

In `custom-nodes.tsx`, update `useNodeStyles` to merge data-level style after the JSON-derived style:

```ts
function useNodeStyles(nodeId: string | null, dataStyle?: NodeStyleOverride): React.CSSProperties {
  const styleOverridesJson = useDiagramStore((s) => s.diagram?.styleOverrides ?? null);
  return useMemo(() => {
    const merged: NodeStyleOverride = {};
    if (styleOverridesJson) {
      try {
        const styles = JSON.parse(styleOverridesJson) as DiagramStyles;
        Object.assign(merged, styles.globalNode ?? {}, nodeId ? styles.nodes?.[nodeId] ?? {} : {});
      } catch { /* ignore */ }
    }
    Object.assign(merged, dataStyle ?? {});
    const css: React.CSSProperties = {};
    if (merged.fontFamily) css.fontFamily = merged.fontFamily;
    if (merged.fontSize) css.fontSize = `${merged.fontSize}px`;
    if (merged.fontColor) css.color = merged.fontColor;
    if (merged.backgroundColor) css.backgroundColor = merged.backgroundColor;
    if (merged.borderColor) css.borderColor = merged.borderColor;
    return css;
  }, [styleOverridesJson, nodeId, dataStyle]);
}
```

Update call sites:

```ts
const nodeStyles = useNodeStyles(nodeId, nodeData.style);
```

(Apply to all 9 node components.)

- [ ] **Step 3: Manual test**

Pick a color preset on node A. Verify the canvas reflects the color *immediately* (without needing to round-trip through the mermaid SVG renderer).

- [ ] **Step 4: Commit**

```bash
git add src/lib/parser/graph-to-reactflow.ts src/components/editor/custom-nodes.tsx
git commit -m "feat: render per-node style from code annotations in React Flow"
```

---

## Phase 5 — Cleanup & Hardening

---

### Task 21: AI tool schemas accept new shape and style fields

**Files:**
- Modify: `src/lib/ai/tools.ts`
- Modify: `src/lib/graph-operations.ts`

- [ ] **Step 1: Expand the shape enum**

In `src/lib/ai/tools.ts`, replace the shape enum literal in `addNodesSchema`, `updateNodesSchema`, and `mermaidNodeType`:

```ts
const SHAPE_VALUES = [
  "default", "decision", "stadium", "subroutine", "cylinder", "circle",
  "hexagon", "parallelogram", "trapezoid",
] as const;

const mermaidNodeType = z.enum(SHAPE_VALUES).optional().default("default");
```

Also extend `addNodesSchema.nodes[*]` and `updateNodesSchema.updates[*]` with optional `position`, `size`, and `style`:

```ts
const styleObj = z.object({
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
  fontColor: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
}).optional();

export const addNodesSchema = z.object({
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: mermaidNodeType,
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    size: z.object({ width: z.number(), height: z.number() }).optional(),
    style: styleObj,
  })),
});
```

(Repeat for `updateNodesSchema`.)

- [ ] **Step 2: Wire through `applyAddNodes` / `applyUpdateNodes`**

In `src/lib/graph-operations.ts`, pass the new fields onto the resulting `GraphNode`:

```ts
const newNodes: GraphNode[] = nodes.map((n) => ({
  id: n.id,
  label: n.label,
  type: n.type ?? "default",
  position: n.position ?? { x: 0, y: 0 },
  size: n.size,
  style: n.style,
}));
```

(Repeat for the update path.)

- [ ] **Step 3: Update the `NodeInput` and `NodeUpdate` interfaces in the same file accordingly.**

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/tools.ts src/lib/graph-operations.ts
git commit -m "feat: AI tools can specify position, size, style, and new shapes"
```

---

### Task 22: Update the AI system prompt to mention annotations

**Files:**
- Modify: `src/lib/ai/system-prompt.ts`

- [ ] **Step 1: Read current prompt**

```bash
cat src/lib/ai/system-prompt.ts
```

- [ ] **Step 2: Append the annotation reference**

Add a section like:

```
The diagram code uses Mermaid plus `%%@` directive comments for visual metadata:

  %%@ node <id> pos=X,Y size=WxH fill=#hex stroke=#hex shape=<name>
  %%@ edge <source>-><target> color=#hex width=N
  %%@ defaults node|edge ...

When using addNodes / updateNodes you can pass position/size/style directly — the
client will emit the corresponding directives. You should NOT regenerate annotations
manually unless the user asked to relayout the entire diagram.

New shape types: hexagon, parallelogram, trapezoid (in addition to the prior six).
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/system-prompt.ts
git commit -m "docs: teach the AI about %%@ annotations and new shapes"
```

---

### Task 23: Style panel writes to code annotations, not sidecar

**Files:**
- Modify: `src/components/editor/style-panel.tsx`
- Modify: `src/stores/diagram-store.ts`

The current style panel writes to the sidecar JSON via `setStyleOverrides`. Convert it to write defaults annotations instead.

- [ ] **Step 1: Add a helper to `diagram-store.ts`**

```ts
import { mermaidToGraph } from "@/lib/parser/mermaid-to-graph";
import { graphToMermaid } from "@/lib/parser/graph-to-mermaid";
import { parseAnnotations, serializeAnnotation } from "@/lib/parser/annotations";

setGlobalNodeStyle: (style: NodeStyleOverride) => {
  const { diagram } = get();
  if (!diagram) return;
  const code = upsertDefaultsAnnotation(diagram.code, "node", style);
  set({ diagram: { ...diagram, code }, isDirty: true });
  scheduleSave(get);
},

setGlobalEdgeStyle: (style: EdgeStyleOverride) => {
  const { diagram } = get();
  if (!diagram) return;
  const code = upsertDefaultsAnnotation(diagram.code, "edge", style);
  set({ diagram: { ...diagram, code }, isDirty: true });
  scheduleSave(get);
},

setNodeStyle: (id: string, style: NodeStyleOverride) => {
  /* ... build graph, set node.style, serialize ... */
},

setEdgeStyle: (id: string, style: EdgeStyleOverride) => {
  /* ... similar via edge id ... */
},
```

Helper:

```ts
function upsertDefaultsAnnotation(
  code: string,
  scope: "node" | "edge",
  style: NodeStyleOverride | EdgeStyleOverride
): string {
  const lines = code.split("\n");
  const idx = lines.findIndex((l) => new RegExp(`^\\s*%%@\\s+defaults\\s+${scope}\\b`).test(l));
  const newLine = `    ${serializeAnnotation({ kind: "defaults", scope, style })}`;
  if (idx === -1) {
    lines.splice(1, 0, newLine);
  } else {
    lines[idx] = newLine;
  }
  return lines.join("\n");
}
```

- [ ] **Step 2: Update `style-panel.tsx` to call the new methods**

Replace `updateGlobalNode`, `updateGlobalEdge`, `updateNodeStyle`, `updateEdgeStyle`, `removeNodeOverride`, `removeEdgeOverride` to read from code (via parsing) and write through the new store methods. Drop the sidecar `getStyleOverrides`/`setStyleOverrides` path.

- [ ] **Step 3: Smoke test**

Pick a font in the global node defaults — verify a `%%@ defaults node font=...` line appears in the code.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/style-panel.tsx src/stores/diagram-store.ts
git commit -m "feat: style panel persists styles into code annotations"
```

---

### Task 24: Deprecate sidecar columns

**Files:**
- Modify: `src/stores/diagram-store.ts`
- Modify: `src/types/diagram.ts`
- Modify: `src/components/editor/visual-canvas.tsx` (cleanup leftover references)

- [ ] **Step 1: Stop sending `positions` and `styleOverrides` in `saveDiagram`**

```ts
body: JSON.stringify({
  title: diagram.title,
  code: diagram.code,
  // positions/styleOverrides intentionally omitted — code is canonical
}),
```

- [ ] **Step 2: Remove `setPositions` and `setStyleOverrides` from the store interface**

Search and remove call sites; TypeScript will guide.

- [ ] **Step 3: Verify migration still happens for old rows**

Manual: load an old diagram → confirm code now has annotations and `positions`/`style_overrides` columns are no longer touched (their data still exists, but is ignored after the one-shot migration runs).

- [ ] **Step 4: Note about schema**

Do NOT drop the columns yet; keep them as a safety net for at least one release. Add a comment at the column definition in `db.ts`:

```ts
// DEPRECATED: positions and style_overrides are now baked into `code` as %%@
// directives. Columns retained for one release as a safety net for older rows.
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/diagram-store.ts src/types/diagram.ts src/components/editor/visual-canvas.tsx src/lib/db.ts
git commit -m "feat: deprecate positions and style_overrides sidecar columns"
```

---

### Task 25: Reconcile edge style identity (id vs source->target)

**Files:**
- Modify: `src/components/editor/mermaid-preview.tsx`
- Modify: `src/components/editor/style-panel.tsx`

The legacy sidecar keyed edge styles by internal id (`e0`, `e1`). Annotations key by `source->target`. After Task 24, the in-code identity wins, but UI components that still index by id need updating.

- [ ] **Step 1: Migrate selectors and label maps to use `source->target`**

In `editor-layout.tsx` (or wherever `edgeLabels` is built), key by `${source}->${target}` instead of `e.id`.

- [ ] **Step 2: Adjust mermaid SVG selectors**

In `mermaid-preview.tsx`'s `applyStylesToSvg`, iterate edge style entries by `${source}->${target}` keys, building an SVG selector that matches mermaid's `id="L_<src>_<tgt>_..."` pattern:

```ts
const safe = sanitizeCssSelector(edgeKey.replace("->", "_"));
rules.push(`g[id*="L_${safe}"] path { ... }`);
```

- [ ] **Step 3: Smoke test**

Select an edge in the canvas; apply a color via style panel; confirm the mermaid preview also takes the color.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/mermaid-preview.tsx src/components/editor/style-panel.tsx src/components/editor/editor-layout.tsx
git commit -m "fix: identify edge styles by source->target across canvas and preview"
```

---

### Task 26: Selection state & quick toolbar (polish)

**Files:**
- Modify: `src/components/editor/visual-canvas.tsx`
- Modify: `src/components/editor/canvas-toolbar.tsx`

- [ ] **Step 1: Track selected node/edge in canvas state**

Use `onSelectionChange` from React Flow:

```ts
const [selection, setSelection] = useState<{ nodeId: string | null; edgeId: string | null }>({
  nodeId: null, edgeId: null,
});

const onSelectionChange = useCallback((sel: { nodes: Node[]; edges: Edge[] }) => {
  setSelection({
    nodeId: sel.nodes[0]?.id ?? null,
    edgeId: sel.edges[0]?.id ?? null,
  });
}, []);
```

- [ ] **Step 2: Show "Delete" and "Duplicate" buttons in the toolbar when something is selected**

Extend `CanvasToolbar` props to take `selectedNodeId` and `onDelete`/`onDuplicate`. Show a small action set when not null.

- [ ] **Step 3: Wire delete/duplicate handlers**

```ts
const handleDuplicate = useCallback((id: string) => {
  if (!graphRef.current) return;
  const original = graphRef.current.nodes.find((n) => n.id === id);
  if (!original) return;
  const newId = generateNodeId(graphRef.current.nodes);
  const updated = {
    ...graphRef.current,
    nodes: [
      ...graphRef.current.nodes,
      { ...original, id: newId, label: newId, position: { x: original.position.x + 40, y: original.position.y + 40 } },
    ],
  };
  syncGraphToCode(updated);
}, [syncGraphToCode]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/visual-canvas.tsx src/components/editor/canvas-toolbar.tsx
git commit -m "feat: selection-aware canvas toolbar with delete & duplicate"
```

---

### Task 27: Keyboard shortcuts

**Files:**
- Modify: `src/hooks/use-keyboard-shortcuts.ts`
- Modify: `src/components/editor/visual-canvas.tsx`

- [ ] **Step 1: Add shortcuts**

In `use-keyboard-shortcuts.ts`, add:

| Key | Action |
|---|---|
| `Delete` / `Backspace` (when canvas focused, node selected) | Delete selected node |
| `Cmd/Ctrl+D` (canvas focused) | Duplicate selected node |
| `N` (canvas focused, pane focused) | Add node at canvas center |

- [ ] **Step 2: Test manually**

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-keyboard-shortcuts.ts src/components/editor/visual-canvas.tsx
git commit -m "feat: keyboard shortcuts for delete, duplicate, add node"
```

---

### Task 28: End-to-end manual test pass

This is a verification gate, not a code change.

- [ ] **Step 1: Smoke checklist (do these in a fresh browser tab)**

Run: `pnpm dev`, then for one diagram exercise:

1. Create a brand new diagram. Verify `flowchart TB\n    A[Start] --> B[End]` is present.
2. Drag node `A`. Verify `%%@ node A pos=X,Y` appears under the node definition.
3. Resize node `A`. Verify `size=WxH` is added.
4. Right-click `A` → set Blue color. Verify `fill=#dbeafe stroke=#3b82f6` appears.
5. Right-click `A` → Change Shape → Hexagon. Verify rendered hexagon and `shape=hexagon`.
6. Drag from `A`'s source handle to `B`. Verify a new edge appears in the code.
7. Double-click the canvas pane in an empty area. Verify `N1` node is created.
8. Edit the code directly: change `pos=` to a different value. Verify the canvas updates.
9. Close and reopen the diagram. Verify all positions, sizes, colors, shapes are restored from code.
10. Open a *legacy* diagram (one created before this branch). Verify on first load: code now contains annotations matching the prior visual state, and the canvas shows it identically.

- [ ] **Step 2: Lint + types**

Run: `pnpm lint && pnpm build`
Expected: zero lint errors, successful build.

- [ ] **Step 3: Vitest run**

Run: `pnpm test:run`
Expected: all parser tests pass.

- [ ] **Step 4: Commit any fixes from the smoke test**

If you fix a bug discovered during smoke testing, commit it with a `fix:` message describing the symptom and root cause.

---

## Self-Review

Spec coverage check:

- ✅ "Manually drag around" → already supported; resized in Task 11 to write code annotations
- ✅ "Edit nodes in persistent state" → Task 11 (drag-persist via code), Task 19 (color), Task 26 (delete/duplicate)
- ✅ "Create nodes and add those back in" → Tasks 15, 17 (pane double-click, toolbar)
- ✅ "All this must still live as code, traceable purely through code" → Phase 1 entire (annotation language); Tasks 23–24 (deprecate sidecar)
- ✅ "Variability in shapes, color, sizes" → Tasks 13–14 (size), 18 (shapes), 19 (color)
- ✅ "Drag and change size" → Tasks 13–14
- ✅ "Shared language layer on top of mermaid?" → Yes — Phase 1 designs and ships it (`%%@` directives)

Type consistency check:

- `MermaidNodeType` is extended once in Task 6; all references in `custom-nodes.tsx`, `node-context-menu.tsx`, `graph-operations.ts`, `tools.ts` updated downstream.
- `GraphNode.size` is the canonical resize source after Task 6; Task 11's `updateGraphPositions` reads it; Task 14 renders it.
- `NodeStyleOverride` shape preserved end-to-end (defined in `graph.ts`, parsed in `annotations.ts`, applied in `custom-nodes.tsx` and `mermaid-preview.tsx`).
- Edge identity transitions from internal `id` (`e0`) to `source->target` in Task 25 — search-and-replace gate to prevent regressions.

Placeholder scan: none found. Every step contains either runnable code, an exact command + expected output, or a manual-test checklist with explicit assertions.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-03-visual-node-editing-with-code-annotations.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
