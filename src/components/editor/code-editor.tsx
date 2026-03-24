"use client";

import { useCallback, useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { useDiagramStore } from "@/stores/diagram-store";

/** Light theme for CodeMirror matching our design system */
const lightTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--background)",
    color: "var(--foreground)",
  },
  ".cm-content": {
    caretColor: "var(--primary)",
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
    fontSize: "13px",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--primary)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--primary)",
    opacity: "0.15",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--muted)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--surface)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
    fontFamily: "var(--font-mono, 'JetBrains Mono', 'Fira Code', monospace)",
    fontSize: "12px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--muted)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--muted)",
    border: "1px solid var(--border)",
    color: "var(--muted-foreground)",
  },
  ".cm-matchingBracket": {
    backgroundColor: "var(--primary)",
    opacity: "0.15",
    outline: "1px solid var(--primary)",
  },
}, { dark: false });

export function CodeEditor() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const setCode = useDiagramStore((s) => s.setCode);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const onChange = useCallback(
    (value: string) => {
      setCode(value);
    },
    [setCode]
  );

  return (
    <div className="h-full overflow-hidden">
      <CodeMirror
        value={code}
        height="100%"
        extensions={[markdown()]}
        theme={isDark ? oneDark : lightTheme}
        onChange={onChange}
        className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:h-full"
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          bracketMatching: true,
          autocompletion: false,
        }}
      />
    </div>
  );
}
