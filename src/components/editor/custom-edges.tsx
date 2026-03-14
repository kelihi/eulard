"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
} from "@xyflow/react";

export interface CustomEdgeData {
  edgeLabel?: string;
  edgeId: string;
  mermaidEdgeType: string;
  onRenameEdge?: (edgeId: string, newLabel: string) => void;
  [key: string]: unknown;
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
}: EdgeProps) {
  const edgeData = data as unknown as CustomEdgeData;
  const label = edgeData?.edgeLabel ?? "";
  const onRenameEdge = edgeData?.onRenameEdge;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
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
        style={style}
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
              className="cursor-pointer rounded bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground)] border border-[var(--border)] shadow-sm hover:border-[var(--primary)] transition-colors"
              style={{ fontSize: "11px" }}
            >
              {label}
            </div>
          ) : (
            <div
              onDoubleClick={handleDoubleClick}
              className={`cursor-pointer rounded bg-[var(--background)] px-1.5 py-0.5 text-xs transition-opacity ${
                isHovered ? "opacity-70" : "opacity-0"
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
