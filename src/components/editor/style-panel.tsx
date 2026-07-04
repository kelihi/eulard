"use client";

import { useState, useCallback, useMemo } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import { mermaidToGraph } from "@/lib/parser/mermaid-to-graph";
import { stylesFromCode } from "@/lib/parser/annotations";
import type {
  NodeStyleOverride,
  EdgeStyleOverride,
} from "@/types/graph";
import {
  Paintbrush,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  X,
} from "lucide-react";

const FONT_OPTIONS = [
  { label: "System Default", value: "" },
  { label: "Sans-serif", value: "Arial, Helvetica, sans-serif" },
  { label: "Serif", value: "Georgia, Times New Roman, serif" },
  { label: "Monospace", value: "Courier New, monospace" },
];

const FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 16, 18, 20, 24];

const THICKNESS_OPTIONS = [
  { label: "Thin (1px)", value: 1 },
  { label: "Normal (2px)", value: 2 },
  { label: "Medium (3px)", value: 3 },
  { label: "Thick (4px)", value: 4 },
  { label: "Heavy (6px)", value: 6 },
];

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

function ColorInput({ label, value, onChange, onClear }: ColorInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--muted-foreground)] shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <div className="relative">
          <input
            type="color"
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 rounded border border-[var(--border)] cursor-pointer bg-transparent p-0"
            style={{ WebkitAppearance: "none" }}
          />
        </div>
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="auto"
          className="w-[72px] text-xs px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
        />
        {value && onClear && (
          <button
            onClick={onClear}
            className="p-0.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
            title="Reset to default"
          >
            <X size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

interface SelectInputProps {
  label: string;
  value: string | number;
  options: { label: string; value: string | number }[];
  onChange: (value: string) => void;
}

function SelectInput({ label, value, options, onChange }: SelectInputProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--muted-foreground)] shrink-0">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--primary)] max-w-[120px]"
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-2 pb-2 space-y-1.5">{children}</div>}
    </div>
  );
}

interface ObjectStyleSectionProps {
  title: string;
  objectId: string;
  objectLabel: string;
  nodeStyle?: NodeStyleOverride;
  edgeStyle?: EdgeStyleOverride;
  isEdge: boolean;
  onUpdateNodeStyle: (id: string, style: NodeStyleOverride) => void;
  onUpdateEdgeStyle: (id: string, style: EdgeStyleOverride) => void;
  onRemoveOverride: (id: string) => void;
}

