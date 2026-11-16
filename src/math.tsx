import { Fragment, type ReactNode } from "react";

const SYMBOLS: Record<string, string> = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ϵ",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  rho: "ρ",
  sigma: "σ",
  tau: "τ",
  upsilon: "υ",
  phi: "ϕ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  forall: "∀",
  exists: "∃",
  emptyset: "∅",
  in: "∈",
  notin: "∉",
  subset: "⊂",
  subseteq: "⊆",
  cup: "∪",
  cap: "∩",
  pm: "±",
  mp: "∓",
  times: "×",
  div: "÷",
  cdot: "·",
  ast: "∗",
  star: "⋆",
  approx: "≈",
  sim: "∼",
  cong: "≅",
  equiv: "≡",
  neq: "≠",
  ne: "≠",
  leq: "≤",
  le: "≤",
  geq: "≥",
  ge: "≥",
  ll: "≪",
  gg: "≫",
  propto: "∝",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  mapsto: "↦",
  dots: "…",
  cdots: "⋯",
  ldots: "…",
  vdots: "⋮",
  ddots: "⋱",
  quad: "\u2003",
  qquad: "\u2003\u2003",
  therefore: "∴",
  because: "∵",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
};

const BIG_OPS: Record<string, string> = {
  sum: "∑",
  prod: "∏",
  coprod: "∐",
  int: "∫",
  iint: "∬",
  oint: "∮",
  bigcup: "⋃",
  bigcap: "⋂",
  lim: "lim",
  max: "max",
  min: "min",
  sup: "sup",
  inf: "inf",
  log: "log",
  ln: "ln",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  exp: "exp",
};

const BLACKBOARD: Record<string, string> = {
  R: "ℝ",
  N: "ℕ",
  Z: "ℤ",
  Q: "ℚ",
  C: "ℂ",
  E: "𝔼",
  P: "ℙ",
};

type MathNode =
  | { kind: "text"; value: string; italic?: boolean; bold?: boolean }
  | { kind: "space"; value: string }
  | { kind: "frac"; num: MathNode[]; den: MathNode[] }
  | { kind: "sqrt"; deg?: MathNode[]; body: MathNode[] }
  | { kind: "script"; base: MathNode; sub?: MathNode[]; sup?: MathNode[]; bigOp?: boolean }
  | { kind: "accent"; mode: "bar" | "vec" | "hat"; body: MathNode[] }
  | { kind: "matrix"; env: string; rows: MathNode[][][] }
  | { kind: "group"; children: MathNode[] };

class MathParser {
  private pos = 0;
  constructor(private src: string) {}

