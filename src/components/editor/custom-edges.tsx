"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
  Position,
  type EdgeProps,
} from "@xyflow/react";
import { useDiagramStore } from "@/stores/diagram-store";
import type { EdgeStyleOverride, DiagramStyles } from "@/types/graph";

export interface CustomEdgeData {
  edgeLabel?: string;
  edgeId: string;
  mermaidEdgeType: string;
  onRenameEdge?: (edgeId: string, newLabel: string) => void;
  [key: string]: unknown;
}

function useEdgeStyles(edgeId: string): { pathStyle: React.CSSProperties; labelStyle: React.CSSProperties } {
  const styleOverridesJson = useDiagramStore((s) => s.diagram?.styleOverrides ?? null);
  return useMemo(() => {
    if (!styleOverridesJson) return { pathStyle: {}, labelStyle: {} };
    try {
      const styles = JSON.parse(styleOverridesJson) as DiagramStyles;
      const globalEdge = styles.globalEdge ?? {};
      const edgeOverride = styles.edges?.[edgeId] ?? {};
      const merged: EdgeStyleOverride = { ...globalEdge, ...edgeOverride };
      const pathStyle: React.CSSProperties = {};
      const labelStyle: React.CSSProperties = {};
      if (merged.lineColor) pathStyle.stroke = merged.lineColor;
      if (merged.lineThickness) pathStyle.strokeWidth = merged.lineThickness;
      if (merged.fontFamily) labelStyle.fontFamily = merged.fontFamily;
      if (merged.fontSize) labelStyle.fontSize = `${merged.fontSize}px`;
      if (merged.fontColor) labelStyle.color = merged.fontColor;
      return { pathStyle, labelStyle };
    } catch {
      return { pathStyle: {}, labelStyle: {} };
    }
  }, [styleOverridesJson, edgeId]);
}

/**
 * Build an SVG path string from a series of waypoints with rounded corners.
 */
function buildRoundedPath(
  points: { x: number; y: number }[],
  radius: number
): string {
  if (points.length < 2) return "";

  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Direction vectors from curr to prev and curr to next
    const dxPrev = prev.x - curr.x;
    const dyPrev = prev.y - curr.y;
    const dxNext = next.x - curr.x;
    const dyNext = next.y - curr.y;

    const lenPrev = Math.sqrt(dxPrev * dxPrev + dyPrev * dyPrev);
    const lenNext = Math.sqrt(dxNext * dxNext + dyNext * dyNext);

    // Skip degenerate zero-length segments
    if (lenPrev === 0 || lenNext === 0) {
      parts.push(`L ${curr.x} ${curr.y}`);
      continue;
    }

    // Clamp radius so it doesn't exceed half of either segment
    const r = Math.min(radius, lenPrev / 2, lenNext / 2);

    // Points where the arc starts and ends
    const startX = curr.x + (dxPrev / lenPrev) * r;
    const startY = curr.y + (dyPrev / lenPrev) * r;
    const endX = curr.x + (dxNext / lenNext) * r;
    const endY = curr.y + (dyNext / lenNext) * r;

    parts.push(`L ${startX} ${startY}`);
    parts.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`);
  }

  const last = points[points.length - 1];
  parts.push(`L ${last.x} ${last.y}`);

  return parts.join(" ");
}

function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
  selected,
}: EdgeProps) {
  const edgeData = data as unknown as CustomEdgeData;
  const label = edgeData?.edgeLabel ?? "";
  const onRenameEdge = edgeData?.onRenameEdge;
  const { pathStyle, labelStyle } = useEdgeStyles(edgeData?.edgeId ?? id);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect backward/loop edges where the target is above or beside the source
  // in ways that make getSmoothStepPath produce awkward routing.
  const isBackwardEdge =
    (sourcePosition === Position.Bottom && targetPosition === Position.Top && sourceY > targetY - 20) ||
    (sourcePosition === Position.Right && targetPosition === Position.Left && sourceX > targetX - 20);

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (isBackwardEdge) {
    // Custom routing for backward edges: route around the side of nodes
    const OFFSET = 40; // How far the path extends beyond the nodes
    const RADIUS = 8;

    if (sourcePosition === Position.Bottom && targetPosition === Position.Top) {
      // TB layout: source bottom -> go down -> route right/left -> go up -> target top
      const goRight = targetX >= sourceX;
      const sideX = goRight
        ? Math.max(sourceX, targetX) + OFFSET
        : Math.min(sourceX, targetX) - OFFSET;
      const downY = sourceY + OFFSET;
      const upY = targetY - OFFSET;

      edgePath = buildRoundedPath([
        { x: sourceX, y: sourceY },
        { x: sourceX, y: downY },
        { x: sideX, y: downY },
        { x: sideX, y: upY },
        { x: targetX, y: upY },
        { x: targetX, y: targetY },
      ], RADIUS);

      labelX = sideX;
      labelY = (downY + upY) / 2;
    } else {
      // LR layout: source right -> go right -> route up/down -> go left -> target left
      const goDown = targetY >= sourceY;
      const sideY = goDown
        ? Math.max(sourceY, targetY) + OFFSET
        : Math.min(sourceY, targetY) - OFFSET;
      const rightX = sourceX + OFFSET;
      const leftX = targetX - OFFSET;

      edgePath = buildRoundedPath([
        { x: sourceX, y: sourceY },
        { x: rightX, y: sourceY },
        { x: rightX, y: sideY },
        { x: leftX, y: sideY },
        { x: leftX, y: targetY },
        { x: targetX, y: targetY },
      ], RADIUS);

      labelX = (rightX + leftX) / 2;
      labelY = sideY;
    }
  } else {
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 8,
    });
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== label && onRenameEdge) {
      onRenameEdge(edgeData.edgeId, trimmed);
    }
  }, [editValue, label, onRenameEdge, edgeData.edgeId]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue(label);
  }, [label]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setEditValue(label);
      setIsEditing(true);
    },
    [label]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        commitEdit();
      } else if (e.key === "Escape") {
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit]
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          ...pathStyle,
          ...(selected ? { stroke: "var(--primary)", strokeWidth: 3 } : {}),
        }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              className="rounded border border-[var(--primary)] bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground)] shadow-md outline-none min-w-[60px] text-center"
              style={{ fontSize: "11px" }}
            />
          ) : label ? (
            <div
              onDoubleClick={handleDoubleClick}
              className="cursor-pointer rounded-full bg-[var(--background)] px-2.5 py-1 text-xs text-[var(--foreground)] border border-[var(--border)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:border-[var(--primary)] hover:shadow-[0_2px_6px_rgba(99,102,241,0.1)] transition-all duration-150"
              style={{ fontSize: "11px", ...labelStyle }}
            >
              {label}
            </div>
          ) : (
            <div
              onDoubleClick={handleDoubleClick}
              className={`cursor-pointer rounded-full bg-[var(--background)] px-2 py-0.5 text-xs border border-transparent transition-all duration-150 ${
                isHovered ? "opacity-70 border-[var(--border)]" : "opacity-0"
              }`}
              style={{ fontSize: "10px" }}
            >
              <span className="text-[var(--muted-foreground)]">+ label</span>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const customEdgeTypes = {
  custom: EditableEdge,
};
