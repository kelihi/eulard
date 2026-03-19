---
description: List diagrams in Eulard, optionally filtered by search query
argument-hint: [search query]
allowed-tools: [Bash]
---

List diagrams in Eulard.

## Instructions

1. Check that `EULARD_API_KEY` is set. If not, tell the user to set it: `export EULARD_API_KEY="eul_..."`.

2. If `$ARGUMENTS` is provided, search for diagrams:

```bash
curl -s "https://eulard.kelihi.com/api/diagrams/search?q=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("$ARGUMENTS"))')" \
  -H "Authorization: Bearer $EULARD_API_KEY"
```

3. If no arguments, list all diagrams:

```bash
curl -s "https://eulard.kelihi.com/api/diagrams" \
  -H "Authorization: Bearer $EULARD_API_KEY"
```

4. Format the results as a readable table with columns:
   - ID
   - Title
   - Last Updated
   - Shared (yes/no)
   - Permission (owner/edit/view)

5. If no diagrams found, say so clearly.
