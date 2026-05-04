"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useDiagramStore } from "@/stores/diagram-store";
import { mermaidToGraph } from "@/lib/parser/mermaid-to-graph";
import { graphToReactFlow, estimateNodeSize } from "@/lib/parser/graph-to-reactflow";
import { graphToMermaid } from "@/lib/parser/graph-to-mermaid";
import { autoLayout } from "@/lib/parser/auto-layout";
import { updateGraphPositions } from "@/lib/parser/reactflow-to-graph";
import { customNodeTypes } from "./custom-nodes";
import { customEdgeTypes } from "./custom-edges";
import { NodeContextMenu } from "./node-context-menu";
import { CanvasToolbar } from "./canvas-toolbar";
import type { FlowchartGraph, GraphNode } from "@/types/graph";
import type { MermaidNodeType } from "@/types/graph";

interface ContextMenuState {
  nodeId: string;
  nodeLabel: string;
  x: number;
  y: number;
}

function generateNodeId(existing: GraphNode[]): string {
  const used = new Set(existing.map((n) => n.id));
  for (let i = 1; i < 1000; i++) {
    const id = `N${i}`;
    if (!used.has(id)) return id;
  }
  return `N${Date.now()}`;
}

export function VisualCanvas() {
  return (
    <ReactFlowProvider>
      <VisualCanvasInner />
    </ReactFlowProvider>
  );
}