  private skipSpaces() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
  }

  parseList(stopAt?: string): MathNode[] {
    const out: MathNode[] = [];
    while (this.pos < this.src.length) {
      this.skipSpaces();
      if (this.pos >= this.src.length) break;
      if (stopAt && this.src.startsWith(stopAt, this.pos)) break;
      const ch = this.src[this.pos];
      if (ch === "}") break;

      const atom = this.parseAtom();
      if (!atom) break;

      // 解析紧随其后的下标 _ 与上标 ^
      let sub: MathNode[] | undefined;
      let sup: MathNode[] | undefined;
      for (let k = 0; k < 2; k++) {
        this.skipSpaces();
        const next = this.src[this.pos];
        if (next === "_" && !sub) {
          this.pos++;
          sub = this.parseArg();
        } else if (next === "^" && !sup) {
          this.pos++;
          sup = this.parseArg();
        } else {
          break;
        }
      }

      if (sub || sup) {
        const isBig = atom.kind === "text" && Object.values(BIG_OPS).includes(atom.value);
        out.push({ kind: "script", base: atom, sub, sup, bigOp: isBig });
      } else {
        out.push(atom);
      }
    }
    return out;
  }

  private parseArg(): MathNode[] {
    this.skipSpaces();
    if (this.src[this.pos] === "{") {
      this.pos++;
      const inner = this.parseList();
      if (this.src[this.pos] === "}") this.pos++;
      return inner;
    }
    const single = this.parseAtom();
    return single ? [single] : [];
  }

  private parseBracketOpt(): MathNode[] | undefined {
    this.skipSpaces();
    if (this.src[this.pos] !== "[") return undefined;
    this.pos++;
    const start = this.pos;
    let depth = 1;
    while (this.pos < this.src.length && depth > 0) {
      if (this.src[this.pos] === "[") depth++;
      else if (this.src[this.pos] === "]") depth--;
      this.pos++;
    }
    const subSrc = this.src.slice(start, this.pos - 1);
    return new MathParser(subSrc).parseList();
  }

  private readRawBrace(): string {
    this.skipSpaces();
    if (this.src[this.pos] !== "{") return "";
    this.pos++;
    const start = this.pos;
    let depth = 1;
    while (this.pos < this.src.length && depth > 0) {
      if (this.src[this.pos] === "{") depth++;
      else if (this.src[this.pos] === "}") depth--;
      this.pos++;
    }
    return this.src.slice(start, this.pos - 1);
  }

  private parseAtom(): MathNode | null {
    this.skipSpaces();
    if (this.pos >= this.src.length) return null;
    const ch = this.src[this.pos];

    if (ch === "{") {
      this.pos++;
      const children = this.parseList();
      if (this.src[this.pos] === "}") this.pos++;
      return { kind: "group", children };
    }

    if (ch === "\\") {
      this.pos++;
      if (this.pos >= this.src.length) return null;
      const esc = this.src[this.pos];
      if ("{},; !%|".includes(esc)) {
        this.pos++;
        if (esc === "," || esc === ";" || esc === " ") return { kind: "space", value: "\u2009" };
        return { kind: "text", value: esc };
      }
      const m = /^[a-zA-Z]+/.exec(this.src.slice(this.pos));
      if (!m) {
        this.pos++;
        return { kind: "text", value: esc };
      }
      const cmd = m[0];
      this.pos += cmd.length;

      if (cmd === "left" || cmd === "right") {
        this.skipSpaces();
        const delim = this.src[this.pos] ?? "";
        if (delim === "\\") {
          this.pos++;
          const dm = /^[a-zA-Z{}]+/.exec(this.src.slice(this.pos));
          const dname = dm?.[0] ?? "";
          this.pos += dname.length;
          return { kind: "text", value: dname === "{" || dname === "lbrace" ? "{" : dname === "}" || dname === "rbrace" ? "}" : SYMBOLS[dname] ?? "" };
        }
        if (delim) this.pos++;
        return delim === "." ? { kind: "text", value: "" } : { kind: "text", value: delim };
      }

      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
        const num = this.parseArg();
        const den = this.parseArg();
        return { kind: "frac", num, den };
      }

      if (cmd === "sqrt") {
        const deg = this.parseBracketOpt();
        const body = this.parseArg();
        return { kind: "sqrt", deg, body };
      }

      if (cmd === "overline" || cmd === "bar") {
        return { kind: "accent", mode: "bar", body: this.parseArg() };
      }
      if (cmd === "vec") {
        return { kind: "accent", mode: "vec", body: this.parseArg() };
      }
      if (cmd === "hat" || cmd === "widehat") {
        return { kind: "accent", mode: "hat", body: this.parseArg() };
      }
      if (cmd === "text" || cmd === "mathrm" || cmd === "operatorname") {
        return { kind: "text", value: this.readRawBrace() };
      }
      if (cmd === "mathbf" || cmd === "boldsymbol") {
        return { kind: "text", value: this.readRawBrace(), bold: true };
      }
      if (cmd === "mathbb") {
        const raw = this.readRawBrace().trim();
        return { kind: "text", value: BLACKBOARD[raw] ?? raw, bold: true };
      }
      if (cmd === "begin") {
        const env = this.readRawBrace().trim();
        const endTag = `\\end{${env}}`;
        const endIdx = this.src.indexOf(endTag, this.pos);
        const bodyStr = endIdx >= 0 ? this.src.slice(this.pos, endIdx) : this.src.slice(this.pos);
        this.pos = endIdx >= 0 ? endIdx + endTag.length : this.src.length;
        const rows = bodyStr
          .split(/\\\\/)
          .map((r) => r.trim())
          .filter(Boolean)
          .map((rowStr) => rowStr.split("&").map((cellStr) => new MathParser(cellStr).parseList()));
        return { kind: "matrix", env, rows };
      }

      if (BIG_OPS[cmd]) return { kind: "text", value: BIG_OPS[cmd] };
      if (SYMBOLS[cmd]) return { kind: "text", value: SYMBOLS[cmd] };
      return { kind: "text", value: cmd };
    }

    this.pos++;
    if (/[a-zA-Z]/.test(ch)) return { kind: "text", value: ch, italic: true };
    if (ch === "-") return { kind: "text", value: "−" };
    return { kind: "text", value: ch };
  }
}

