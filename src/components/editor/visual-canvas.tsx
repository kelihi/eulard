"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useDiagramStore } from "@/stores/diagram-store";
import { mermaidToGraph } from "@/lib/parser/mermaid-to-graph";
import { graphToReactFlow } from "@/lib/parser/graph-to-reactflow";
import { graphToMermaid } from "@/lib/parser/graph-to-mermaid";
import { autoLayout } from "@/lib/parser/auto-layout";
import { updateGraphPositions } from "@/lib/parser/reactflow-to-graph";
import { customNodeTypes } from "./custom-nodes";
import type { FlowchartGraph } from "@/types/graph";

function buildPositionMap(nodes: Node[]): Record<string, { x: number; y: number }> {
  const map: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    map[n.id] = { x: n.position.x, y: n.position.y };
  }
  return map;
}

export function VisualCanvas() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const positions = useDiagramStore((s) => s.diagram?.positions ?? null);
  const setCode = useDiagramStore((s) => s.setCode);
  const setPositions = useDiagramStore((s) => s.setPositions);
  const syncState = useDiagramStore((s) => s.syncState);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const graphRef = useRef<FlowchartGraph | null>(null);
  const generationRef = useRef(0);
  const isDraggingRef = useRef(false);
  const codeFromCanvasRef = useRef<string | null>(null);

  const isLocked = syncState === "ai-streaming";

  // Rename node callback — passed into custom nodes via data
  const onRenameNode = useCallback(
    (nodeId: string, newLabel: string) => {
      if (!graphRef.current) return;

      const updatedGraph: FlowchartGraph = {
        ...graphRef.current,
        nodes: graphRef.current.nodes.map((n) =>
          n.id === nodeId ? { ...n, label: newLabel } : n
        ),
      };
      graphRef.current = updatedGraph;

      const newCode = graphToMermaid(updatedGraph);
      codeFromCanvasRef.current = newCode;
      setCode(newCode);

      // Update React Flow nodes directly so the label updates visually
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, label: newLabel } }
            : n
        )
      );
    },
    [setCode]
  );

  // Parse code to graph, then to React Flow — debounced
  useEffect(() => {
    // Skip if this code change originated from the canvas
    if (codeFromCanvasRef.current === code) {
      codeFromCanvasRef.current = null;
      return;
    }

    const generation = ++generationRef.current;

    const timer = setTimeout(() => {
      if (generation !== generationRef.current) return;
      if (isDraggingRef.current) return;

      const graph = mermaidToGraph(code);
      if (!graph) return;

      // Check if stored positions exist in the database
      let savedPositions: Record<string, { x: number; y: number }> | null = null;
      if (positions) {
        try {
          savedPositions = JSON.parse(positions) as Record<string, { x: number; y: number }>;
        } catch {
          // ignore invalid JSON
        }
      }

      // Apply auto-layout if nodes have no positions (all at 0,0)
      const allAtOrigin = graph.nodes.every(
        (n) => n.position.x === 0 && n.position.y === 0
      );

      let layoutGraph = allAtOrigin ? autoLayout(graph) : graph;

      // If saved positions exist, apply them to matching nodes
      if (savedPositions) {
        layoutGraph = {
          ...layoutGraph,
          nodes: layoutGraph.nodes.map((n) => {
            const saved = savedPositions[n.id];
            return saved ? { ...n, position: { x: saved.x, y: saved.y } } : n;
          }),
        };
      } else if (graphRef.current && !allAtOrigin) {
        // Preserve previous in-memory positions for existing nodes
        const prevPositions = new Map(
          graphRef.current.nodes.map((n) => [n.id, n.position])
        );
        layoutGraph = {
          ...layoutGraph,
          nodes: layoutGraph.nodes.map((n) => ({
            ...n,
            position: prevPositions.get(n.id) ?? n.position,
          })),
        };
      }

      graphRef.current = layoutGraph;
      const { nodes: newNodes, edges: newEdges } = graphToReactFlow(layoutGraph, onRenameNode, isLocked);
      setNodes(newNodes);
      setEdges(newEdges);
    }, 400);

    return () => clearTimeout(timer);
  }, [code, positions, onRenameNode, isLocked]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (isLocked) return;

      // Track dragging state
      const hasDragStart = changes.some(
        (c) => c.type === "position" && c.dragging === true
      );
      const hasDragEnd = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );

      if (hasDragStart) isDraggingRef.current = true;

      setNodes((prevNodes) => {
        const updatedNodes = applyNodeChanges(changes, prevNodes);

        if (hasDragEnd) {
          isDraggingRef.current = false;

          // Sync positions back to code
          if (graphRef.current) {
            const updatedGraph = updateGraphPositions(
              graphRef.current,
              updatedNodes
            );
            graphRef.current = updatedGraph;
            const newCode = graphToMermaid(updatedGraph);
            codeFromCanvasRef.current = newCode;
            setCode(newCode);

            // Persist positions to the database
            const positionMap = buildPositionMap(updatedNodes);
            setPositions(JSON.stringify(positionMap));
          }
        }

        return updatedNodes;
      });
    },
    [isLocked, setCode, setPositions]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isLocked) return;
      setEdges((prevEdges) => applyEdgeChanges(changes, prevEdges));
    },
    [isLocked]
  );

  return (
    <div className="h-full w-full relative">
      {isLocked && (
        <div className="absolute inset-0 z-10 bg-[var(--background)]/50 flex items-center justify-center">
          <span className="text-sm text-[var(--primary)] font-medium animate-pulse">
            AI is editing...
          </span>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={customNodeTypes}
        fitView
        nodesDraggable={!isLocked}
        nodesConnectable={false}
        elementsSelectable={!isLocked}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeStrokeColor="var(--border)"
          nodeColor="var(--background)"
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}
