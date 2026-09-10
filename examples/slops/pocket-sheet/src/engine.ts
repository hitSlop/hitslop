// Lightweight MIT Formula Engine for Pocket Spreadsheet
// Inspired by _docs/spreadsheet-main/modules/formulaManager.js

export function colToLetter(col: number): string {
  if (!Number.isInteger(col) || col < 0) return "";
  let n = col;
  let letters = "";
  while (n >= 0) {
    const remainder = n % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return letters;
}

export function letterToCol(letters: string): number {
  letters = letters.toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return {
    col: letterToCol(match[1]),
    row: parseInt(match[2], 10) - 1,
  };
}

export function parseRange(rangeStr: string): {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
} | null {
  const parts = rangeStr.split(":");
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return null;
  return {
    startRow: Math.min(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endRow: Math.max(start.row, end.row),
    endCol: Math.max(start.col, end.col),
  };
}

export type CellValue = {
  display: string;
  numeric?: number;
  isError?: boolean;
  visual?: {
    type: "progress" | "tag" | "rating";
    value: any;
  };
};

export function evaluateCell(
  raw: string,
  getCellRaw: (ref: string) => string,
  visited = new Set<string>()
): CellValue {
  if (!raw || typeof raw !== "string") {
    return { display: "" };
  }

  const trimmed = raw.trim();
  if (!trimmed.startsWith("=")) {
    // Normal literal number or text
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== "") {
      return { display: trimmed, numeric: num };
    }
    return { display: raw };
  }

  const expr = trimmed.slice(1).trim();

  // 1. Visual Widgets
  // =PROGRESS(0.75)
  const progressMatch = expr.match(/^PROGRESS\s*\(([^)]+)\)$/i);
  if (progressMatch) {
    const val = evaluateArgument(progressMatch[1].trim(), getCellRaw, visited);
    const num = Number(val);
    const clamped = isNaN(num) ? 0 : Math.max(0, Math.min(1, num));
    return {
      display: `${Math.round(clamped * 100)}%`,
      numeric: clamped,
      visual: { type: "progress", value: clamped },
    };
  }

  // =TAG("Status")
  const tagMatch = expr.match(/^TAG\s*\(([^)]+)\)$/i);
  if (tagMatch) {
    const rawVal = tagMatch[1].trim().replace(/^["']|["']$/g, "");
    return {
      display: rawVal,
      visual: { type: "tag", value: rawVal },
    };
  }

  // =RATING(4)
  const ratingMatch = expr.match(/^RATING\s*\(([^)]+)\)$/i);
  if (ratingMatch) {
    const val = evaluateArgument(ratingMatch[1].trim(), getCellRaw, visited);
    const count = Math.max(1, Math.min(5, Math.round(Number(val) || 0)));
    return {
      display: "★".repeat(count),
      numeric: count,
      visual: { type: "rating", value: count },
    };
  }

  // 2. Standard Functions: SUM, AVG, AVERAGE, MIN, MAX, COUNT
  const funcMatch = expr.match(/^(SUM|AVG|AVERAGE|MIN|MAX|COUNT)\s*\(([^)]+)\)$/i);
  if (funcMatch) {
    const fn = funcMatch[1].toUpperCase();
    const argsRange = funcMatch[2].trim();
    const numbers = getNumbersFromRangeOrArgs(argsRange, getCellRaw, visited);

    if (numbers.includes(NaN)) {
      return { display: "#VALUE!", isError: true };
    }

    let result = 0;
    if (fn === "SUM") {
      result = numbers.reduce((acc, n) => acc + n, 0);
    } else if (fn === "AVG" || fn === "AVERAGE") {
      result = numbers.length > 0 ? numbers.reduce((acc, n) => acc + n, 0) / numbers.length : 0;
    } else if (fn === "MIN") {
      result = numbers.length > 0 ? Math.min(...numbers) : 0;
    } else if (fn === "MAX") {
      result = numbers.length > 0 ? Math.max(...numbers) : 0;
    } else if (fn === "COUNT") {
      result = numbers.length;
    }

    const rounded = Math.round(result * 100) / 100;
    return {
      display: String(rounded),
      numeric: rounded,
    };
  }

  // 3. Mathematical Expression with Cell References: e.g. B2 - C2 or A1 * 1.05
  try {
    // Normalize dashes first (en-dash, em-dash, minus sign)
    const normalizedExpr = expr.replace(/[\u2013\u2014\u2212]/g, "-");

    const resolvedExpr = normalizedExpr.replace(/\b([A-Z]+[0-9]+)\b/gi, (match) => {
      const upper = match.toUpperCase();
      if (visited.has(upper)) throw new Error("CIRCULAR");
      const nextVisited = new Set(visited);
      nextVisited.add(upper);

      const targetRaw = getCellRaw(upper);
      const res = evaluateCell(targetRaw, getCellRaw, nextVisited);
      if (res.isError) throw new Error("ERROR");
      return String(res.numeric ?? 0);
    });

    // CSP-safe math evaluation without eval or new Function
    const val = evaluateMath(resolvedExpr);
    if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
      const rounded = Math.round(val * 100) / 100;
      return { display: String(rounded), numeric: rounded };
    }
    return { display: "#VALUE!", isError: true };
  } catch (err: any) {
    if (err?.message === "CIRCULAR") return { display: "#REF!", isError: true };
    if (err?.message === "DIV0") return { display: "#DIV/0!", isError: true };
    return { display: "#ERROR!", isError: true };
  }
}

