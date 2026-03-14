"use client";

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { FlowNodeData } from "@/lib/parser/graph-to-reactflow";

function DefaultNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="px-4 py-2 rounded border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm min-w-[60px] text-center">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      {nodeData.label}
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
        {nodeData.label}
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
      {nodeData.label}
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--primary)] !w-2 !h-2" />
    </div>
  );
}

function SubroutineNode({ data }: NodeProps) {
  const nodeData = data as unknown as FlowNodeData;
  return (
    <div className="px-4 py-2 border-2 border-[var(--border)] bg-[var(--background)] text-sm font-medium shadow-sm min-w-[60px] text-center border-double border-4">
      <Handle type="target" position={Position.Top} className="!bg-[var(--primary)] !w-2 !h-2" />
      {nodeData.label}
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
        {nodeData.label}
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
      {nodeData.label}
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
