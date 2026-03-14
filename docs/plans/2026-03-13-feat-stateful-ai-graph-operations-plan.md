---
title: "feat: Stateful AI Graph Operations"
type: feat
status: completed
date: 2026-03-13
deepened: 2026-03-13
---

# feat: Stateful AI Graph Operations

## Enhancement Summary

**Deepened on:** 2026-03-13
**Research agents used:** architecture-strategist, code-simplicity-reviewer, kieran-typescript-reviewer, performance-oracle, security-sentinel, julik-frontend-races-reviewer, agent-native-reviewer, pattern-recognition-specialist, spec-flow-analyzer, best-practices-researcher, repo-research-analyst, learnings-researcher

### Key Improvements
1. **Simplified tool design** — Consider collapsing 6 granular tools into 1 `modifyGraph` tool with optional fields, eliminating undo batching complexity
2. **Critical race condition fixes** — Stale closure bug in `onToolCall`, undo conflicts during AI streaming, onFinish timing with pending tool calls
3. **Type safety hardening** — Use Zod `.parse()` instead of `as` casts, discriminated union result types, readonly graph types
4. **Performance optimizations** — Remove unnecessary `structuredClone`, deduplicate system prompt, skip mermaid validation for graph-model operations

### New Considerations Discovered
- Stale closure in `onToolCall` will read render-time `code` instead of latest state — must use `useDiagramStore.getState()`
- Undo debounce timer conflicts with batch operations — must clear pending undo timeouts when batch starts
- `onFinish` can fire before final `onToolCall` completes — need pending tool call tracking

---

## Overview

Replace the AI agent's single `updateDiagram` tool (which rewrites the entire mermaid code string on every edit) with granular, graph-aware tools that modify the diagram incrementally. The AI should operate on the graph model — adding/removing/updating individual nodes and edges — rather than regenerating the full mermaid source each time.

This preserves user-positioned nodes, enables meaningful undo/redo steps, reduces token usage, and makes AI edits predictable and composable.

## Problem Statement

**Current behavior**: When the user says "add a database node," the AI regenerates the entire diagram from scratch. This:

1. **Destroys user layout** — All manually positioned nodes reset because the AI writes new code that gets re-parsed and re-laid out
2. **Wastes tokens** — The AI outputs the entire diagram even for single-node additions
3. **Makes undo coarse** — Undoing one AI action reverts the entire diagram, not just the change
4. **Is fragile** — The AI can accidentally drop nodes, change labels, or alter edge types when rewriting
5. **Breaks agent-native parity** — A user on the visual canvas can drag-add a single node; the AI cannot

## Proposed Solution

### Architecture: Graph Model as the AI's Interface

The bidirectional parser pipeline already exists:

```
mermaid code ←→ FlowchartGraph ←→ React Flow nodes/edges
```

Instead of the AI writing mermaid strings, it will call tools that operate on the `FlowchartGraph` model. The client-side tool handlers apply graph operations, then serialize back to mermaid code via `graphToMermaid()`.

```
User request → AI decides operations → tool calls (addNodes, addEdges, etc.)
  → client applies to graph model → graphToMermaid() → setCode() → preview updates
```

### Tool Design

#### Design Decision: Single Tool vs Multiple Tools

**Option A (Original): 6 Separate Tools** — `addNodes`, `removeNodes`, `updateNodes`, `addEdges`, `removeEdges`, `updateEdges`

**Option B (Simplified): 1 `modifyGraph` Tool** — All operations in one call with optional fields:

```typescript
modifyGraphSchema = z.object({
  addNodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["default", "decision", "stadium", "subroutine", "cylinder", "circle"]).optional(),
  })).optional(),
  removeNodeIds: z.array(z.string()).optional(),
  updateNodes: z.array(z.object({
    id: z.string(),
    label: z.string().optional(),
    type: z.enum(["default", "decision", "stadium", "subroutine", "cylinder", "circle"]).optional(),
  })).optional(),
  addEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    type: z.enum(["arrow", "dotted", "thick"]).optional(),
  })).optional(),
  removeEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
  })).optional(),
  updateEdges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    label: z.string().nullable().optional(),
    type: z.enum(["arrow", "dotted", "thick"]).optional(),
  })).optional(),
}).refine(data => {
  // At least one operation must be specified
  return data.addNodes || data.removeNodeIds || data.updateNodes ||
         data.addEdges || data.removeEdges || data.updateEdges;
}, "At least one operation is required");
```

