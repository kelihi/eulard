---
description: Update an existing diagram in Eulard (title, code, or both)
argument-hint: <diagram-id> <changes description or new mermaid code>
allowed-tools: [Bash]
---

Update an existing diagram in Eulard.

## Instructions

1. Check that `EULARD_API_KEY` is set. If not, tell the user to set it: `export EULARD_API_KEY="eul_..."`.

2. Parse `$ARGUMENTS`:
   - First token is the diagram ID
   - Everything after is the change description or new mermaid code

3. Fetch the current diagram to understand what exists:

```bash
curl -s "https://eulard.kelihi.com/api/diagrams/<ID>" \
  -H "Authorization: Bearer $EULARD_API_KEY"
```

4. Determine the update:
   - If the remaining arguments are raw mermaid code (starts with `flowchart`, `sequenceDiagram`, etc.), use that as the new code directly.
   - If it's a natural language description of changes, read the current mermaid code from the response, apply the requested changes, and generate updated mermaid code.
   - If it looks like just a new title (short, no mermaid keywords), update only the title.

5. Send the update:

```bash
curl -s -X PUT "https://eulard.kelihi.com/api/diagrams/<ID>" \
  -H "Authorization: Bearer $EULARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"<NEW_TITLE>","code":"<NEW_CODE>"}'
```

Only include fields that are changing. Properly escape JSON.

6. Display the updated diagram:
   - Title
   - Editor link: `https://eulard.kelihi.com/editor/<id>`
   - Updated mermaid code in a code block
