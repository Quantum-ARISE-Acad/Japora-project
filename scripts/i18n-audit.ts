/**
 * Lists user-visible text that is not translated (fr/en).
 *
 * Japora is bilingual: every visible string goes through tr(fr, en) in client
 * components, or trServer / publicText on the server. This audit walks the TSX
 * files and reports single-language text: JSX text, visible attributes
 * (placeholder, title, aria-label, alt, label), strings shown from JSX
 * expressions ({cond ? "a" : "b"}) and messages passed to setError/alert/...
 *
 * Usage: npx tsx scripts/i18n-audit.ts [--json] [paths...]
 * Exit code 1 when something is found (usable in CI).
 */
import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const TRANSLATORS = new Set(["tr", "trServer", "publicText", "t"]);
const VISIBLE_ATTRS = new Set([
  "placeholder", "title", "aria-label", "alt", "label", "description",
  // props of our own components that end up on screen
  "body", "subtitle", "heading", "eyebrow", "hint", "message", "text", "caption", "cta", "ctaLabel",
  "emptyText", "helper", "help", "tooltip", "confirmLabel", "cancelLabel", "badge", "tagline", "note", "action", "actionLabel",
]);
const MESSAGE_SETTERS =
  /^set(Error|Err|Msg|Message|Status|Notice|Toast|ConfigMsg|Info|Success|Warning)\w*$|^showToast\w*$|^toast$|^alert$|^confirm$/;
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

// Texts reviewed as identical in French and English (technical codes, names...).
const NEUTRAL_FILE = join(__dirname, "i18n-neutral.json");
const NEUTRAL = new Set<string>(existsSync(NEUTRAL_FILE) ? JSON.parse(readFileSync(NEUTRAL_FILE, "utf8")) : []);

/** Text that reads the same in both languages, or is not prose. */
export function isNeutral(raw: string): boolean {
  if (NEUTRAL.has(raw) || NEUTRAL.has(raw.replace(/\s+/g, " ").trim())) return true;
  const s = raw.replace(/\$\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
  if (!s) return true;
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(s)) return true; // numbers, symbols, emoji, "·", "→"
  if (
    /^(Japora|WhatsApp|FedaPay|Google|Clerk|Gemini|Meta|Facebook|Instagram|T-Money|Flooz|USSD|XOF|FCFA|OK|ID|URL|QR|CSV|PDF|API|SMS|IA|AI|Grafana|Wataru|Lomé|Togo|N°|No\.|vs|Email|E-mail|Marketplace|Collections|Collection|TikTok|Telegram|Sandbox|Live|Status|Ads|ROAS|CTR|CPC|CTWA|Wave|Orange Money|MTN MoMo|Moov|Togocom|Celtiis|Visa|Mastercard|Japora Pro|Pro|Bot|Soko CRM|WEscrow)$/i.test(
      s,
    )
  )
    return true;
  if (/^[A-Z0-9_./:-]+$/.test(s)) return true; // codes like LINK_CLICKS
  if (/^(https?:|\/|#|@|\+?\d)/.test(s)) return true; // urls, paths, phone numbers
  return false;
}

export type Finding = {
  file: string;
  line: number;
  kind: string;
  /** Exact text (JSX text normalised to single spaces; template literals with ${...} kept). */
  text: string;
  start: number;
  end: number;
  /** How to replace: jsxtext | attr (string attribute) | literal | template */
  mode: "jsxtext" | "attr" | "literal" | "template";
};

// `locale === "en" ? "Orders" : "Commandes"`: already bilingual, both branches are fine.
const LOCALE_TEST = /\b(locale|lang|language|isEn|isFr|isEnglish|isFrench|dashLocale|publicLocale)\b/;
function inLocaleBranch(node: ts.Node): boolean {
  for (let n: ts.Node = node; n.parent; n = n.parent) {
    const p = n.parent;
    if (ts.isConditionalExpression(p) && n !== p.condition && LOCALE_TEST.test(p.condition.getText())) return true;
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && n === p.right && LOCALE_TEST.test(p.left.getText())) return true;
    if (ts.isIfStatement(p) && LOCALE_TEST.test(p.expression.getText())) return true;
    // tr(<>texte</>, <>text</>): JSX passed to a translator is already bilingual.
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && TRANSLATORS.has(p.expression.text)) return true;
  }
  return false;
}

export function auditFile(file: string, src = readFileSync(file, "utf8")): Finding[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Finding[] = [];
  const add = (node: ts.Node, kind: string, text: string, mode: Finding["mode"], start = node.getStart(), end = node.getEnd()) => {
    if (inLocaleBranch(node)) return;
    const { line } = sf.getLineAndCharacterOfPosition(start);
    out.push({ file, line: line + 1, kind, text, start, end, mode });
  };

  // String/template literals that end up displayed (not compared, not call arguments).
  const collectShown = (root: ts.Node, kind: string) => {
    const walk = (n: ts.Node) => {
      if (ts.isCallExpression(n)) return; // tr(...), formatMoney(x, "XOF"), .map(...)
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return;
      if (ts.isBinaryExpression(n) && COMPARISONS.has(n.operatorToken.kind)) return;
      if (ts.isElementAccessExpression(n)) return;
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        if (!isNeutral(n.text)) add(n, kind, n.text, "literal");
        return;
      }
      if (ts.isTemplateExpression(n)) {
        const t = n.getText().slice(1, -1);
        if (!isNeutral(t)) add(n, kind, t, "template");
        return;
      }
      ts.forEachChild(n, walk);
    };
    walk(root);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const raw = node.getText();
      const text = raw.replace(/\s+/g, " ").trim();
      if (!isNeutral(text)) {
        const lead = raw.length - raw.trimStart().length;
        const trail = raw.length - raw.trimEnd().length;
        add(node, "texte", text, "jsxtext", node.getStart() + lead, node.getEnd() - trail);
      }
    }
    if (ts.isJsxAttribute(node) && node.initializer && VISIBLE_ATTRS.has(node.name.getText())) {
      const init = node.initializer;
      const kind = `attribut ${node.name.getText()}`;
      if (ts.isStringLiteral(init)) {
        if (!isNeutral(init.text)) add(init, kind, init.text, "attr");
      } else if (ts.isJsxExpression(init) && init.expression) {
        collectShown(init.expression, kind);
      }
    }
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      collectShown(node.expression, "texte");
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && MESSAGE_SETTERS.test(node.expression.text)) {
      for (const arg of node.arguments) collectShown(arg, `message ${node.expression.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const asJson = process.argv.includes("--json");
  const files = (
    args.length
      ? args
      : execSync("git ls-files -- 'src/app' 'src/components'").toString().trim().split("\n")
  ).filter((f) => f.endsWith(".tsx") && !f.includes("/api/") && !f.includes("/dev/"));

  const findings = files.flatMap((f) => auditFile(f));
  if (asJson) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    const byFile = new Map<string, Finding[]>();
    for (const f of findings) byFile.set(f.file, [...(byFile.get(f.file) ?? []), f]);
    const sorted = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [file, list] of sorted) {
      console.log(`\n${file} (${list.length})`);
      for (const f of list) console.log(`  ${f.line}  [${f.kind}]  ${f.text.slice(0, 100)}`);
    }
    console.log(`\n${findings.length} texte(s) non traduit(s) dans ${byFile.size} fichier(s).`);
  }
  process.exit(findings.length ? 1 : 0);
}

if (process.argv[1]?.endsWith("i18n-audit.ts")) main();