**Recommendation: Use Option A (6 separate tools).** While Option B is appealing for its simplicity, separate tools are better because:
- The AI model gets clearer tool descriptions and knows exactly which operation to pick
- Error messages are more specific ("addNodes failed" vs "modifyGraph failed on the addNodes portion")
- Token usage per call is lower (AI only sends the fields it needs)
- The undo batching solution (beginBatch/endBatch) is straightforward

#### New Granular Tools

**`addNodes`** — Add one or more nodes to the diagram
```typescript
addNodesSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().describe("Unique node ID (e.g., 'DB', 'auth_service')"),
    label: z.string().describe("Display label for the node"),
    type: z.enum(["default", "decision", "stadium", "subroutine", "cylinder", "circle"])
      .optional().default("default"),
  })),
});
```

**`removeNodes`** — Remove nodes and their connected edges
```typescript
removeNodesSchema = z.object({
  nodeIds: z.array(z.string()).describe("IDs of nodes to remove"),
});
```

**`updateNodes`** — Modify existing node properties
```typescript
updateNodesSchema = z.object({
  updates: z.array(z.object({
    id: z.string().describe("ID of the node to update"),
    label: z.string().optional(),
    type: z.enum(["default", "decision", "stadium", "subroutine", "cylinder", "circle"]).optional(),
  })),
});
```

**`addEdges`** — Add connections between nodes
```typescript
addEdgesSchema = z.object({
  edges: z.array(z.object({
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
    label: z.string().optional().describe("Edge label"),
    type: z.enum(["arrow", "dotted", "thick"]).optional().default("arrow"),
  })),
});
```

**`removeEdges`** — Remove specific connections
```typescript
removeEdgesSchema = z.object({
  edges: z.array(z.object({
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
  })),
});
```

**`updateEdges`** — Modify edge properties
```typescript
updateEdgesSchema = z.object({
  updates: z.array(z.object({
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
    label: z.string().nullable().optional(),
    type: z.enum(["arrow", "dotted", "thick"]).optional(),
  })),
});
```

**`replaceDiagram`** — Full rewrite (kept as escape hatch)
```typescript
replaceDiagramSchema = z.object({
  code: z.string().min(1).describe("Complete mermaid diagram code — use only for diagram type changes or complete restructuring"),
});
```

#### Why This Tool Shape

