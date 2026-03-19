---
description: Create a new diagram in Eulard from a description or mermaid code
argument-hint: <description or mermaid code>
allowed-tools: [Bash]
---

Create a new diagram in Eulard.

## Instructions

1. Check that `EULARD_API_KEY` is set. If not, tell the user to set it: `export EULARD_API_KEY="eul_..."` (generate one from the Eulard admin panel at https://eulard.kelihi.com/admin).

2. Parse `$ARGUMENTS`:
   - If it starts with a mermaid diagram type keyword (`flowchart`, `sequenceDiagram`, `classDiagram`, `stateDiagram`, `erDiagram`, `gantt`, `pie`, `graph`), treat it as raw mermaid code.
   - Otherwise, treat it as a natural language description and generate appropriate mermaid code. Be comprehensive — include all relevant nodes, edges, decision points, and labels.

3. Derive a short, descriptive title from the content (max 80 chars).

4. Create the diagram by running:

```bash
curl -s -X POST "https://eulard.kelihi.com/api/diagrams" \
  -H "Authorization: Bearer $EULARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"<TITLE>","code":"<MERMAID_CODE>"}'
```

Make sure to properly escape the JSON (especially newlines in mermaid code — use `\n`).

5. Parse the JSON response and display:
   - Diagram ID
   - Title
   - Editor link: `https://eulard.kelihi.com/editor/<id>`
   - The mermaid code in a code block