function renderNodes(nodes: MathNode[], display: boolean): ReactNode {
  return nodes.map((n, i) => <Fragment key={i}>{renderNode(n, display)}</Fragment>);
}

function renderNode(node: MathNode, display: boolean): ReactNode {
  switch (node.kind) {
    case "text":
      return (
        <span
          className={
            node.bold ? "math-bold" : node.italic ? "math-italic" : "math-roman"
          }
        >
          {node.value}
        </span>
      );
    case "space":
      return <span>{node.value}</span>;
    case "group":
      return <span className="math-group">{renderNodes(node.children, display)}</span>;
    case "frac":
      return (
        <span className="math-frac">
          <span className="math-num">{renderNodes(node.num, false)}</span>
          <span className="math-den">{renderNodes(node.den, false)}</span>
        </span>
      );
    case "sqrt":
      return (
        <span className="math-sqrt">
          {node.deg && <sup className="math-sqrt-deg">{renderNodes(node.deg, false)}</sup>}
          <span className="math-sqrt-sign">√</span>
          <span className="math-sqrt-body">{renderNodes(node.body, false)}</span>
        </span>
      );
    case "accent":
      return (
        <span className={`math-accent math-accent-${node.mode}`}>
          {node.mode === "vec" && <span className="math-accent-mark">→</span>}
          {node.mode === "hat" && <span className="math-accent-mark">^</span>}
          <span className="math-accent-body">{renderNodes(node.body, false)}</span>
        </span>
      );
    case "script":
      if (node.bigOp && display) {
        return (
          <span className="math-bigop">
            {node.sup && <span className="math-bigop-sup">{renderNodes(node.sup, false)}</span>}
            <span className="math-bigop-sym">{renderNode(node.base, false)}</span>
            {node.sub && <span className="math-bigop-sub">{renderNodes(node.sub, false)}</span>}
          </span>
        );
      }
      return (
        <span className="math-script-wrap">
          {renderNode(node.base, false)}
          <span className="math-scripts">
            {node.sup && <sup className="math-sup">{renderNodes(node.sup, false)}</sup>}
            {node.sub && <sub className="math-sub">{renderNodes(node.sub, false)}</sub>}
          </span>
        </span>
      );
    case "matrix": {
      const left =
        node.env === "pmatrix"
          ? "("
          : node.env === "bmatrix"
            ? "["
            : node.env === "Bmatrix" || node.env === "cases"
              ? "{"
              : node.env === "vmatrix"
                ? "|"
                : "";
      const right =
        node.env === "pmatrix"
          ? ")"
          : node.env === "bmatrix"
            ? "]"
            : node.env === "Bmatrix"
              ? "}"
              : node.env === "vmatrix"
                ? "|"
                : "";
      return (
        <span className="math-matrix">
          {left && <span className="math-delim">{left}</span>}
          <span className="math-matrix-grid">
            {node.rows.map((row, rIdx) => (
              <span key={rIdx} className="math-matrix-row">
                {row.map((cell, cIdx) => (
                  <span key={cIdx} className="math-matrix-cell">
                    {renderNodes(cell, false)}
                  </span>
                ))}
              </span>
            ))}
          </span>
          {right && <span className="math-delim">{right}</span>}
        </span>
      );
    }
  }
}

/** 结构化 TeX / LaTeX 数学公式排版组件（支持分式上下排布、根号顶线、上下标、大型求和积分与矩阵） */
export function MathRenderer({ latex, display = false }: { latex: string; display?: boolean }) {
  const trimmed = latex.trim();
  if (!trimmed) return null;
  const ast = new MathParser(trimmed).parseList();
  return <span className={display ? "math-render math-display" : "math-render math-inline"}>{renderNodes(ast, display)}</span>;
}
