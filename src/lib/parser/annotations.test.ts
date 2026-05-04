import { describe, it, expect } from "vitest";
import { parseAnnotations } from "./annotations";

describe("parseAnnotations — happy path", () => {
  it("parses a node directive with pos and size", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node A pos=120,40 size=180x60 fill=#e0f2fe stroke=#0ea5e9
    A --> B`;
    const result = parseAnnotations(code);
    expect(result.malformed).toEqual([]);
    expect(result.annotations).toHaveLength(1);
    expect(result.annotations[0]).toEqual({
      kind: "node",
      id: "A",
      position: { x: 120, y: 40 },
      size: { width: 180, height: 60 },
      style: { backgroundColor: "#e0f2fe", borderColor: "#0ea5e9" },
    });
  });

  it("parses edge directive with color and width", () => {
    const code = `flowchart TB
    A --> B
    %%@ edge A->B color=#10b981 width=3`;
    const result = parseAnnotations(code);
    expect(result.annotations).toEqual([
      {
        kind: "edge",
        source: "A",
        target: "B",
        style: { lineColor: "#10b981", lineThickness: 3 },
      },
    ]);
  });

  it("parses defaults directive", () => {
    const code = `flowchart TB
    %%@ defaults node font="Times New Roman" size=14`;
    const result = parseAnnotations(code);
    expect(result.annotations).toEqual([
      {
        kind: "defaults",
        scope: "node",
        style: { fontFamily: "Times New Roman", fontSize: 14 },
      },
    ]);
  });

  it("returns empty annotations array when code has none", () => {
    const code = `flowchart TB
    A[Start] --> B[End]`;
    expect(parseAnnotations(code).annotations).toEqual([]);
  });
});

describe("parseAnnotations — error handling", () => {
  it("records malformed lines without throwing", () => {
    const code = `flowchart TB
    A[Start]
    %%@ node
    %%@ edge A->`;
    const result = parseAnnotations(code);
    expect(result.annotations).toEqual([]);
    expect(result.malformed).toHaveLength(2);
    expect(result.malformed[0].lineNumber).toBe(3);
  });

  it("preserves unknown keys as extra", () => {
    const code = `%%@ node A weight=99 priority=high`;
    const [ann] = parseAnnotations(code).annotations;
    expect(ann.kind === "node" && ann.extra).toEqual({
      weight: "99",
      priority: "high",
    });
  });

  it("ignores `%%` non-directive comments", () => {
    const code = `flowchart TB
    %% just a comment
    A[Start]`;
    expect(parseAnnotations(code).annotations).toEqual([]);
  });

  it("supports quoted values with spaces", () => {
    const code = `%%@ node A font="Helvetica Neue"`;
    const [ann] = parseAnnotations(code).annotations;
    expect(ann.kind === "node" && ann.style?.fontFamily).toBe("Helvetica Neue");
  });
});
