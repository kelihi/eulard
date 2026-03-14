/**
 * Export the current mermaid diagram as PNG, SVG, or raw code.
 */

export async function exportAsSvg(code: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
  });
  const { svg } = await mermaid.render("export-svg", code);
  return svg;
}

export async function downloadSvg(code: string, filename: string) {
  const svg = await exportAsSvg(code);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  downloadBlob(blob, `${filename}.svg`);
}

export async function downloadPng(code: string, filename: string) {
  const svg = await exportAsSvg(code);

  // Convert SVG to PNG via canvas
  const img = new Image();
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<void>((resolve, reject) => {
    img.onload = () => {
      const scale = 2; // 2x for retina
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          downloadBlob(blob, `${filename}.png`);
          resolve();
        } else {
          reject(new Error("Could not create PNG blob"));
        }
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG for PNG export"));
    };
    img.src = url;
  });
}

export function downloadMermaidCode(code: string, filename: string) {
  const blob = new Blob([code], { type: "text/plain" });
  downloadBlob(blob, `${filename}.mmd`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
