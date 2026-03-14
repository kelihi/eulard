"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Handle, Position, useNodeId } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/parser/graph-to-reactflow";

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
    <span onDoubleClick={handleDoubleClick} className="cursor-default select-none">
      {label}
    </span>
  );
}

function DefaultNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="px-4 py-2 rounded border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm min-w-[60px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function DecisionNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 80 }}>
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <svg viewBox="0 0 120 80" className="absolute inset-0 w-full h-full">
        <polygon
          points="60,2 118,40 60,78 2,40"
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth="2"
        />
      </svg>
      <span className="relative z-10 text-sm font-medium text-center px-4">
        <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      </span>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function StadiumNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="px-4 py-2 rounded-full border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm min-w-[60px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function SubroutineNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="px-4 py-2 border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm min-w-[60px] text-center border-double border-4">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function CylinderNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="relative flex items-center justify-center" style={{ minWidth: 80, minHeight: 60 }}>
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      <div className="px-4 py-3 border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm text-center rounded-b-[50%] rounded-t-[50%]">
        <EditableLabel label={nodeData.label} onRenameNode={nodeData.onRenameNode} isLocked={nodeData.isLocked} />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function CircleNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm flex items-center justify-center text-center">
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