function ObjectStyleSection({
  title,
  objectId,
  objectLabel,
  nodeStyle,
  edgeStyle,
  isEdge,
  onUpdateNodeStyle,
  onUpdateEdgeStyle,
  onRemoveOverride,
}: ObjectStyleSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-[var(--border)] rounded mt-1">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 flex-1 px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors"
        >
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span className="truncate" title={objectLabel}>
            {title}: {objectLabel}
          </span>
        </button>
        <button
          onClick={() => onRemoveOverride(objectId)}
          className="p-1 mr-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
          title="Remove style override"
        >
          <X size={10} />
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-[var(--border)]">
          {isEdge ? (
            <>
              <SelectInput
                label="Thickness"
                value={edgeStyle?.lineThickness ?? ""}
                options={[
                  { label: "Default", value: "" },
                  ...THICKNESS_OPTIONS,
                ]}
                onChange={(v) =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    lineThickness: v ? Number(v) : undefined,
                  })
                }
              />
              <ColorInput
                label="Line Color"
                value={edgeStyle?.lineColor ?? ""}
                onChange={(v) =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    lineColor: v,
                  })
                }
                onClear={() =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    lineColor: undefined,
                  })
                }
              />
              <SelectInput
                label="Font"
                value={edgeStyle?.fontFamily ?? ""}
                options={FONT_OPTIONS}
                onChange={(v) =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    fontFamily: v || undefined,
                  })
                }
              />
              <SelectInput
                label="Font Size"
                value={edgeStyle?.fontSize ?? ""}
                options={[
                  { label: "Default", value: "" },
                  ...FONT_SIZE_OPTIONS.map((s) => ({
                    label: `${s}px`,
                    value: s,
                  })),
                ]}
                onChange={(v) =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    fontSize: v ? Number(v) : undefined,
                  })
                }
              />
              <ColorInput
                label="Font Color"
                value={edgeStyle?.fontColor ?? ""}
                onChange={(v) =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    fontColor: v,
                  })
                }
                onClear={() =>
                  onUpdateEdgeStyle(objectId, {
                    ...edgeStyle,
                    fontColor: undefined,
                  })
                }
              />
            </>
          ) : (
            <>
              <SelectInput
                label="Font"
                value={nodeStyle?.fontFamily ?? ""}
                options={FONT_OPTIONS}
                onChange={(v) =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    fontFamily: v || undefined,
                  })
                }
              />
              <SelectInput
                label="Font Size"
                value={nodeStyle?.fontSize ?? ""}
                options={[
                  { label: "Default", value: "" },
                  ...FONT_SIZE_OPTIONS.map((s) => ({
                    label: `${s}px`,
                    value: s,
                  })),
                ]}
                onChange={(v) =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    fontSize: v ? Number(v) : undefined,
                  })
                }
              />
              <ColorInput
                label="Font Color"
                value={nodeStyle?.fontColor ?? ""}
                onChange={(v) =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    fontColor: v,
                  })
                }
                onClear={() =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    fontColor: undefined,
                  })
                }
              />
              <ColorInput
                label="Background"
                value={nodeStyle?.backgroundColor ?? ""}
                onChange={(v) =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    backgroundColor: v,
                  })
                }
                onClear={() =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    backgroundColor: undefined,
                  })
                }
              />
              <ColorInput
                label="Border"
                value={nodeStyle?.borderColor ?? ""}
                onChange={(v) =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    borderColor: v,
                  })
                }
                onClear={() =>
                  onUpdateNodeStyle(objectId, {
                    ...nodeStyle,
                    borderColor: undefined,
                  })
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface StylePanelProps {
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
}

export function StylePanel({
  selectedNodeId,
  selectedEdgeId,
}: StylePanelProps) {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const setGlobalNodeStyle = useDiagramStore((s) => s.setGlobalNodeStyle);
  const setGlobalEdgeStyle = useDiagramStore((s) => s.setGlobalEdgeStyle);
  const setNodeStyle = useDiagramStore((s) => s.setNodeStyle);
  const setEdgeStyle = useDiagramStore((s) => s.setEdgeStyle);

  // Derive the displayed DiagramStyles from the current code.
  // Re-runs whenever `code` changes, so the panel stays in sync with edits
  // made elsewhere (canvas color picker, AI tools, manual code edits).
  const diagramGraph = useMemo(() => mermaidToGraph(code), [code]);
  const styles = useMemo(() => stylesFromCode(code), [code]);
  const graphLabels = useMemo(() => {
    return {
      nodeLabels: Object.fromEntries(
        diagramGraph?.nodes.map((node) => [node.id, node.label]) ?? []
      ) as Record<string, string>,
      edgeLabels: Object.fromEntries(
        diagramGraph?.edges.map((edge) => [
          `${edge.source}->${edge.target}`,
          edge.label ?? `${edge.source} → ${edge.target}`,
        ]) ?? []
      ) as Record<string, string>,
    };
  }, [diagramGraph]);
  const selectedEdgeKey = useMemo(() => {
    if (!selectedEdgeId || !diagramGraph) return null;
    const edge = diagramGraph.edges.find((e) => e.id === selectedEdgeId);
    return edge ? `${edge.source}->${edge.target}` : null;
  }, [diagramGraph, selectedEdgeId]);
  const globalNode = useMemo(() => styles.globalNode ?? {}, [styles.globalNode]);
  const globalEdge = useMemo(() => styles.globalEdge ?? {}, [styles.globalEdge]);
  const nodeOverrides = useMemo(() => styles.nodes ?? {}, [styles.nodes]);
  const edgeOverrides = useMemo(() => styles.edges ?? {}, [styles.edges]);

  const updateGlobalNode = useCallback(
    (patch: Partial<NodeStyleOverride>) => {
      setGlobalNodeStyle({ ...globalNode, ...patch });
    },
    [globalNode, setGlobalNodeStyle]
  );

  const updateGlobalEdge = useCallback(
    (patch: Partial<EdgeStyleOverride>) => {
      setGlobalEdgeStyle({ ...globalEdge, ...patch });
    },
    [globalEdge, setGlobalEdgeStyle]
  );

  const updateNodeStyle = useCallback(
    (id: string, style: NodeStyleOverride) => {
      setNodeStyle(id, style);
    },
    [setNodeStyle]
  );

  const updateEdgeStyle = useCallback(
    (id: string, style: EdgeStyleOverride) => {
      setEdgeStyle(id, style);
    },
    [setEdgeStyle]
  );

  const removeNodeOverride = useCallback(
    (id: string) => {
      setNodeStyle(id, {});
    },
    [setNodeStyle]
  );

  const removeEdgeOverride = useCallback(
    (id: string) => {
      setEdgeStyle(id, {});
    },
    [setEdgeStyle]
  );

  const addSelectedNodeOverride = useCallback(() => {
    if (!selectedNodeId) return;
    setNodeStyle(selectedNodeId, {
      ...globalNode,
      ...(nodeOverrides[selectedNodeId] ?? {}),
    });
  }, [selectedNodeId, globalNode, nodeOverrides, setNodeStyle]);

  const addSelectedEdgeOverride = useCallback(() => {
    if (!selectedEdgeKey) return;
    setEdgeStyle(selectedEdgeKey, {
      ...globalEdge,
      ...(edgeOverrides[selectedEdgeKey] ?? {}),
    });
  }, [selectedEdgeKey, globalEdge, edgeOverrides, setEdgeStyle]);

  const resetAll = useCallback(() => {
    setGlobalNodeStyle({});
    setGlobalEdgeStyle({});
    for (const id of Object.keys(nodeOverrides)) setNodeStyle(id, {});
    for (const key of Object.keys(edgeOverrides)) setEdgeStyle(key, {});
  }, [
    setGlobalNodeStyle,
    setGlobalEdgeStyle,
    setNodeStyle,
    setEdgeStyle,
    nodeOverrides,
    edgeOverrides,
  ]);

  const hasNodeOverrides = Object.keys(nodeOverrides).length > 0;
  const hasEdgeOverrides = Object.keys(edgeOverrides).length > 0;
  const hasAnyStyles =
    Object.values(globalNode).some(Boolean) ||
    Object.values(globalEdge).some(Boolean) ||
    hasNodeOverrides ||
    hasEdgeOverrides;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] bg-[var(--muted)] shrink-0">
        <div className="flex items-center gap-1.5">
          <Paintbrush size={14} className="text-[var(--primary)]" />
          <span className="text-xs font-medium">Style Controls</span>
        </div>
        {hasAnyStyles && (
          <button
            onClick={resetAll}
            className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded hover:bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            title="Reset all styles"
          >
            <RotateCcw size={10} />
            Reset
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Global Node Styles */}
        <Section title="Node Defaults">
          <SelectInput
            label="Font"
            value={globalNode.fontFamily ?? ""}
            options={FONT_OPTIONS}
            onChange={(v) =>
              updateGlobalNode({ fontFamily: v || undefined })
            }
          />
          <SelectInput
            label="Font Size"
            value={globalNode.fontSize ?? ""}
            options={[
              { label: "Default", value: "" },
              ...FONT_SIZE_OPTIONS.map((s) => ({ label: `${s}px`, value: s })),
            ]}
            onChange={(v) =>
              updateGlobalNode({ fontSize: v ? Number(v) : undefined })
            }
          />
          <ColorInput
            label="Font Color"
            value={globalNode.fontColor ?? ""}
            onChange={(v) => updateGlobalNode({ fontColor: v })}
            onClear={() => updateGlobalNode({ fontColor: undefined })}
          />
          <ColorInput
            label="Background"
            value={globalNode.backgroundColor ?? ""}
            onChange={(v) => updateGlobalNode({ backgroundColor: v })}
            onClear={() => updateGlobalNode({ backgroundColor: undefined })}
          />
          <ColorInput
            label="Border"
            value={globalNode.borderColor ?? ""}
            onChange={(v) => updateGlobalNode({ borderColor: v })}
            onClear={() => updateGlobalNode({ borderColor: undefined })}
          />
        </Section>

        {/* Global Edge Styles */}
        <Section title="Line Defaults">
          <SelectInput
            label="Thickness"
            value={globalEdge.lineThickness ?? ""}
            options={[
              { label: "Default", value: "" },
              ...THICKNESS_OPTIONS,
            ]}
            onChange={(v) =>
              updateGlobalEdge({ lineThickness: v ? Number(v) : undefined })
            }
          />
          <ColorInput
            label="Line Color"
            value={globalEdge.lineColor ?? ""}
            onChange={(v) => updateGlobalEdge({ lineColor: v })}
            onClear={() => updateGlobalEdge({ lineColor: undefined })}
          />
          <SelectInput
            label="Font"
            value={globalEdge.fontFamily ?? ""}
            options={FONT_OPTIONS}
            onChange={(v) =>
              updateGlobalEdge({ fontFamily: v || undefined })
            }
          />
          <SelectInput
            label="Font Size"
            value={globalEdge.fontSize ?? ""}
            options={[
              { label: "Default", value: "" },
              ...FONT_SIZE_OPTIONS.map((s) => ({ label: `${s}px`, value: s })),
            ]}
            onChange={(v) =>
              updateGlobalEdge({ fontSize: v ? Number(v) : undefined })
            }
          />
          <ColorInput
            label="Font Color"
            value={globalEdge.fontColor ?? ""}
            onChange={(v) => updateGlobalEdge({ fontColor: v })}
            onClear={() => updateGlobalEdge({ fontColor: undefined })}
          />
        </Section>

        {/* Per-object overrides */}
        <Section title="Object Overrides" defaultOpen={hasNodeOverrides || hasEdgeOverrides}>
          {/* Action buttons */}
          <div className="flex gap-1 flex-wrap">
            {selectedNodeId && !nodeOverrides[selectedNodeId] && (
              <button
                onClick={addSelectedNodeOverride}
                className="text-xs px-2 py-0.5 rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
              >
                + Style &quot;{graphLabels.nodeLabels[selectedNodeId] ?? selectedNodeId}&quot;
              </button>
            )}
            {selectedEdgeKey && !edgeOverrides[selectedEdgeKey] && (
              <button
                onClick={addSelectedEdgeOverride}
                className="text-xs px-2 py-0.5 rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
              >
                + Style edge &quot;{graphLabels.edgeLabels[selectedEdgeKey] ?? selectedEdgeKey}&quot;
              </button>
            )}
            {!selectedNodeId && !selectedEdgeId && !hasNodeOverrides && !hasEdgeOverrides && (
              <span className="text-xs text-[var(--muted-foreground)] italic">
                Select a node or edge in the canvas to add per-object styles
              </span>
            )}
          </div>

          {/* Existing node overrides */}
          {Object.entries(nodeOverrides).map(([id, style]) => (
            <ObjectStyleSection
              key={`node-${id}`}
              title="Node"
              objectId={id}
              objectLabel={graphLabels.nodeLabels[id] ?? id}
              nodeStyle={style}
              isEdge={false}
              onUpdateNodeStyle={updateNodeStyle}
              onUpdateEdgeStyle={updateEdgeStyle}
              onRemoveOverride={removeNodeOverride}
            />
          ))}

          {/* Existing edge overrides */}
          {Object.entries(edgeOverrides).map(([id, style]) => (
            <ObjectStyleSection
              key={`edge-${id}`}
              title="Edge"
              objectId={id}
              objectLabel={graphLabels.edgeLabels[id] ?? id}
              edgeStyle={style}
              isEdge={true}
              onUpdateNodeStyle={updateNodeStyle}
              onUpdateEdgeStyle={updateEdgeStyle}
              onRemoveOverride={removeEdgeOverride}
            />
          ))}
        </Section>
      </div>
    </div>
  );
}
