---
name: eulard
description: Use when the user asks to create, view, update, or manage diagrams, mentions "eulard", asks for mermaid diagrams, flowcharts, sequence diagrams, ER diagrams, architecture diagrams, or any visual diagram that can be represented in mermaid syntax.
---

# Eulard — AI Diagram Editor

Eulard is a collaborative AI-powered diagram editor at https://eulard.kelihi.com. It stores and renders mermaid diagrams with a visual editor, AI chat, and sharing.

## Available Commands

| Command | Purpose |
|---------|---------|
| `/eulard-create <description or mermaid>` | Create a new diagram |
| `/eulard-list [search query]` | List or search diagrams |
| `/eulard-get <id>` | Get a diagram's code and metadata |
| `/eulard-update <id> <changes>` | Update a diagram |
| `/eulard-delete <id>` | Delete a diagram |

## Direct API Access

All endpoints are at `https://eulard.kelihi.com/api/` and require `Authorization: Bearer $EULARD_API_KEY`.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/diagrams` | List all diagrams |
| POST | `/api/diagrams` | Create diagram `{title, code, folderId?}` |
| GET | `/api/diagrams/<id>` | Get diagram with code |
| PUT | `/api/diagrams/<id>` | Update `{title?, code?, orgShared?}` |
| DELETE | `/api/diagrams/<id>` | Delete diagram |
| GET | `/api/diagrams/search?q=<term>` | Search by title/code |
| GET | `/api/me` | Current user info |

## When to Use Eulard

- User asks to "create a diagram" or "make a flowchart" — use `/eulard-create`
- User asks to "show my diagrams" or "find a diagram" — use `/eulard-list`
- User provides a diagram ID or asks to see a specific diagram — use `/eulard-get`
- User wants to modify an existing diagram — use `/eulard-update`
- User asks to visualize a process, architecture, data flow, or any system — use `/eulard-create` with a natural language description

## Supported Diagram Types

Eulard supports all mermaid diagram types:
- `flowchart` — processes, workflows, decision trees, architectures
- `sequenceDiagram` — message passing between systems/actors
- `erDiagram` — database schemas and entity relationships
- `stateDiagram-v2` — state machines and lifecycle transitions
- `classDiagram` — object-oriented design
- `gantt` — project timelines
- `pie` — proportional data