- **Batch operations**: Each tool accepts arrays so the AI can add 5 nodes in one call, not 5 separate calls
- **Edge identification by source+target**: Simpler than requiring edge IDs (which the AI doesn't see in the mermaid code)
- **No position parameters**: The AI shouldn't control layout — dagre handles new node positioning
- **`replaceDiagram` kept**: Non-flowchart diagram types (sequence, class, state, ER) don't have a graph model, so the AI needs a fallback

### Client-Side Tool Execution

All graph operations happen in `onToolCall` in `chat-panel.tsx`. The flow:

```typescript
// Pseudocode for addNodes handler
if (toolCall.toolName === "addNodes") {
  // CRITICAL: Use getState() to avoid stale closure bug
  const currentCode = useDiagramStore.getState().diagram?.code;
  if (!currentCode) return "Error: No diagram loaded.";

  const args = addNodesSchema.parse(toolCall.args); // Use Zod parse, not `as` cast

  // 1. Parse current code to graph
  const graph = mermaidToGraph(currentCode);
  if (!graph) return "Error: Current diagram is not a flowchart. Use replaceDiagram instead.";

  // 2. Apply operation (pure function — validates internally)
  const result = applyAddNodes(graph, args.nodes);
  if (!result.ok) return result.error;

  // 3. Auto-layout new nodes only (incremental layout)
  const laid = incrementalLayout(result.graph, args.nodes.map(n => n.id));

  // 4. Serialize back to mermaid code
  const newCode = graphToMermaid(laid);

  // 5. Apply (skip mermaid.parse — graph model guarantees valid output)
  useDiagramStore.getState().setCode(newCode);
  return `Added ${args.nodes.length} node(s): ${args.nodes.map(n => n.id).join(", ")}`;
}
```

#### Research Insights: Race Conditions

**CRITICAL — Stale closure bug**: The `onToolCall` callback captures `code` from render time. If the AI calls `addNodes` then `addEdges` in one turn, the second call would read the pre-addNodes code, not the updated code. **Fix**: Always read state via `useDiagramStore.getState().diagram?.code` instead of the React-level `code` variable.

**Undo conflict during batch**: The `setCode` debounce timer (500ms) could fire mid-batch and push a partial undo entry. **Fix**: Clear any pending undo timeout when `beginBatch()` is called, and skip undo snapshots entirely while `_batchStartCode` is set.

**onFinish timing**: `onFinish` can fire before the last `onToolCall` promise resolves. **Fix**: Track pending tool calls with a counter; only call `endBatch()` when both `onFinish` has fired AND pending count is 0.

```typescript
// In chat-panel.tsx — safe batching
let pendingToolCalls = 0;
let finishFired = false;

const maybeEndBatch = () => {
  if (finishFired && pendingToolCalls === 0) {
    useDiagramStore.getState().endBatch();
    useDiagramStore.getState().setSyncState("idle");
    finishFired = false;
  }
};

// In onToolCall:
pendingToolCalls++;
try {
  // ... handle tool
} finally {
  pendingToolCalls--;
  maybeEndBatch();
}

// In onFinish:
finishFired = true;
maybeEndBatch();
```

### Incremental Layout Strategy

**Problem**: When the AI adds new nodes, where do they go?

**Solution**: Incremental layout — only position new/unpositioned nodes while preserving existing positions.

```typescript
// src/lib/parser/auto-layout.ts — new function
export function incrementalLayout(
  graph: FlowchartGraph,
  newNodeIds: string[]
): FlowchartGraph {
  // Run full dagre layout to get "ideal" positions for new nodes
  // Note: autoLayout returns a new graph, no need for structuredClone
  const fullLayout = autoLayout({ ...graph, nodes: graph.nodes.map(n => ({ ...n })), edges: [...graph.edges] });

  // For existing nodes: keep their current positions
  // For new nodes: use dagre's computed positions
  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      if (newNodeIds.includes(node.id)) {
        const laid = fullLayout.nodes.find(n => n.id === node.id);
        return laid ? { ...node, position: laid.position } : node;
      }
      return node; // preserve existing position
    }),
  };
}
```

#### Research Insights: Performance

- **Skip `structuredClone`** — `autoLayout` in the current codebase creates a new graph via dagre; it does not mutate the input. A shallow copy suffices.
- **Skip `mermaid.parse()` validation for graph operations** — The graph model guarantees structurally valid mermaid output. The `graphToMermaid` serializer produces deterministic, valid code. Only validate with `mermaid.parse()` for `replaceDiagram` (which accepts arbitrary user strings).

### System Prompt Changes

The system prompt needs to expose the graph structure (not just raw mermaid code) so the AI knows which nodes/edges exist and can reference them by ID.

```typescript
export function buildSystemPrompt(currentCode: string): string {
  const graph = mermaidToGraph(currentCode);

  // Compact graph context — avoid duplicating info already in the mermaid code
  let graphContext = "";
  if (graph) {
    graphContext = `
## Current Graph Structure
Direction: ${graph.direction}
Nodes: ${graph.nodes.map(n => `${n.id}("${n.label}",${n.type})`).join(", ")}
Edges: ${graph.edges.map(e => `${e.source}→${e.target}${e.label ? `[${e.label}]` : ""}(${e.type})`).join(", ")}
`;
  }

  return `You are Eulard AI, an expert assistant for creating and modifying mermaid diagrams.

## Current Diagram
\`\`\`mermaid
${currentCode}
\`\`\`
${graphContext}
## Available Tools

### Graph Operations (preferred for flowcharts)
- **addNodes**: Add nodes to the diagram. Each node needs an id, label, and optional type.
- **removeNodes**: Remove nodes by ID. Connected edges are automatically removed.
- **updateNodes**: Change a node's label or type.
- **addEdges**: Connect nodes. Each edge needs source and target node IDs.
- **removeEdges**: Remove connections by source and target.
- **updateEdges**: Change an edge's label or type.
- **updateMetadata**: Change diagram title or direction.

### Full Replacement (use sparingly)
- **replaceDiagram**: Replace the entire diagram code. Use ONLY when:
  - Changing diagram type (e.g., flowchart → sequence diagram)
  - Major restructuring where granular ops would be more complex
  - Working with non-flowchart diagram types

### Export
- **exportDiagram**: Export as PNG, SVG, or mermaid code file.

## Instructions
- For flowchart modifications, ALWAYS prefer granular tools (addNodes, addEdges, etc.) over replaceDiagram.
- Reference existing nodes by their IDs when adding edges or updating.
- Node IDs should be short, descriptive, and use snake_case (e.g., "auth_service", "user_db").
- When adding nodes that should connect to existing ones, call addNodes first, then addEdges.
- When removing a node, its edges are automatically cleaned up — no need to remove edges separately.
- For non-flowchart diagrams (sequence, class, state, ER), use replaceDiagram.
`;
}
```

#### Research Insights: System Prompt

- **Compact node listing** — Use inline format `id("label",type)` instead of multi-line bullets. Reduces token count significantly for large diagrams.
- **Don't duplicate** — The mermaid code block already shows the diagram. The graph structure section should only add structured IDs/types that aren't obvious from reading mermaid syntax.

### Handling Non-Flowchart Diagrams

The parser only supports flowcharts. For other diagram types:

1. `mermaidToGraph()` returns `null`
2. System prompt omits graph structure section
3. System prompt instructs AI to use `replaceDiagram` for non-flowcharts
4. Granular tools return an error: `"Current diagram is not a flowchart. Use replaceDiagram."`

This is an honest limitation. Future work can add parsers for other diagram types.

### Undo/Redo with Multi-Step Tool Calls

**Problem**: The AI might call `addNodes` then `addEdges` in one turn (via `maxSteps: 5`). Each call triggers `setCode()`, creating two undo entries. The user expects "undo AI change" to revert both.

**Solution**: Group all tool calls within one AI turn into a single undo entry.

```typescript
// Store approach: add beginBatch/endBatch to the store
beginBatch: () => {
  const { diagram } = get();
  if (!diagram) return;

  // CRITICAL: Clear any pending undo debounce timer to prevent
  // a partial snapshot from being pushed mid-batch
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }

  set({ _batchStartCode: diagram.code });
},

