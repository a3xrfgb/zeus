import { parseRTF, toHTML } from "@jonahschulte/rtf-toolkit";
import JSZip from "jszip";
import mammoth from "mammoth";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { StudyCsvData } from "./studyDocument";
import { uint8ToArrayBuffer } from "./studyDocument";

export type StudySpreadsheetData = {
  sheets: Array<{ name: string; data: StudyCsvData }>;
};

export type ParsedHtmlDocument = {
  html: string;
  /** When true, render inside a sandboxed iframe (full HTML exports). */
  framed: boolean;
  assetUrls?: string[];
};

export function parseDelimitedText(
  text: string,
  delimiter: "," | "\t",
): StudyCsvData {
  return Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (h) => h.trim(),
  });
}

function sheetToCsvData(sheet: XLSX.WorkSheet): StudyCsvData {
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (matrix.length === 0) {
    return { data: [], meta: { fields: [] }, errors: [] };
  }
  const headerRow = matrix[0] ?? [];
  const fields = headerRow.map((cell, i) => {
    const label = String(cell ?? "").trim();
    return label || `Column ${i + 1}`;
  });
  const data = matrix.slice(1).map((row) => {
    const record: Record<string, string> = {};
    fields.forEach((field, i) => {
      record[field] = String(row?.[i] ?? "");
    });
    return record;
  });
  return { data, meta: { fields }, errors: [] };
}

export function parseSpreadsheetBytes(raw: Uint8Array): StudySpreadsheetData {
  const wb = XLSX.read(uint8ToArrayBuffer(raw), { type: "array" });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    data: sheetToCsvData(wb.Sheets[name]),
  }));
  if (sheets.length === 0) {
    sheets.push({ name: "Sheet1", data: { data: [], meta: { fields: [] }, errors: [] } });
  }
  return { sheets };
}

export async function parseDocxBytes(raw: Uint8Array): Promise<string> {
  const result = await mammoth.convertToHtml({
    arrayBuffer: uint8ToArrayBuffer(raw),
  });
  return result.value;
}

function stripScripts(html: string): string {
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

export function parseHtmlText(text: string): ParsedHtmlDocument {
  const trimmed = text.trim();
  if (!trimmed) {
    return { html: "<p>(Empty document)</p>", framed: false };
  }
  if (/<html[\s>]/i.test(trimmed)) {
    return { html: stripScripts(trimmed), framed: true };
  }
  const doc = new DOMParser().parseFromString(trimmed, "text/html");
  const bodyHtml = doc.body?.innerHTML?.trim();
  if (bodyHtml) {
    return { html: stripScripts(bodyHtml), framed: false };
  }
  return { html: stripScripts(`<pre>${escapeHtml(trimmed)}</pre>`), framed: false };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function odfInline(el: Element): string {
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;
    const tag = child.localName;
    if (tag === "span" || tag === "a") {
      out += odfInline(child);
    } else if (tag === "s" || tag === "line-break") {
      out += tag === "line-break" ? "<br/>" : odfInline(child);
    } else {
      out += odfChildrenToHtml(child);
    }
  }
  return out;
}

function odfChildrenToHtml(el: Element): string {
  return [...el.children].map(odfElementToHtml).join("");
}

function odfElementToHtml(el: Element): string {
  const tag = el.localName;
  const ns = el.namespaceURI ?? "";

  if (ns.includes("text")) {
    if (tag === "h") {
      const level = Math.min(
        6,
        Math.max(1, Number.parseInt(el.getAttribute("text:outline-level") ?? "1", 10) || 1),
      );
      return `<h${level}>${odfInline(el)}</h${level}>`;
    }
    if (tag === "p") {
      const text = odfInline(el);
      return text ? `<p>${text}</p>` : "";
    }
    if (tag === "list") {
      const items = [...el.children].filter((c) => c.localName === "list-item");
      const lis = items
        .map((item) => `<li>${odfChildrenToHtml(item).replace(/^<p>|<\/p>$/g, "")}</li>`)
        .join("");
      return `<ul>${lis}</ul>`;
    }
    if (tag === "list-item") return odfChildrenToHtml(el);
  }

  if (ns.includes("table") && tag === "table") {
    const rows = [...el.getElementsByTagName("*")].filter((n) => n.localName === "table-row");
    const trs = rows
      .map((row) => {
        const cells = [...row.children].filter((c) => c.localName === "table-cell");
        const tds = cells.map((cell) => `<td>${odfInline(cell)}</td>`).join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    return `<table>${trs}</table>`;
  }

  return odfChildrenToHtml(el);
}

export async function parseOdtBytes(raw: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(raw);
  const content = zip.file("content.xml");
  if (!content) throw new Error("Invalid ODT: missing content.xml");
  const xml = await content.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Invalid ODT: could not parse content.xml");

  const body =
    [...doc.getElementsByTagName("*")].find(
      (el) => el.localName === "body" && (el.namespaceURI ?? "").includes("office"),
    ) ??
    [...doc.getElementsByTagName("*")].find((el) => el.localName === "text" && (el.namespaceURI ?? "").includes("office"));

  if (!body) throw new Error("Invalid ODT: document body not found");
  const html = odfChildrenToHtml(body);
  return html || "<p>(Empty document)</p>";
}

export function parseRtfBytes(raw: Uint8Array): string {
  const text = new TextDecoder("latin1").decode(raw);
  const doc = parseRTF(text);
  return toHTML(doc);
}

export async function parseZippedHtmlBytes(raw: Uint8Array): Promise<ParsedHtmlDocument> {
  const zip = await JSZip.loadAsync(raw);
  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);
  const htmlEntry =
    entries.find(([n]) => /(^|\/)index\.html?$/i.test(n))?.[0] ??
    entries.find(([n]) => /\.html?$/i.test(n))?.[0];
  if (!htmlEntry) {
    throw new Error("No HTML file found in this zip archive.");
  }

  const baseDir = htmlEntry.includes("/") ? htmlEntry.slice(0, htmlEntry.lastIndexOf("/") + 1) : "";
  let html = await zip.file(htmlEntry)!.async("string");
  const assetUrls: string[] = [];
  const replacements: Array<{ from: string; to: string }> = [];

  for (const [path] of entries) {
    if (path === htmlEntry) continue;
    const blob = await zip.file(path)!.async("blob");
    const url = URL.createObjectURL(blob);
    assetUrls.push(url);
    const rel = path.startsWith(baseDir) ? path.slice(baseDir.length) : path;
    replacements.push({ from: rel, to: url });
    replacements.push({ from: `./${rel}`, to: url });
    const fileName = rel.split("/").pop() ?? rel;
    if (fileName !== rel) {
      replacements.push({ from: fileName, to: url });
    }
  }

  replacements.sort((a, b) => b.from.length - a.from.length);
  for (const { from, to } of replacements) {
    html = html.split(from).join(to);
  }

  const parsed = parseHtmlText(html);
  return { ...parsed, assetUrls };
}
