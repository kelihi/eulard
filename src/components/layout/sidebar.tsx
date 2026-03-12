"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDiagramStore } from "@/stores/diagram-store";
import { cn } from "@/lib/utils";
import { Plus, FileText, Trash2 } from "lucide-react";

export function Sidebar() {
  const diagrams = useDiagramStore((s) => s.diagrams);
  const currentId = useDiagramStore((s) => s.diagram?.id);
  const loadDiagrams = useDiagramStore((s) => s.loadDiagrams);
  const createDiagram = useDiagramStore((s) => s.createDiagram);
  const deleteDiagram = useDiagramStore((s) => s.deleteDiagram);
  const router = useRouter();

  useEffect(() => {
    loadDiagrams();
  }, [loadDiagrams]);

  const handleCreate = async () => {
    const id = await createDiagram();
    router.push(`/editor/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this diagram?")) return;
    await deleteDiagram(id);
    if (id === currentId && diagrams.length > 1) {
      const other = diagrams.find((d) => d.id !== id);
      if (other) router.push(`/editor/${other.id}`);
      else router.push("/");
    }
  };

  return (
    <div className="w-56 h-full bg-[var(--muted)] border-r border-[var(--border)] flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="font-bold text-sm tracking-tight">VizMerm</span>
        <button
          onClick={handleCreate}
          className="p-1 rounded hover:bg-[var(--border)] transition-colors"
          title="New Diagram"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Diagram list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {diagrams.map((d) => (
          <div
            key={d.id}
            onClick={() => router.push(`/editor/${d.id}`)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm group transition-colors",
              d.id === currentId
                ? "bg-[var(--background)] shadow-sm"
                : "hover:bg-[var(--background)]/50"
            )}
          >
            <FileText className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
            <span className="truncate flex-1">{d.title}</span>
            <button
              onClick={(e) => handleDelete(e, d.id)}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        {diagrams.length === 0 && (
          <p className="text-xs text-[var(--muted-foreground)] text-center mt-4">
            No diagrams yet
          </p>
        )}
      </div>
    </div>
  );
}