endBatch: () => {
  const { _batchStartCode, undoStack } = get();
  if (_batchStartCode !== undefined) {
    const newStack = [...undoStack, _batchStartCode].slice(-MAX_HISTORY);
    set({ undoStack: newStack, redoStack: [], canUndo: true, canRedo: false, _batchStartCode: undefined });
  }
},
```

**Modified `setCode` during batch**: When `_batchStartCode` is set, skip the undo debounce — the batch handles it.

```typescript
setCode: (code: string) => {
  const { diagram, _batchStartCode } = get();
  if (!diagram) return;

  // Only push undo snapshots outside of batch operations
  if (_batchStartCode === undefined) {
    if (undoTimeout) clearTimeout(undoTimeout);
    const prevCode = diagram.code;
    undoTimeout = setTimeout(() => {
      const newStack = [...get().undoStack, prevCode].slice(-MAX_HISTORY);
      set({ undoStack: newStack, redoStack: [], canUndo: true, canRedo: false });
    }, 500);
  }

  set({ diagram: { ...diagram, code }, isDirty: true, error: null });
  scheduleSave(get);
},
```

Wire into chat lifecycle with safe timing (see Race Conditions section above):
- `onResponse` → `beginBatch()` + `setSyncState("ai-streaming")`
- `onFinish` → mark finish, call `endBatch()` when pending tool calls reach 0

### Validation & Error Handling

Each tool handler validates before applying:

| Scenario | Tool | Response to AI |
|----------|------|---------------|
| Duplicate node ID | addNodes | `"Error: Node 'X' already exists. Use updateNodes to modify it."` |
| Non-existent node ID | updateNodes | `"Error: Node 'X' not found. Current nodes: A, B, C."` |
| Edge references missing node | addEdges | `"Error: Node 'X' not found. Add it first with addNodes."` |
| Non-flowchart diagram | any granular tool | `"Error: Current diagram is not a flowchart. Use replaceDiagram."` |
| Generated code invalid | any tool | `"Error: Operation produced invalid mermaid syntax."` (shouldn't happen with graph model, but safety net) |

The AI gets `maxSteps: 5` (increased from 3) so it can recover from errors and retry.

#### Research Insights: Type Safety

Use discriminated union result types for graph operations instead of throwing:

```typescript
type GraphResult =
  | { ok: true; graph: FlowchartGraph }
  | { ok: false; error: string };