function VisualCanvasInner() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const setCode = useDiagramStore((s) => s.setCode);
  const syncState = useDiagramStore((s) => s.syncState);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const graphRef = useRef<FlowchartGraph | null>(null);
  const generationRef = useRef(0);
  const isDraggingRef = useRef(false);
  const codeFromCanvasRef = useRef<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selection, setSelection] = useState<{
    nodeId: string | null;
    edgeId: string | null;
  }>({ nodeId: null, edgeId: null });

  const { screenToFlowPosition } = useReactFlow();

  const isLocked = syncState === "ai-streaming";

  // Sync code back to store from graph
  const syncGraphToCode = useCallback(
    (updatedGraph: FlowchartGraph) => {
      graphRef.current = updatedGraph;
      const newCode = graphToMermaid(updatedGraph);
      codeFromCanvasRef.current = newCode;
      setCode(newCode);
    },
    [setCode]
  );

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
      syncGraphToCode(updatedGraph);

      // Update React Flow nodes directly so the label updates visually
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const nodeType = (n.data as { mermaidType?: string }).mermaidType ?? n.type ?? "default";
          const base = estimateNodeSize(newLabel);
          let width = base.width;
          let height = base.height;
          if (nodeType === "decision") {
            width = Math.max(120, base.width * 1.6);
            height = Math.max(80, base.height * 1.6);
          } else if (nodeType === "circle") {
            const diameter = Math.max(64, Math.ceil(Math.sqrt(base.width * base.width + base.height * base.height) * 0.75));
            width = diameter;
            height = diameter;
          }
          return { ...n, width, height, data: { ...n.data, label: newLabel } };
        })
      );
    },
    [syncGraphToCode]
  );

  // Edge rename handler — passed into edge data
  const handleRenameEdge = useCallback(
    (edgeId: string, newLabel: string) => {
      if (!graphRef.current || isLocked) return;
      const updatedGraph: FlowchartGraph = {
        ...graphRef.current,
        edges: graphRef.current.edges.map((e) =>
          e.id === edgeId ? { ...e, label: newLabel || undefined } : e
        ),
      };
      syncGraphToCode(updatedGraph);
      // Also update React Flow edges for immediate visual feedback
      setEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? { ...e, data: { ...e.data, edgeLabel: newLabel } }
            : e
        )
      );
    },
    [isLocked, syncGraphToCode]
  );

  // Inject onRenameEdge callback into edge data after edges are set
  const injectEdgeCallbacks = useCallback(
    (rawEdges: Edge[]): Edge[] =>
      rawEdges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          onRenameEdge: handleRenameEdge,
        },
      })),
    [handleRenameEdge]
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

      // Apply auto-layout if nodes have no positions (all at 0,0)
      const allAtOrigin = graph.nodes.every(
        (n) => n.position.x === 0 && n.position.y === 0
      );

      let layoutGraph = allAtOrigin ? autoLayout(graph) : graph;

      if (graphRef.current && !allAtOrigin) {
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
      setEdges(injectEdgeCallbacks(newEdges));
    }, 400);

    return () => clearTimeout(timer);
  }, [code, onRenameNode, isLocked, injectEdgeCallbacks]);

  // Re-inject edge callbacks when handleRenameEdge changes
  useEffect(() => {
    setEdges((prev) => injectEdgeCallbacks(prev));
  }, [injectEdgeCallbacks]);

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
      const hasResize = changes.some((c) => c.type === "dimensions");

      if (hasDragStart) isDraggingRef.current = true;

      setNodes((prevNodes) => {
        const updatedNodes = applyNodeChanges(changes, prevNodes);

        if (hasDragEnd) {
          isDraggingRef.current = false;
        }

        if ((hasDragEnd || hasResize) && graphRef.current) {
          const updatedGraph = updateGraphPositions(
            graphRef.current,
            updatedNodes
          );
          syncGraphToCode(updatedGraph);
        }

        return updatedNodes;
      });
    },
    [isLocked, syncGraphToCode]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (isLocked) return;
      setEdges((prevEdges) => applyEdgeChanges(changes, prevEdges));
    },
    [isLocked]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isLocked || !graphRef.current) return;
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const exists = graphRef.current.edges.some(
        (e) => e.source === connection.source && e.target === connection.target
      );
      if (exists) return;

      const updated: FlowchartGraph = {
        ...graphRef.current,
        edges: [
          ...graphRef.current.edges,
          {
            id: `e_user_${Date.now()}`,
            source: connection.source,
            target: connection.target,
            type: "arrow",
          },
        ],
      };
      syncGraphToCode(updated);
    },
    [isLocked, syncGraphToCode]
  );

  // Context menu handlers
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isLocked) return;
      event.preventDefault();
      const nodeData = node.data as { label?: string } | undefined;
      setContextMenu({
        nodeId: node.id,
        nodeLabel: (nodeData?.label as string) ?? node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [isLocked]
  );

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNodeRename = useCallback(
    (nodeId: string, newLabel: string) => {
      if (!graphRef.current || isLocked) return;
      const updatedGraph: FlowchartGraph = {
        ...graphRef.current,
        nodes: graphRef.current.nodes.map((n) =>
          n.id === nodeId ? { ...n, label: newLabel } : n
        ),
      };
      syncGraphToCode(updatedGraph);
      // Also update React Flow nodes for immediate visual feedback
      setNodes((prev) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          const nodeType = (n.data as { mermaidType?: string }).mermaidType ?? n.type ?? "default";
          const base = estimateNodeSize(newLabel);
          let width = base.width;
          let height = base.height;
          if (nodeType === "decision") {
            width = Math.max(120, base.width * 1.6);
            height = Math.max(80, base.height * 1.6);
          } else if (nodeType === "circle") {
            const diameter = Math.max(64, Math.ceil(Math.sqrt(base.width * base.width + base.height * base.height) * 0.75));
            width = diameter;
            height = diameter;
          }
          return { ...n, width, height, data: { ...n.data, label: newLabel } };
        })
      );
    },
    [isLocked, syncGraphToCode]
  );

  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      if (!graphRef.current || isLocked) return;
      const updatedGraph: FlowchartGraph = {
        ...graphRef.current,
        nodes: graphRef.current.nodes.filter((n) => n.id !== nodeId),
        edges: graphRef.current.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
      };
      syncGraphToCode(updatedGraph);
      // Update React Flow state immediately
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) =>
        prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
    },
    [isLocked, syncGraphToCode]
  );

  const handleNodeChangeShape = useCallback(
    (nodeId: string, newType: MermaidNodeType) => {
      if (!graphRef.current || isLocked) return;
      const updatedGraph: FlowchartGraph = {
        ...graphRef.current,
        nodes: graphRef.current.nodes.map((n) =>
          n.id === nodeId ? { ...n, type: newType } : n
        ),
      };
      syncGraphToCode(updatedGraph);
      // Update React Flow nodes for immediate visual feedback
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, type: newType, data: { ...n.data, mermaidType: newType } }
            : n
        )
      );
    },
    [isLocked, syncGraphToCode]
  );

  const handleNodeSetColor = useCallback(
    (nodeId: string, fill: string | null, stroke: string | null) => {
      if (!graphRef.current || isLocked) return;
      const updated: FlowchartGraph = {
        ...graphRef.current,
        nodes: graphRef.current.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const style = { ...(n.style ?? {}) };
          if (fill === null) delete style.backgroundColor;
          else style.backgroundColor = fill;
          if (stroke === null) delete style.borderColor;
          else style.borderColor = stroke;
          return Object.keys(style).length > 0
            ? { ...n, style }
            : { ...n, style: undefined };
        }),
      };
      syncGraphToCode(updated);
    },
    [isLocked, syncGraphToCode]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      if (!graphRef.current || isLocked) return;
      const original = graphRef.current.nodes.find((n) => n.id === id);
      if (!original) return;
      const newId = generateNodeId(graphRef.current.nodes);
      const updated: FlowchartGraph = {
        ...graphRef.current,
        nodes: [
          ...graphRef.current.nodes,
          {
            ...original,
            id: newId,
            label: newId,
            position: {
              x: original.position.x + 40,
              y: original.position.y + 40,
            },
          },
        ],
      };
      syncGraphToCode(updated);
    },
    [isLocked, syncGraphToCode]
  );

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      if (!graphRef.current || isLocked) return;
      const updated: FlowchartGraph = {
        ...graphRef.current,
        edges: graphRef.current.edges.filter((e) => e.id !== edgeId),
      };
      syncGraphToCode(updated);
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      setSelection((prev) =>
        prev.edgeId === edgeId ? { ...prev, edgeId: null } : prev
      );
    },
    [isLocked, syncGraphToCode]
  );

  const onSelectionChange = useCallback(
    (sel: { nodes: Node[]; edges: Edge[] }) => {
      setSelection({
        nodeId: sel.nodes[0]?.id ?? null,
        edgeId: sel.edges[0]?.id ?? null,
      });
    },
    []
  );

  // Close context menu on pane click
  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Double-click empty pane to add a new node
  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.classList.contains("react-flow__pane")) return;
      if (isLocked || !graphRef.current) return;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const newId = generateNodeId(graphRef.current.nodes);
      const newNode: GraphNode = {
        id: newId,
        label: newId,
        type: "default",
        position: { x: Math.round(pos.x), y: Math.round(pos.y) },
      };
      const updatedGraph: FlowchartGraph = {
        ...graphRef.current,
        nodes: [...graphRef.current.nodes, newNode],
      };
      syncGraphToCode(updatedGraph);
    },
    [isLocked, screenToFlowPosition, syncGraphToCode]
  );

  return (
    <div className="h-full w-full relative">
      <CanvasToolbar
        onAddNode={(shape) => {
          if (!graphRef.current) return;
          const id = generateNodeId(graphRef.current.nodes);
          const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
          const updated: FlowchartGraph = {
            ...graphRef.current,
            nodes: [
              ...graphRef.current.nodes,
              { id, label: id, type: shape, position: { x: Math.round(center.x), y: Math.round(center.y) } },
            ],
          };
          syncGraphToCode(updated);
        }}
        selectedNodeId={isLocked ? null : selection.nodeId}
        selectedEdgeId={isLocked ? null : selection.edgeId}
        onDeleteNode={handleNodeDelete}
        onDuplicateNode={handleDuplicate}
        onDeleteEdge={handleEdgeDelete}
      />
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
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onDoubleClick={onPaneDoubleClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={customNodeTypes}
        edgeTypes={customEdgeTypes}
        fitView
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
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
      {contextMenu && !isLocked && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          nodeLabel={contextMenu.nodeLabel}
          x={contextMenu.x}
          y={contextMenu.y}
          onRename={handleNodeRename}
          onDelete={handleNodeDelete}
          onChangeShape={handleNodeChangeShape}
          onSetColor={handleNodeSetColor}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
}