export function evaluateMath(input: string): number {
  const normalized = input
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\s+/g, "");

  let pos = 0;
  function peek(): string { return normalized[pos] || ""; }
  function get(): string { return normalized[pos++] || ""; }

  function parseExpression(): number {
    let result = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = get();
      const next = parseTerm();
      if (op === "+") result += next;
      else result -= next;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = get();
      const next = parseFactor();
      if (op === "*") result *= next;
      else {
        if (next === 0) throw new Error("DIV0");
        result /= next;
      }
    }
    return result;
  }

  function parseFactor(): number {
    if (peek() === "+") { get(); return parseFactor(); }
    if (peek() === "-") { get(); return -parseFactor(); }
    if (peek() === "(") {
      get();
      const res = parseExpression();
      if (peek() === ")") get();
      return res;
    }
    const start = pos;
    while (/[0-9.]/.test(peek())) get();
    if (start === pos) throw new Error("SYNTAX");
    const num = Number(normalized.slice(start, pos));
    if (isNaN(num)) throw new Error("NAN");
    return num;
  }

  const res = parseExpression();
  if (pos < normalized.length) throw new Error("TRAILING");
  return res;
}

function evaluateArgument(
  arg: string,
  getCellRaw: (ref: string) => string,
  visited: Set<string>
): string | number {
  const upper = arg.toUpperCase();
  if (/^[A-Z]+\d+$/.test(upper)) {
    const res = evaluateCell(getCellRaw(upper), getCellRaw, visited);
    return res.numeric ?? res.display;
  }
  const num = Number(arg);
  return isNaN(num) ? arg : num;
}

function getNumbersFromRangeOrArgs(
  argStr: string,
  getCellRaw: (ref: string) => string,
  visited: Set<string>
): number[] {
  const range = parseRange(argStr);
  if (range) {
    const list: number[] = [];
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        const ref = `${colToLetter(c)}${r + 1}`;
        if (visited.has(ref)) return [NaN];
        const nextVisited = new Set(visited);
        nextVisited.add(ref);

        const raw = getCellRaw(ref);
        if (raw && raw.trim() !== "") {
          const res = evaluateCell(raw, getCellRaw, nextVisited);
          if (res.numeric !== undefined) {
            list.push(res.numeric);
          }
        }
      }
    }
    return list;
  }

  // Comma separated list of references or literals
  return argStr.split(",").map((item) => {
    const val = evaluateArgument(item.trim(), getCellRaw, visited);
    return Number(val) || 0;
  });
}
