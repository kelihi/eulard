"use client";

import { useEffect, useState, useRef } from "react";
import { useDiagramStore } from "@/stores/diagram-store";
import { X, Search, Building2, Loader2 } from "lucide-react";

interface ClientItem {
  id: string;
  name: string;
  status: string;
  industry: string | null;
}

interface ClientPickerProps {
  folderId: string;
  currentClientId: string | null;
  onClose: () => void;
}

export function ClientPicker({ folderId, currentClientId, onClose }: ClientPickerProps) {
  const setFolderClient = useDiagramStore((s) => s.setFolderClient);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Fetch clients
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    fetch(`/api/clients?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.items) {
          setClients(data.items);
        }
      })
      .catch(() => {
        setClients([]);
      })
      .finally(() => setLoading(false));
  }, [search]);

  const handleSelect = async (clientId: string | null) => {
    await setFolderClient(folderId, clientId);
    onClose();
  };

  return (
    <div
      ref={pickerRef}
      className="absolute left-full top-0 ml-1 w-64 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 px-2 py-1 bg-[var(--muted)] rounded-md">
          <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="flex-1 text-xs bg-transparent outline-none"
          />
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--muted-foreground)]" />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)] text-center py-4 px-2">
            {search ? "No clients found" : "No clients available"}
          </p>
        ) : (
          clients.map((client) => (
            <button
              key={client.id}
              onClick={() => handleSelect(client.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--muted)] transition-colors ${
                client.id === currentClientId ? "bg-[var(--primary)]/10 text-[var(--primary)]" : ""
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{client.name}</div>
                {client.industry && (
                  <div className="truncate text-[var(--muted-foreground)]">{client.industry}</div>
                )}
              </div>
              <span className={`text-[10px] px-1 py-0.5 rounded ${
                client.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-[var(--muted)] text-[var(--muted-foreground)]"
              }`}>
                {client.status}
              </span>
            </button>
          ))
        )}
      </div>

      {currentClientId && (
        <div className="border-t border-[var(--border)] p-1">
          <button
            onClick={() => handleSelect(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--destructive)] hover:bg-[var(--destructive)]/10 rounded transition-colors"
          >
            <X className="w-3 h-3" />
            Remove client
          </button>
        </div>
      )}
    </div>
  );
}
