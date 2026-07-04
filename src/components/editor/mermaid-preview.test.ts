import { describe, expect, it } from "vitest";
import { stylesFromCodeAndSidecar } from "./mermaid-preview";

describe("stylesFromCodeAndSidecar", () => {
  it("keeps code annotations authoritative over legacy sidecar styles", () => {
    const code = `flowchart TB
    A[Start]
    %%@ defaults node fill=#e0f2fe stroke=#0ea5e9
    %%@ node A fill=#fef3c7 color=#111827`;

    const styles = stylesFromCodeAndSidecar(
      code,
      JSON.stringify({
        globalNode: {
          backgroundColor: "#fff7ed",
          borderColor: "#fb923c",
        },
        nodes: {
          A: {
            backgroundColor: "#ddd6fe",
            fontColor: "#7c3aed",
          },
        },
      })
    );

    expect(styles.globalNode).toEqual({
      backgroundColor: "#e0f2fe",
      borderColor: "#0ea5e9",
    });
    expect(styles.nodes?.A).toEqual({
      backgroundColor: "#fef3c7",
      fontColor: "#111827",
    });
  });
});
