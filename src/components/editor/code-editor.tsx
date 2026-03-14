"use client";

import { useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { useDiagramStore } from "@/stores/diagram-store";

export function CodeEditor() {
  const code = useDiagramStore((s) => s.diagram?.code ?? "");
  const setCode = useDiagramStore((s) => s.setCode);

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
        theme={oneDark}
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
