---
description: Delete a diagram from Eulard (owner only, irreversible)
argument-hint: <diagram-id>
allowed-tools: [Bash]
---

Delete a diagram from Eulard. This is irreversible.

## Instructions

1. Check that `EULARD_API_KEY` is set. If not, tell the user to set it: `export EULARD_API_KEY="eul_..."`.

2. Extract the diagram ID from `$ARGUMENTS`. If no ID provided, tell the user to provide one.

3. First, fetch the diagram to show what will be deleted:

```bash
curl -s "https://eulard.kelihi.com/api/diagrams/<ID>" \
  -H "Authorization: Bearer $EULARD_API_KEY"
```

4. Display the diagram title and a preview of the code, then ask the user to confirm deletion.

5. Only after confirmation, delete:

```bash
curl -s -X DELETE "https://eulard.kelihi.com/api/diagrams/<ID>" \
  -H "Authorization: Bearer $EULARD_API_KEY"
```

6. Confirm the deletion was successful.
