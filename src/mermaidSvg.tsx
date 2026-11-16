interface FlowNode {
  id: string;
  label: string;
  shape: "rect" | "round" | "diamond" | "circle";
}

interface FlowEdge {
  from: string;
  to: string;
  label: string;
  style: "solid" | "dashed" | "thick";
}

function parseNodeToken(raw: string, map: Map<string, FlowNode>): string {
  const token = raw.trim();
  const m =
    /^([A-Za-z0-9_\u4e00-\u9fa5-]+)\s*(?:\(\((.+)\)\)|\{\{?(.+?)\}?\}+|\(\[(.+)\]\)|\((.+)\)|\[(.+)\])?$/.exec(token);
  if (!m) {
    const fallback = token.replace(/["']/g, "");
    if (!map.has(fallback)) map.set(fallback, { id: fallback, label: fallback, shape: "rect" });
    return fallback;
  }
  const id = m[1];
  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, "");
  if (m[2] !== undefined) map.set(id, { id, label: clean(m[2]), shape: "circle" });
  else if (m[3] !== undefined) map.set(id, { id, label: clean(m[3]), shape: "diamond" });
  else if (m[4] !== undefined || m[5] !== undefined) map.set(id, { id, label: clean(m[4] ?? m[5]), shape: "round" });
  else if (m[6] !== undefined) map.set(id, { id, label: clean(m[6]), shape: "rect" });
  else if (!map.has(id)) map.set(id, { id, label: id, shape: "rect" });
  return id;
}

function renderFlowchart(lines: string[], dir: "TD" | "LR") {
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/;$/, "");
    if (!line || line.startsWith("%%") || /^(subgraph|end|classDef|class|style)\b/i.test(line)) continue;

    // 匹配带箭头的连线（如 A[开始] -->|条件| B{判断}）
    const arrowRe =
      /(.+?)\s*(==>|-\.->|-->|---|--[^>-]+-->)\s*(?:\|([^|]*)\|\s*)?(.+)/;
    const m = arrowRe.exec(line);
    if (m) {
      const leftId = parseNodeToken(m[1], nodes);
      let arrow = m[2];
      let edgeLabel = (m[3] ?? "").trim();
      if (arrow.startsWith("--") && arrow.endsWith("-->") && arrow.length > 3) {
        edgeLabel = arrow.slice(2, -3).trim();
        arrow = "-->";
      }
      // 右侧可能继续链式连接 B --> C
      const rightPart = m[4].trim();
      const subArrow = arrowRe.exec(rightPart);
      if (subArrow) {
        const midId = parseNodeToken(subArrow[1], nodes);
        const tailId = parseNodeToken(subArrow[4], nodes);
        edges.push({
          from: leftId,
          to: midId,
          label: edgeLabel,
          style: arrow === "-.->" ? "dashed" : arrow === "==>" ? "thick" : "solid",
        });
        edges.push({
          from: midId,
          to: tailId,
          label: (subArrow[3] ?? "").trim(),
          style: subArrow[2] === "-.->" ? "dashed" : subArrow[2] === "==>" ? "thick" : "solid",
        });
      } else {
        const rightId = parseNodeToken(rightPart, nodes);
        edges.push({
          from: leftId,
          to: rightId,
          label: edgeLabel,
          style: arrow === "-.->" ? "dashed" : arrow === "==>" ? "thick" : "solid",
        });
      }
    } else {
      parseNodeToken(line, nodes);
    }
  }

  const nodeList = [...nodes.values()];
  if (nodeList.length === 0) return null;

  // 计算分层拓扑（最长无环路径层级）
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodeList) {
    indeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (e.from === e.to) continue;
    adj.get(e.from)?.push(e.to);
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  }

  const rank = new Map<string, number>();
  const visited = new Set<string>();
  const queue = nodeList.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  if (queue.length === 0) queue.push(nodeList[0].id);
  for (const id of queue) rank.set(id, 0);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    visited.add(cur);
    const r = rank.get(cur) ?? 0;
    for (const nxt of adj.get(cur) ?? []) {
      if (!visited.has(nxt)) {
        rank.set(nxt, Math.max(rank.get(nxt) ?? 0, r + 1));
        queue.push(nxt);
        visited.add(nxt);
      }
    }
  }
  for (const n of nodeList) {
    if (!rank.has(n.id)) rank.set(n.id, 0);
  }

  const layers = new Map<number, FlowNode[]>();
  let maxRank = 0;
  for (const n of nodeList) {
    const r = rank.get(n.id) ?? 0;
    maxRank = Math.max(maxRank, r);
    const arr = layers.get(r);
    if (arr) arr.push(n);
    else layers.set(r, [n]);
  }

  const maxPerLayer = Math.max(1, ...[...layers.values()].map((l) => l.length));
  const boxW = 136;
  const boxH = 42;
  const gapMain = dir === "LR" ? 196 : 96;
  const gapCross = dir === "LR" ? 78 : 168;

  const width = dir === "LR" ? (maxRank + 1) * gapMain + 40 : Math.max(360, maxPerLayer * gapCross + 60);
  const height = dir === "LR" ? Math.max(180, maxPerLayer * gapCross + 48) : (maxRank + 1) * gapMain + 32;

  const pos = new Map<string, { cx: number; cy: number; node: FlowNode }>();
  for (let r = 0; r <= maxRank; r++) {
    const list = layers.get(r) ?? [];
    list.forEach((n, idx) => {
      if (dir === "LR") {
        const cx = 30 + boxW / 2 + r * gapMain;
        const totalH = (list.length - 1) * gapCross;
        const cy = height / 2 - totalH / 2 + idx * gapCross;
        pos.set(n.id, { cx, cy, node: n });
      } else {
        const totalW = (list.length - 1) * gapCross;
        const cx = width / 2 - totalW / 2 + idx * gapCross;
        const cy = 24 + boxH / 2 + r * gapMain;
        pos.set(n.id, { cx, cy, node: n });
      }
    });
  }

  return (
    <svg className="mermaid-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mermaid 流程图">
      <defs>
        <marker id="mm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--text-2)" />
        </marker>
      </defs>

      {edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        let x1 = a.cx;
        let y1 = a.cy;
        let x2 = b.cx;
        let y2 = b.cy;
        if (dir === "LR") {
          x1 = a.cx + (b.cx >= a.cx ? boxW / 2 : -boxW / 2);
          x2 = b.cx + (b.cx >= a.cx ? -boxW / 2 - 2 : boxW / 2 + 2);
        } else {
          y1 = a.cy + (b.cy >= a.cy ? boxH / 2 : -boxH / 2);
          y2 = b.cy + (b.cy >= a.cy ? -boxH / 2 - 2 : boxH / 2 + 2);
        }
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const pathD =
          dir === "LR"
            ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
        return (
          <g key={i}>
            <path
              d={pathD}
              fill="none"
              stroke="var(--text-2)"
              strokeWidth={e.style === "thick" ? 2.4 : 1.5}
              strokeDasharray={e.style === "dashed" ? "5 4" : undefined}
              markerEnd="url(#mm-arrow)"
            />
            {e.label && (
              <g transform={`translate(${mx}, ${my})`}>
                <rect
                  x={-(e.label.length * 6.5 + 10)}
                  y={-10}
                  width={e.label.length * 13 + 20}
                  height={20}
                  rx={5}
                  fill="var(--bg)"
                  stroke="var(--border)"
                />
                <text textAnchor="middle" y={4} className="mermaid-edge-text">
                  {e.label}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {[...pos.values()].map(({ cx, cy, node }) => (
        <g key={node.id} transform={`translate(${cx}, ${cy})`}>
          {node.shape === "diamond" ? (
            <polygon
              points={`0,${-boxH / 2 - 5} ${boxW / 2 + 8},0 0,${boxH / 2 + 5} ${-boxW / 2 - 8},0`}
              fill="var(--bg-sidebar)"
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          ) : node.shape === "circle" ? (
            <circle r={28} fill="var(--bg-sidebar)" stroke="var(--border-strong)" strokeWidth="1.5" />
          ) : (
            <rect
              x={-boxW / 2}
              y={-boxH / 2}
              width={boxW}
              height={boxH}
              rx={node.shape === "round" ? 21 : 8}
              fill="var(--bg-sidebar)"
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />
          )}
          <text textAnchor="middle" y={4.5} className="mermaid-node-text">
            {node.label.length > 12 ? `${node.label.slice(0, 12)}…` : node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function renderSequence(lines: string[]) {
  const actors = new Map<string, string>();
  const messages: { from: string; to: string; text: string; dashed: boolean }[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("%%")) continue;
    const partMatch = /^(?:participant|actor)\s+([^\s]+)(?:\s+as\s+(.+))?$/i.exec(line);
    if (partMatch) {
      actors.set(partMatch[1], (partMatch[2] ?? partMatch[1]).trim().replace(/^["']|["']$/g, ""));
      continue;
    }
    const msgMatch = /^([^\s-]+)\s*(-->>|->>|-->|->)\s*([^\s:]+)\s*:\s*(.*)$/.exec(line);
    if (msgMatch) {
      const [, f, arrow, t, txt] = msgMatch;
      if (!actors.has(f)) actors.set(f, f);
      if (!actors.has(t)) actors.set(t, t);
      messages.push({ from: f, to: t, text: txt.trim(), dashed: arrow.startsWith("--") });
    }
  }

  const actorList = [...actors.entries()];
  if (actorList.length === 0) return null;

  const colGap = 170;
  const width = Math.max(360, actorList.length * colGap + 40);
  const height = 96 + messages.length * 48;
  const xOf = new Map<string, number>();
  actorList.forEach(([id], i) => {
    const total = (actorList.length - 1) * colGap;
    xOf.set(id, width / 2 - total / 2 + i * colGap);
  });

  return (
    <svg className="mermaid-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mermaid 时序图">
      <defs>
        <marker id="seq-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="var(--accent)" />
        </marker>
      </defs>

      {actorList.map(([id, label]) => {
        const x = xOf.get(id)!;
        return (
          <g key={id}>
            <line x1={x} y1={46} x2={x} y2={height - 20} stroke="var(--border-strong)" strokeDasharray="4 4" />
            <rect x={x - 56} y={12} width={112} height={34} rx={7} fill="var(--bg-sidebar)" stroke="var(--border-strong)" strokeWidth="1.5" />
            <text x={x} y={33} textAnchor="middle" className="mermaid-node-text">
              {label}
            </text>
          </g>
        );
      })}

      {messages.map((m, idx) => {
        const x1 = xOf.get(m.from)!;
        const x2 = xOf.get(m.to)!;
        const y = 78 + idx * 46;
        if (x1 === x2) {
          return (
            <g key={idx}>
              <path
                d={`M ${x1} ${y - 6} L ${x1 + 36} ${y - 6} L ${x1 + 36} ${y + 12} L ${x1 + 4} ${y + 12}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                strokeDasharray={m.dashed ? "4 3" : undefined}
                markerEnd="url(#seq-arrow)"
              />
              <text x={x1 + 42} y={y + 6} className="mermaid-edge-text">
                {m.text}
              </text>
            </g>
          );
        }
        return (
          <g key={idx}>
            <line
              x1={x1}
              y1={y}
              x2={x2 > x1 ? x2 - 4 : x2 + 4}
              y2={y}
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeDasharray={m.dashed ? "5 3" : undefined}
              markerEnd="url(#seq-arrow)"
            />
            <text x={(x1 + x2) / 2} y={y - 7} textAnchor="middle" className="mermaid-edge-text">
              {m.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const PIE_COLORS = ["#2383e2", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

function renderPie(lines: string[]) {
  let title = "";
  const items: { label: string; value: number }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const tm = /^title\s+(.+)$/i.exec(line);
    if (tm) {
      title = tm[1].trim();
      continue;
    }
    const im = /^"([^"]+)"\s*:\s*([0-9.]+)/.exec(line);
    if (im) {
      const v = parseFloat(im[2]);
      if (Number.isFinite(v) && v > 0) items.push({ label: im[1], value: v });
    }
  }
  if (items.length === 0) return null;
  const total = items.reduce((a, b) => a + b.value, 0);
  const circ = 2 * Math.PI * 62;
  let acc = 0;

  return (
    <svg className="mermaid-svg" viewBox="0 0 460 210" role="img" aria-label={title || "Mermaid 饼图"}>
      {title && (
        <text x="230" y="22" textAnchor="middle" className="mermaid-node-text">
          {title}
        </text>
      )}
      <g transform="translate(115, 118)">
        {items.map((it, i) => {
          const ratio = it.value / total;
          const dash = ratio * circ;
          const offset = -acc * circ;
          acc += ratio;
          return (
            <circle
              key={it.label}
              r="62"
              fill="none"
              stroke={PIE_COLORS[i % PIE_COLORS.length]}
              strokeWidth="32"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={offset}
              transform="rotate(-90)"
            />
          );
        })}
      </g>
      <g transform="translate(225, 58)">
        {items.map((it, i) => {
          const pct = Math.round((it.value / total) * 100);
          return (
            <g key={it.label} transform={`translate(0, ${i * 26})`}>
              <rect width="12" height="12" rx="3" fill={PIE_COLORS[i % PIE_COLORS.length]} />
              <text x="20" y="10.5" className="mermaid-edge-text">
                {it.label}（{pct}%）
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** 轻量离线 Mermaid 矢量图渲染器：支持 flowchart/graph（TD/LR）、sequenceDiagram 与 pie */
export function MermaidDiagram({ code }: { code: string }) {
  const lines = code.trim().split(/\r?\n/);
  const head = (lines[0] ?? "").trim();

  if (/^sequenceDiagram\b/i.test(head)) {
    const svg = renderSequence(lines.slice(1));
    return svg ?? <div className="toc-empty">添加参与者与消息后即可生成时序图预览（如 A-&gt;&gt;B: 请求）。</div>;
  }

  if (/^pie\b/i.test(head)) {
    const inlineTitle = /^pie\s+title\s+(.+)$/i.exec(head);
    const rest = inlineTitle ? [`title ${inlineTitle[1]}`, ...lines.slice(1)] : lines.slice(1);
    const svg = renderPie(rest);
    return svg ?? <div className="toc-empty">按 &quot;分类&quot; : 数值 格式输入即可生成饼图。</div>;
  }

  const flowMatch = /^(?:flowchart|graph)\s*(TD|TB|LR|RL)?/i.exec(head);
  const dir = flowMatch?.[1]?.toUpperCase() === "LR" || flowMatch?.[1]?.toUpperCase() === "RL" ? "LR" : "TD";
  const bodyLines = flowMatch ? lines.slice(1) : lines;
  const svg = renderFlowchart(bodyLines, dir);
  return svg ?? <div className="toc-empty">输入如 A[开始] --&gt; B&#123;判断&#125; --&gt; C[完成] 即可实时生成流程图。</div>;
}
