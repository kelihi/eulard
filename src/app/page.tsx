"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Create a new diagram and redirect to it
    async function init() {
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
        <h1 className="text-2xl font-bold mb-2">VizMerm</h1>
        <p className="text-[var(--muted-foreground)]">
          Creating your first diagram...
        </p>
      </div>
    </div>
  );
}
