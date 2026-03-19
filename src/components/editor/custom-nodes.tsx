"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Handle, Position, useNodeId } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/parser/graph-to-reactflow";
import { useDiagramStore } from "@/stores/diagram-store";
import type { NodeStyleOverride, DiagramStyles } from "@/types/graph";

/**
 * Convert <br/> tags in a label to newline characters for rendering
 * with CSS white-space: pre-line.
 */
function labelToDisplay(label: string): string {
  return label.replace(/<br\s*\/?>/gi, "\n");
}


function EditableLabel({
  label,
  onRenameNode,
  isLocked,
}: {
  label: string;
  onRenameNode?: (nodeId: string, newLabel: string) => void;
  isLocked?: boolean;
}) {
  const nodeId = useNodeId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setValue(label);
  }, [label, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== label && nodeId && onRenameNode) {
      onRenameNode(nodeId, trimmed);
    } else {
      setValue(label);
    }
  }, [value, label, nodeId, onRenameNode]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isLocked) return;
      e.stopPropagation();
      setEditing(true);
    },
    [isLocked]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setValue(label);
        setEditing(false);
      }
    },
    [commit, label]
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="bg-transparent border-b border-[var(--primary)] outline-none text-sm font-medium text-center w-full min-w-[40px]"
        style={{ width: `${Math.max(value.length, 3)}ch` }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className="cursor-default select-none"
      style={{ whiteSpace: "pre-line" }}
    >
      {labelToDisplay(label)}
    </span>
  );
}

function useNodeStyles(nodeId: string | null): React.CSSProperties {
  const styleOverridesJson = useDiagramStore((s) => s.diagram?.styleOverrides ?? null);
  return useMemo(() => {
    if (!styleOverridesJson || !nodeId) return {};
    try {
      const styles = JSON.parse(styleOverridesJson) as DiagramStyles;
      const globalNode = styles.globalNode ?? {};
      const nodeOverride = styles.nodes?.[nodeId] ?? {};
      const merged: NodeStyleOverride = { ...globalNode, ...nodeOverride };
      const css: React.CSSProperties = {};
      if (merged.fontFamily) css.fontFamily = merged.fontFamily;
      if (merged.fontSize) css.fontSize = `${merged.fontSize}px`;
      if (merged.fontColor) css.color = merged.fontColor;
      if (merged.backgroundColor) css.backgroundColor = merged.backgroundColor;
      if (merged.borderColor) css.borderColor = merged.borderColor;
      return css;
    } catch {
      return {};
    }
  }, [styleOverridesJson, nodeId]);
}

function DefaultNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <div
      className={`px-4 py-2 rounded border-2 bg-[var(--background)] text-sm font-medium shadow-sm text-center whitespace-normal break-words overflow-hidden w-full h-full flex items-center justify-center ${
        selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-40" : "border-[var(--border)]"
      }`}
      style={nodeStyles}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function DecisionNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <polygon
          points="50,2 98,50 50,98 2,50"
          fill={nodeStyles.backgroundColor ?? "var(--background)"}
          stroke={selected ? "var(--primary)" : (nodeStyles.borderColor ?? "var(--border)")}
          strokeWidth={selected ? "3" : "2"}
          vectorEffect="non-scaling-stroke"
        />
        {selected && (
          <polygon
            points="50,2 98,50 50,98 2,50"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="6"
            strokeOpacity="0.3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <span
        className="relative z-10 text-sm font-medium text-center px-4 whitespace-normal break-words overflow-hidden"
        style={{ maxWidth: '55%', fontFamily: nodeStyles.fontFamily, fontSize: nodeStyles.fontSize, color: nodeStyles.color }}
      >
        <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function StadiumNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <div
      className={`px-4 py-2 rounded-full border-2 bg-[var(--background)] text-sm font-medium shadow-sm text-center whitespace-normal break-words overflow-hidden w-full h-full flex items-center justify-center ${
        selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-40" : "border-[var(--border)]"
      }`}
      style={nodeStyles}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function SubroutineNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <div
      className={`px-4 py-2 border-double border-4 bg-[var(--background)] text-sm font-medium shadow-sm text-center whitespace-normal break-words overflow-hidden w-full h-full flex items-center justify-center ${
        selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-40" : "border-[var(--border)]"
      }`}
      style={nodeStyles}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function CylinderNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <div
        className={`px-4 py-3 border-2 bg-[var(--background)] text-sm font-medium shadow-sm text-center rounded-b-[50%] rounded-t-[50%] whitespace-normal break-words w-full h-full flex items-center justify-center ${
          selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-40" : "border-[var(--border)]"
        }`}
        style={nodeStyles}
      >
        <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function CircleNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  const nodeId = useNodeId();
  const nodeStyles = useNodeStyles(nodeId);
  return (
    <div
      className={`rounded-full border-2 bg-[var(--background)] text-sm font-medium shadow-sm flex items-center justify-center text-center whitespace-normal break-words p-2 w-full h-full ${
        selected ? "border-[var(--primary)] ring-2 ring-[var(--primary)] ring-opacity-40" : "border-[var(--border)]"
      }`}
      style={nodeStyles}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

export const customNodeTypes = {
  default: DefaultNode,
  decision: DecisionNode,
  stadium: StadiumNode,
  subroutine: SubroutineNode,
  cylinder: CylinderNode,
  circle: CircleNode,
};
