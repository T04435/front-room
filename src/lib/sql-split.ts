/**
 * A schema file as single statements. Neon's driver runs one statement per call ("multiple commands in a prepared
 * statement" otherwise), so comments go first (a `; -- note` line once glued two statements together in NotOnQ), then
 * it splits on semicolons outside quotes.
 */
export function splitSql(text: string): string[] {
  const statements: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!quote && c === "-" && text[i + 1] === "-") {
      while (i < text.length && text[i] !== "\n") i++;
      current += "\n";
      continue;
    }
    if (!quote && c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      current += " ";
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === "'" || c === '"') quote = c;
    if (!quote && c === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) statements.push(current.trim());
  return statements.map((s) => s.replace(/\s+\n/g, "\n").replace(/\n{2,}/g, "\n"));
}
