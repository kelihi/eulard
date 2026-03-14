"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function init() {
      // Check for existing diagrams first
      const listRes = await fetch("/api/diagrams");
      const diagrams = await listRes.json();

      if (diagrams.length > 0) {
        // Redirect to most recent diagram
        router.replace(`/editor/${diagrams[0].id}`);
        return;
      }

      // No diagrams exist — create one
      const res = await fetch("/api/diagrams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const diagram = await res.json();
      router.replace(`/editor/${diagram.id}`);
    }
    init();
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Eulard</h1>
        <p className="text-[var(--muted-foreground)]">Loading...</p>
      </div>
    </div>
  );
}
