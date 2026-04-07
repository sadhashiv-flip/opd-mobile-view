/**
 * One-off / repeatable: fluid font-size (cqw) + page padding tokens.
 * Run: node scripts/apply-mobile-fluid-css.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

function walkCss(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkCss(p));
    else if (name.name.endsWith(".css")) out.push(p);
  }
  return out;
}

function transformFontSize(css) {
  return css.replace(/font-size:\s*(\d+(?:\.\d+)?)px\b/g, (match, n) => {
    const num = Number.parseFloat(n);
    if (!Number.isFinite(num) || num <= 0) return match;
    if (num <= 10) {
      return `font-size: max(7px, calc(${n} * 100cqw / 375))`;
    }
    return `font-size: clamp(11px, calc(${n} * 100cqw / 375), calc(${n} * 1.12px))`;
  });
}

function transformPadding(css) {
  let c = css;
  c = c.replace(/\bpadding:\s*0\s+18px\s+16px\b/g, "padding: 0 var(--page-pad-x) clamp(14px, 4.2cqw, 18px)");
  c = c.replace(/\bpadding:\s*0\s+20px\s+24px\b/g, "padding: 0 var(--page-pad-x) clamp(18px, 5cqw, 26px)");
  c = c.replace(/\bpadding:\s*0\s+20px\s+20px\b/g, "padding: 0 var(--page-pad-x) clamp(16px, 4.5cqw, 22px)");
  c = c.replace(/\bpadding:\s*0\s+20px\s+16px\b/g, "padding: 0 var(--page-pad-x) clamp(14px, 4cqw, 18px)");
  c = c.replace(/\bpadding:\s*0\s+18px\s+18px\b/g, "padding: 0 var(--page-pad-x) clamp(14px, 4.2cqw, 18px)");
  c = c.replace(/\bpadding:\s*0\s+16px\s+100px\b/g, "padding: 0 var(--page-pad-x) 100px");
  c = c.replace(/\bpadding:\s*0\s+16px\b(?!\s+\d)/g, "padding: 0 var(--page-pad-x)");
  c = c.replace(/\bpadding:\s*0\s+18px\b(?!\s+\d)/g, "padding: 0 var(--page-pad-x)");
  c = c.replace(/\bpadding:\s*0\s+20px\b(?!\s+\d)/g, "padding: 0 var(--page-pad-x)");
  return c;
}

let changed = 0;
for (const file of walkCss(srcDir)) {
  let text = fs.readFileSync(file, "utf8");
  const next = transformPadding(transformFontSize(text));
  if (next !== text) {
    fs.writeFileSync(file, next);
    changed += 1;
    console.log("updated", path.relative(srcDir, file));
  }
}
console.log(`Done. ${changed} files modified.`);
