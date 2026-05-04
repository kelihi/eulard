import type {
  Annotation,
  NodeAnnotation,
  EdgeAnnotation,
  DefaultsAnnotation,
  AnnotationParseResult,
} from "@/types/annotations";
import type { NodeStyleOverride, EdgeStyleOverride } from "@/types/graph";

const DIRECTIVE_RE = /^\s*%%@\s+(.+?)\s*$/;

export function parseAnnotations(code: string): AnnotationParseResult {
  const annotations: Annotation[] = [];
  const malformed: AnnotationParseResult["malformed"] = [];
  const lines = code.split("\n");

  lines.forEach((line, idx) => {
    const m = line.match(DIRECTIVE_RE);
    if (!m) return;
    const body = m[1];
    try {
      annotations.push(parseDirectiveBody(body));
    } catch (err) {
      malformed.push({
        lineNumber: idx + 1,
        raw: line,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  });

  return { annotations, malformed };
}

function parseDirectiveBody(body: string): Annotation {
  const tokens = tokenize(body);
  if (tokens.length === 0) throw new Error("empty directive");

  const kind = tokens[0];
  switch (kind) {
    case "node": {
      if (tokens.length < 2) throw new Error("node directive needs id");
      const id = tokens[1];
      const attrs = tokensToAttrs(tokens.slice(2));
      return buildNodeAnnotation(id, attrs);
    }
    case "edge": {
      if (tokens.length < 2) throw new Error("edge directive needs source->target");
      const [source, target] = tokens[1].split("->");
      if (!source || !target) throw new Error("edge id must be source->target");
      const attrs = tokensToAttrs(tokens.slice(2));
      return buildEdgeAnnotation(source, target, attrs);
    }
    case "defaults": {
      if (tokens.length < 2 || (tokens[1] !== "node" && tokens[1] !== "edge"))
        throw new Error("defaults directive needs scope (node|edge)");
      const scope = tokens[1] as "node" | "edge";
      const attrs = tokensToAttrs(tokens.slice(2));
      return buildDefaultsAnnotation(scope, attrs);
    }
    default:
      throw new Error(`unknown directive kind "${kind}"`);
  }
}

/** Split body into tokens, respecting `"quoted strings"`. */
function tokenize(body: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && body[i] === " ") i++;
    if (i >= body.length) break;
    if (body[i] === '"') {
      const end = body.indexOf('"', i + 1);
      if (end === -1) throw new Error("unterminated quoted value");
      tokens.push(body.slice(i + 1, end));
      i = end + 1;
    } else {
      let buf = "";
      while (i < body.length && body[i] !== " ") {
        if (body[i] === '"') {
          const end = body.indexOf('"', i + 1);
          if (end === -1) throw new Error("unterminated quoted value");
          buf += body.slice(i + 1, end);
          i = end + 1;
        } else {
          buf += body[i];
          i++;
        }
      }
      tokens.push(buf);
    }
  }
  return tokens;
}

function tokensToAttrs(tokens: string[]): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const t of tokens) {
    const eq = t.indexOf("=");
    if (eq === -1) throw new Error(`token "${t}" is not key=value`);
    attrs[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return attrs;
}

function buildNodeAnnotation(id: string, attrs: Record<string, string>): NodeAnnotation {
  const ann: NodeAnnotation = { kind: "node", id };
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    switch (key) {
      case "pos": {
        const [x, y] = value.split(",").map(Number);
        if (Number.isNaN(x) || Number.isNaN(y))
          throw new Error(`invalid pos "${value}"`);
        ann.position = { x, y };
        break;
      }
      case "size": {
        const [w, h] = value.split("x").map(Number);
        if (Number.isNaN(w) || Number.isNaN(h))
          throw new Error(`invalid size "${value}"`);
        ann.size = { width: w, height: h };
        break;
      }
      case "shape":
        ann.shape = value;
        break;
      case "fill":
        ann.style = { ...ann.style, backgroundColor: value };
        break;
      case "stroke":
        ann.style = { ...ann.style, borderColor: value };
        break;
      case "color":
        ann.style = { ...ann.style, fontColor: value };
        break;
      case "font":
        ann.style = { ...ann.style, fontFamily: value };
        break;
      case "fontSize":
        ann.style = { ...ann.style, fontSize: Number(value) };
        break;
      default:
        extra[key] = value;
    }
  }

  if (Object.keys(extra).length > 0) ann.extra = extra;
  return ann;
}

function buildEdgeAnnotation(
  source: string,
  target: string,
  attrs: Record<string, string>
): EdgeAnnotation {
  const ann: EdgeAnnotation = { kind: "edge", source, target };
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    switch (key) {
      case "color":
        ann.style = { ...ann.style, lineColor: value };
        break;
      case "width":
        ann.style = { ...ann.style, lineThickness: Number(value) };
        break;
      case "font":
        ann.style = { ...ann.style, fontFamily: value };
        break;
      case "fontSize":
        ann.style = { ...ann.style, fontSize: Number(value) };
        break;
      case "fontColor":
        ann.style = { ...ann.style, fontColor: value };
        break;
      default:
        extra[key] = value;
    }
  }

  if (Object.keys(extra).length > 0) ann.extra = extra;
  return ann;
}

function buildDefaultsAnnotation(
  scope: "node" | "edge",
  attrs: Record<string, string>
): DefaultsAnnotation {
  const style: NodeStyleOverride & EdgeStyleOverride = {};
  const extra: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    switch (key) {
      case "font":
        style.fontFamily = value;
        break;
      case "size":
        style.fontSize = Number(value);
        break;
      case "color":
        style.fontColor = value;
        break;
      case "fill":
        if (scope === "node") (style as NodeStyleOverride).backgroundColor = value;
        else extra[key] = value;
        break;
      case "stroke":
        if (scope === "node") (style as NodeStyleOverride).borderColor = value;
        else extra[key] = value;
        break;
      case "lineColor":
        if (scope === "edge") (style as EdgeStyleOverride).lineColor = value;
        else extra[key] = value;
        break;
      case "lineWidth":
        if (scope === "edge") (style as EdgeStyleOverride).lineThickness = Number(value);
        else extra[key] = value;
        break;
      default:
        extra[key] = value;
    }
  }

  const ann: DefaultsAnnotation = { kind: "defaults", scope, style };
  if (Object.keys(extra).length > 0) ann.extra = extra;
  return ann;
}
