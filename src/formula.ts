/**
 * 公式属性用的小型表达式求值器。自己做词法和语法分析，不使用 eval，
 * 所以公式里写什么都只是在算数，碰不到页面和系统的任何东西。
 *
 * 支持：数字、字符串、true/false，+ - * / %，比较，and/or/not（或 && || !），括号，
 * 以及 prop("属性名")、if(条件, 甲, 乙)、round、floor、ceil、abs、min、max、sum、
 * concat、length、contains、lower、upper、empty、toNumber、today、now、dateBetween。
 */

export type FormulaValue = number | string | boolean | null;

type Token =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "id"; value: string }
  | { kind: "op"; value: string };

const OPERATORS = ["==", "!=", ">=", "<=", "&&", "||", "+", "-", "*", "/", "%", ">", "<", "!", "(", ")", ","];

function tokenize(source: string): Token[] {
  // 中文输入法下很容易打出全角符号，统一成半角
  const text = source
    .replace(/，/g, ",")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(text.slice(i));
      if (!m) throw new Error("数字格式不对");
      tokens.push({ kind: "num", value: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const end = text.indexOf(ch, i + 1);
      if (end < 0) throw new Error("字符串缺少结尾的引号");
      tokens.push({ kind: "str", value: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const op = OPERATORS.find((o) => text.startsWith(o, i));
    if (op) {
      tokens.push({ kind: "op", value: op });
      i += op.length;
      continue;
    }
    const id = /^[A-Za-z_一-鿿][\w一-鿿]*/.exec(text.slice(i));
    if (!id) throw new Error(`无法识别的字符“${ch}”`);
    tokens.push({ kind: "id", value: id[0] });
    i += id[0].length;
  }
  return tokens;
}

type Node =
  | { type: "lit"; value: FormulaValue }
  | { type: "unary"; op: string; arg: Node }
  | { type: "binary"; op: string; left: Node; right: Node }
  | { type: "call"; name: string; args: Node[] };

function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (...ops: string[]) => {
    const t = peek();
    return !!t && t.kind === "op" && ops.includes(t.value);
  };
  const isWord = (word: string) => {
    const t = peek();
    return !!t && t.kind === "id" && t.value.toLowerCase() === word;
  };
  const expect = (op: string) => {
    if (!isOp(op)) throw new Error(`这里应该是“${op}”`);
    pos++;
  };

  const binary = (next: () => Node, match: () => string | null): Node => {
    let left = next();
    for (let op = match(); op; op = match()) {
      pos++;
      left = { type: "binary", op, left, right: next() };
    }
    return left;
  };

  const primary = (): Node => {
    const t = peek();
    if (!t) throw new Error("公式不完整");
    pos++;
    if (t.kind === "num" || t.kind === "str") return { type: "lit", value: t.value };
    if (t.kind === "op" && t.value === "(") {
      const inner = or();
      expect(")");
      return inner;
    }
    if (t.kind === "id") {
      const lower = t.value.toLowerCase();
      if (lower === "true") return { type: "lit", value: true };
      if (lower === "false") return { type: "lit", value: false };
      if (!isOp("(")) throw new Error(`“${t.value}”后面需要括号，例如 ${t.value}(…)`);
      pos++;
      const args: Node[] = [];
      if (!isOp(")")) {
        do args.push(or());
        while (isOp(",") && ++pos);
      }
      expect(")");
      return { type: "call", name: lower, args };
    }
    throw new Error(`这里不能出现“${t.value}”`);
  };

  const unary = (): Node => {
    if (isOp("-", "!")) {
      const op = tokens[pos++].value as string;
      return { type: "unary", op, arg: unary() };
    }
    if (isWord("not") && tokens[pos + 1] && !(tokens[pos + 1].kind === "op" && tokens[pos + 1].value === "(")) {
      pos++;
      return { type: "unary", op: "!", arg: unary() };
    }
    return primary();
  };

  const mul = () => binary(unary, () => (isOp("*", "/", "%") ? (peek().value as string) : null));
  const add = () => binary(mul, () => (isOp("+", "-") ? (peek().value as string) : null));
  const cmp = () => binary(add, () => (isOp("==", "!=", ">", "<", ">=", "<=") ? (peek().value as string) : null));
  const and = () => binary(cmp, () => (isOp("&&") || isWord("and") ? "&&" : null));
  function or(): Node {
    return binary(and, () => (isOp("||") || isWord("or") ? "||" : null));
  }

  const tree = or();
  if (pos < tokens.length) throw new Error("公式末尾有多余的内容");
  return tree;
}

const truthy = (v: FormulaValue) => v !== null && v !== false && v !== 0 && v !== "";

function toNumber(v: FormulaValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === null || v === "") return 0;
  const n = parseFloat(v);
  if (Number.isNaN(n)) throw new Error(`“${v}”不是数字`);
  return n;
}

const toText = (v: FormulaValue) => (v === null ? "" : typeof v === "boolean" ? (v ? "是" : "否") : String(v));

function toDay(v: FormulaValue): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(toText(v));
  if (!m) throw new Error(`“${toText(v)}”不是日期`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function evaluate(node: Node, prop: (name: string) => FormulaValue): FormulaValue {
  const ev = (n: Node) => evaluate(n, prop);
  switch (node.type) {
    case "lit":
      return node.value;
    case "unary": {
      const v = ev(node.arg);
      return node.op === "-" ? -toNumber(v) : !truthy(v);
    }
    case "binary": {
      if (node.op === "&&") return truthy(ev(node.left)) && truthy(ev(node.right));
      if (node.op === "||") return truthy(ev(node.left)) || truthy(ev(node.right));
      const a = ev(node.left);
      const b = ev(node.right);
      switch (node.op) {
        case "+":
          // 有一边是文字就当作拼接
          return typeof a === "string" || typeof b === "string" ? toText(a) + toText(b) : toNumber(a) + toNumber(b);
        case "-":
          return toNumber(a) - toNumber(b);
        case "*":
          return toNumber(a) * toNumber(b);
        case "/": {
          const d = toNumber(b);
          if (d === 0) throw new Error("不能除以 0");
          return toNumber(a) / d;
        }
        case "%":
          return toNumber(a) % toNumber(b);
        case "==":
          return typeof a === "number" || typeof b === "number" ? toNumber(a) === toNumber(b) : toText(a) === toText(b);
        case "!=":
          return typeof a === "number" || typeof b === "number" ? toNumber(a) !== toNumber(b) : toText(a) !== toText(b);
        default: {
          // 两边都是文字（比如日期）时按字典序比较，否则按数字
          const textual = typeof a === "string" && typeof b === "string";
          const x = textual ? a : toNumber(a);
          const y = textual ? b : toNumber(b);
          if (node.op === ">") return x > y;
          if (node.op === "<") return x < y;
          if (node.op === ">=") return x >= y;
          return x <= y;
        }
      }
    }
    case "call": {
      const { name, args } = node;
      const need = (min: number, max = min) => {
        if (args.length < min || args.length > max) {
          throw new Error(`${name}() 需要 ${min === max ? min : `${min}～${max}`} 个参数`);
        }
      };
      switch (name) {
        case "prop":
          need(1);
          return prop(toText(ev(args[0])));
        case "if":
          need(3);
          return truthy(ev(args[0])) ? ev(args[1]) : ev(args[2]);
        case "not":
          need(1);
          return !truthy(ev(args[0]));
        case "empty":
          need(1);
          return !truthy(ev(args[0]));
        case "round": {
          need(1, 2);
          const factor = 10 ** (args[1] ? toNumber(ev(args[1])) : 0);
          return Math.round(toNumber(ev(args[0])) * factor) / factor;
        }
        case "floor":
          need(1);
          return Math.floor(toNumber(ev(args[0])));
        case "ceil":
          need(1);
          return Math.ceil(toNumber(ev(args[0])));
        case "abs":
          need(1);
          return Math.abs(toNumber(ev(args[0])));
        case "min":
          need(1, 99);
          return Math.min(...args.map((a) => toNumber(ev(a))));
        case "max":
          need(1, 99);
          return Math.max(...args.map((a) => toNumber(ev(a))));
        case "sum":
          need(1, 99);
          return args.reduce((total, a) => total + toNumber(ev(a)), 0);
        case "concat":
          return args.map((a) => toText(ev(a))).join("");
        case "length":
          need(1);
          return [...toText(ev(args[0]))].length;
        case "contains":
          need(2);
          return toText(ev(args[0])).includes(toText(ev(args[1])));
        case "lower":
          need(1);
          return toText(ev(args[0])).toLowerCase();
        case "upper":
          need(1);
          return toText(ev(args[0])).toUpperCase();
        case "tonumber":
          need(1);
          return toNumber(ev(args[0]));
        case "today":
          need(0);
          return today();
        case "now":
          need(0);
          return new Date().toLocaleString("zh-CN", { hour12: false });
        case "datebetween":
          // 两个日期相差的天数：前者减后者
          need(2);
          return toDay(ev(args[0])) - toDay(ev(args[1]));
        default:
          throw new Error(`没有 ${name}() 这个函数`);
      }
    }
  }
}

/** 只检查公式写得对不对（不计算）。没问题返回 null，否则返回原因。 */
export function checkFormula(source: string): string | null {
  if (!source.trim()) return null;
  try {
    parse(tokenize(source));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

const cache = new Map<string, Node | Error>();

/** 计算一条公式。出错时返回 { error }，不抛异常。 */
export function runFormula(
  source: string,
  prop: (name: string) => FormulaValue,
): { value: FormulaValue } | { error: string } {
  if (!source.trim()) return { value: null };
  let tree = cache.get(source);
  if (!tree) {
    try {
      tree = parse(tokenize(source));
    } catch (err) {
      tree = err instanceof Error ? err : new Error(String(err));
    }
    if (cache.size > 500) cache.clear();
    cache.set(source, tree);
  }
  if (tree instanceof Error) return { error: tree.message };
  try {
    const value = evaluate(tree, prop);
    // 消掉 0.1 + 0.2 这类浮点误差
    return { value: typeof value === "number" ? Number(value.toPrecision(12)) : value };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
