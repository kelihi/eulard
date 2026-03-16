"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import type {
  DiagramStyles,
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
  nodeLabels?: Record<string, string>;
  edgeLabels?: Record<string, string>;
}

export function StylePanel({
  selectedNodeId,
  selectedEdgeId,
  nodeLabels = {},
  edgeLabels = {},
}: StylePanelProps) {
  const getStyleOverrides = useDiagramStore((s) => s.getStyleOverrides);
  const setStyleOverrides = useDiagramStore((s) => s.setStyleOverrides);
  const styleOverridesJson = useDiagramStore(
    (s) => s.diagram?.styleOverrides ?? null
  );

  const stylesRef = useRef<DiagramStyles>({});

  // Parse styles from store
  useEffect(() => {
    if (styleOverridesJson) {
      try {
        stylesRef.current = JSON.parse(styleOverridesJson) as DiagramStyles;
      } catch {
        stylesRef.current = {};
      }
    } else {
      stylesRef.current = {};
    }
  }, [styleOverridesJson]);

  const getStyles = useCallback((): DiagramStyles => {
    return stylesRef.current;
  }, []);

  const updateStyles = useCallback(
    (updater: (prev: DiagramStyles) => DiagramStyles) => {
      const current = getStyles();
      const updated = updater(current);
      stylesRef.current = updated;
      setStyleOverrides(updated);
    },
    [getStyles, setStyleOverrides]
  );

  // Global node style handlers
  const updateGlobalNode = useCallback(
    (patch: Partial<NodeStyleOverride>) => {
      updateStyles((prev) => ({
        ...prev,
        globalNode: { ...prev.globalNode, ...patch },
      }));
    },
    [updateStyles]
  );

  // Global edge style handlers
  const updateGlobalEdge = useCallback(
    (patch: Partial<EdgeStyleOverride>) => {
      updateStyles((prev) => ({
        ...prev,
        globalEdge: { ...prev.globalEdge, ...patch },
      }));
    },
    [updateStyles]
  );

  // Per-object handlers
  const updateNodeStyle = useCallback(
    (id: string, style: NodeStyleOverride) => {
      updateStyles((prev) => ({
        ...prev,
        nodes: { ...prev.nodes, [id]: style },
      }));
    },
    [updateStyles]
  );

  const updateEdgeStyle = useCallback(
    (id: string, style: EdgeStyleOverride) => {
      updateStyles((prev) => ({
        ...prev,
        edges: { ...prev.edges, [id]: style },
      }));
    },
    [updateStyles]
  );

  const removeNodeOverride = useCallback(
    (id: string) => {
      updateStyles((prev) => {
        const nodes = { ...prev.nodes };
        delete nodes[id];
        return { ...prev, nodes };
      });
    },
    [updateStyles]
  );

  const removeEdgeOverride = useCallback(
    (id: string) => {
      updateStyles((prev) => {
        const edges = { ...prev.edges };
        delete edges[id];
        return { ...prev, edges };
      });
    },
    [updateStyles]
  );

  const addSelectedNodeOverride = useCallback(() => {
    if (!selectedNodeId) return;
    updateStyles((prev) => ({
      ...prev,
      nodes: { ...prev.nodes, [selectedNodeId]: prev.nodes?.[selectedNodeId] ?? {} },
    }));
  }, [selectedNodeId, updateStyles]);

  const addSelectedEdgeOverride = useCallback(() => {
    if (!selectedEdgeId) return;
    updateStyles((prev) => ({
      ...prev,
      edges: { ...prev.edges, [selectedEdgeId]: prev.edges?.[selectedEdgeId] ?? {} },
    }));
  }, [selectedEdgeId, updateStyles]);

  const resetAll = useCallback(() => {
    setStyleOverrides({});
  }, [setStyleOverrides]);

  const styles = getStyleOverrides();
  const globalNode = styles.globalNode ?? {};
  const globalEdge = styles.globalEdge ?? {};
  const nodeOverrides = styles.nodes ?? {};
  const edgeOverrides = styles.edges ?? {};

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
                + Style &quot;{nodeLabels[selectedNodeId] ?? selectedNodeId}&quot;
              </button>
            )}
            {selectedEdgeId && !edgeOverrides[selectedEdgeId] && (
              <button
                onClick={addSelectedEdgeOverride}
                className="text-xs px-2 py-0.5 rounded border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
              >
                + Style edge &quot;{edgeLabels[selectedEdgeId] ?? selectedEdgeId}&quot;
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
              objectLabel={nodeLabels[id] ?? id}
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
              objectLabel={edgeLabels[id] ?? id}
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
