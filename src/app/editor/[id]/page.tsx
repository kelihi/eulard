"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDiagramStore } from "@/stores/diagram-store";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EditorLayout } from "@/components/editor/editor-layout";
import { ChatPanel } from "@/components/ai/chat-panel";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const loadDiagram = useDiagramStore((s) => s.loadDiagram);
  const diagram = useDiagramStore((s) => s.diagram);
  const [chatOpen, setChatOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useKeyboardShortcuts();

  useEffect(() => {
    setLoading(true);
    loadDiagram(id)
      .then(() => setLoading(false))
      .catch(() => {
        router.replace("/");
      });

    // Flush any pending save when navigating away from the editor
    return () => {
      useDiagramStore.getState().flushSave();
    };
  }, [id, loadDiagram, router]);

  // Save before full page unload (refresh, close tab, external navigation)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { diagram, isDirty } = useDiagramStore.getState();
      if (!diagram || !isDirty) return;

      // Use sendBeacon for reliable save on page unload
      const payload = JSON.stringify({
        title: diagram.title,
        code: diagram.code,
        positions: diagram.positions,
      });
      navigator.sendBeacon(
        `/api/diagrams/${diagram.id}`,
        new Blob([payload], { type: "application/json" })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  if (loading || !diagram) {
    return (
      <div className="h-screen flex overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-56 h-full bg-[var(--muted)] border-r border-[var(--border)] shrink-0">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <div className="h-4 w-20 bg-[var(--border)] rounded animate-pulse" />
          </div>
          <div className="p-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-[var(--border)] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* Main area skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-11 border-b border-[var(--border)] px-4 flex items-center">
            <div className="h-4 w-40 bg-[var(--border)] rounded animate-pulse" />
          </div>
          <div className="flex-1 flex">
            <div className="flex-1 bg-[var(--muted)] p-4">
              <div className="space-y-2">
                {[85, 70, 90, 60, 75].map((w, i) => (
                  <div key={i} className="h-4 bg-[var(--border)] rounded animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
            <div className="w-1 bg-[var(--border)]" />
            <div className="flex-1 flex items-center justify-center">
              <div className="h-32 w-48 bg-[var(--border)] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {sidebarOpen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onToggleChat={() => setChatOpen(!chatOpen)}
          chatOpen={chatOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 min-w-0">
            <ErrorBoundary>
              <EditorLayout />
            </ErrorBoundary>
          </div>
          {chatOpen && (
            <div className="w-80 shrink-0">
              <ErrorBoundary>
                <ChatPanel />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
