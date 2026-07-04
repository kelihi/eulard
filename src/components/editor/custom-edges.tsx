"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge,
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

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

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
