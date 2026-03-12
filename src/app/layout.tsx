import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VizMerm - Vibe Code Mermaid Diagrams",
  description:
    "Create and edit mermaid diagrams with AI assistance and live preview",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