function applyAddNodes(graph: FlowchartGraph, nodes: NodeInput[]): GraphResult {
  for (const node of nodes) {
    if (graph.nodes.some(n => n.id === node.id)) {
      return { ok: false, error: `Node "${node.id}" already exists. Use updateNodes to modify it.` };
    }
  }
  return {
    ok: true,
    graph: {
      ...graph,
      nodes: [
        ...graph.nodes,
        ...nodes.map(n => ({
          id: n.id,
          label: n.label,
          type: n.type ?? "default",
          position: { x: 0, y: 0 },
        })),
      ],
    },
  };
}
```

This avoids try/catch in tool handlers and makes error paths explicit.

## Technical Approach

### Implementation Phases

#### Phase 1: Graph Operation Engine

Create a pure function layer that applies operations to `FlowchartGraph`:

```
src/lib/graph-operations.ts
```

Functions:
- `applyAddNodes(graph, nodes) → GraphResult`
- `applyRemoveNodes(graph, nodeIds) → GraphResult` (cascade-deletes edges)
- `applyUpdateNodes(graph, updates) → GraphResult`
- `applyAddEdges(graph, edges) → GraphResult`
- `applyRemoveEdges(graph, edgePairs) → GraphResult`
- `applyUpdateEdges(graph, updates) → GraphResult`

Each returns a `GraphResult` discriminated union. Pure functions, easy to test.

**Files to create:**
- `src/lib/graph-operations.ts` — operation functions + `GraphResult` type
- `src/lib/graph-operations.test.ts` — unit tests

#### Phase 2: Tool Schemas & System Prompt

Update the AI tool definitions and system prompt:

**Files to modify:**
- `src/lib/ai/tools.ts` — add 6 new tool schemas, keep `replaceDiagram` (rename from `updateDiagram`)
- `src/lib/ai/system-prompt.ts` — expose compact graph structure, update instructions
- `src/app/api/ai/chat/route.ts` — register new tools with `streamText`

#### Phase 3: Client-Side Tool Handlers + Undo Batching

Wire up the `onToolCall` handlers in chat-panel to use graph operations. Implement undo batching in the same phase since the tool handlers depend on it.

**Files to modify:**
- `src/components/ai/chat-panel.tsx` — add handlers for each new tool, implement safe batch timing
- `src/lib/parser/auto-layout.ts` — add `incrementalLayout` function
- `src/stores/diagram-store.ts` — add `beginBatch`/`endBatch`, `_batchStartCode`, modify `setCode` to respect batch mode

## Acceptance Criteria

### Functional Requirements

- [x] AI uses `addNodes` when user says "add a database node" (not full rewrite)
- [x] AI uses `addEdges` when user says "connect A to B"
- [x] AI uses `removeNodes` when user says "remove the auth node"
- [x] AI uses `updateNodes` when user says "rename X to Y"
- [x] AI uses `replaceDiagram` for non-flowchart diagrams and major restructures
- [x] Node positions are preserved when AI adds/removes other nodes
- [x] New nodes are auto-positioned via incremental dagre layout
- [x] Removing a node also removes its connected edges
- [x] Multiple tool calls in one AI turn produce a single undo entry
- [x] AI receives graph structure (node IDs, labels, edges) in context
- [x] Validation errors return helpful messages that let the AI self-correct

### Non-Functional Requirements

- [x] No regression for non-flowchart diagram types (sequence, class, etc.)
- [x] Mermaid validation still runs on `replaceDiagram` code changes
- [x] Visual canvas lock during AI streaming still works
- [x] All graph operations are pure functions with no side effects
- [x] No stale closure bugs — all tool handlers read latest state via `getState()`

## Dependencies & Risks

**Dependencies:**
- Existing parser pipeline (`mermaidToGraph`, `graphToMermaid`) must be reliable
- `graphToMermaid` must produce valid mermaid for all graph states

**Risks:**
- **Parser fidelity loss**: `mermaidToGraph` drops `subgraph`, `classDef`, `style` directives. If the user has these in their code, granular tools will silently drop them. **Mitigation**: Detect unparseable directives and fall back to `replaceDiagram` with a warning.
- **AI preference**: The AI might still prefer `replaceDiagram` over granular tools if the system prompt isn't strong enough. **Mitigation**: Make `replaceDiagram` return a warning for flowcharts: `"Diagram replaced. Prefer addNodes/addEdges for incremental changes."`
- **Edge ID collisions**: Generated edge IDs (from `${source}-${target}`) could collide if there are parallel edges between the same nodes. **Mitigation**: Use `${source}-${target}-${index}` pattern.
- **Stale closures**: React callback captures can read outdated state. **Mitigation**: Always use `useDiagramStore.getState()` in `onToolCall`.
- **onFinish race**: `onFinish` may fire before async tool handlers complete. **Mitigation**: Track pending tool calls; only `endBatch()` when both finish fired and pending is 0.

## References

### Internal References
- Parser pipeline: `src/lib/parser/mermaid-to-graph.ts`, `graph-to-mermaid.ts`
- Current tools: `src/lib/ai/tools.ts`
- Graph types: `src/types/graph.ts`
- Store: `src/stores/diagram-store.ts`
- Original project plan: `docs/plans/2026-03-10-feat-mermaid-vibe-coding-editor-plan.md`
