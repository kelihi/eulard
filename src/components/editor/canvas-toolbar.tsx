"use client";

import type { MermaidNodeType } from "@/types/graph";
import { Copy, Plus, Trash2 } from "lucide-react";

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
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  onDeleteNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

export function CanvasToolbar({
  onAddNode,
  selectedNodeId = null,
  selectedEdgeId = null,
  onDeleteNode,
  onDuplicateNode,
  onDeleteEdge,
}: Props) {
  const hasNodeSelection = selectedNodeId !== null;
  const hasEdgeSelection = selectedEdgeId !== null;

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
      {hasNodeSelection && (
        <>
          <button
            type="button"
            onClick={() => {
              if (selectedNodeId && onDuplicateNode) onDuplicateNode(selectedNodeId);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--muted)]"
            aria-label="Duplicate selected node"
          >
            <Copy size={12} />
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedNodeId && onDeleteNode) onDeleteNode(selectedNodeId);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--muted)] text-[var(--destructive,#dc2626)]"
            aria-label="Delete selected node"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </>
      )}
      {!hasNodeSelection && hasEdgeSelection && (
        <button
          type="button"
          onClick={() => {
            if (selectedEdgeId && onDeleteEdge) onDeleteEdge(selectedEdgeId);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-[var(--muted)] text-[var(--destructive,#dc2626)]"
          aria-label="Delete selected edge"
        >
          <Trash2 size={12} />
          Delete Edge
        </button>
      )}
    </div>
  );
}
