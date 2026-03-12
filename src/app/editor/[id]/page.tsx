"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDiagramStore } from "@/stores/diagram-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EditorLayout } from "@/components/editor/editor-layout";
import { ChatPanel } from "@/components/ai/chat-panel";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const loadDiagram = useDiagramStore((s) => s.loadDiagram);
  const saveDiagram = useDiagramStore((s) => s.saveDiagram);
  const diagram = useDiagramStore((s) => s.diagram);
  const [chatOpen, setChatOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadDiagram(id)
      .then(() => setLoading(false))
      .catch(() => {
        // Diagram not found, redirect to home to create one
        router.replace("/");
      });
  }, [id, loadDiagram, router]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveDiagram();
      }
    },
    [saveDiagram]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading || !diagram) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-[var(--muted-foreground)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleChat={() => setChatOpen(!chatOpen)}
          chatOpen={chatOpen}
        />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 min-w-0">
            <EditorLayout />
          </div>
          {chatOpen && (
            <div className="w-80 shrink-0">
              <ChatPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
