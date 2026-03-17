---
description: Get a diagram from Eulard by ID, showing its mermaid code and metadata
argument-hint: <diagram-id>
allowed-tools: [Bash]
---

Get a diagram from Eulard and display its contents.

## Instructions

1. Check that `EULARD_API_KEY` is set. If not, tell the user to set it: `export EULARD_API_KEY="eul_..."`.

2. Extract the diagram ID from `$ARGUMENTS`. If no ID provided, tell the user to provide one (suggest running `/eulard-list` first).

3. Fetch the diagram:

```bash
curl -s "https://eulard.kelihi.com/api/diagrams/<ID>" \
  -H "Authorization: Bearer $EULARD_API_KEY"
```

4. If the response contains an error, display it clearly.

5. Otherwise, display:
   - **Title**
   - **ID**
   - **Editor link**: `https://eulard.kelihi.com/editor/<id>`
   - **Permission**: owner / edit / view
   - **Created**: date
   - **Updated**: date
   - **Mermaid code** in a fenced code block with `mermaid` language tag
