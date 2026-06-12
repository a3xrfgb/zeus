import type { Rendition } from "epubjs";
import { copyUint8ToArrayBuffer } from "./studyDocument";

const EPUB_SELECTION_CSS = `
  html, body, * {
    user-select: text !important;
    -webkit-user-select: text !important;
  }
`;

/** Allow text selection inside epubjs content iframes. */
export function enableEpubTextSelection(rendition: Rendition): void {
  rendition.hooks.content.register((contents) => {
    const doc = contents.document;
    if (!doc || doc.querySelector("[data-zeus-study-selection]")) return;
    const style = doc.createElement("style");
    style.setAttribute("data-zeus-study-selection", "1");
    style.textContent = EPUB_SELECTION_CSS;
    doc.head.appendChild(style);
  });
}

type NavItemLike = {
  label?: string;
  href?: string;
  subitems?: NavItemLike[];
};

export type EpubTocRow = {
  label: string;
  href: string;
  depth: number;
};

export async function fetchEpubArrayBuffer(blobUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(blobUrl);
  if (!res.ok) throw new Error(`Could not read EPUB (${res.status})`);
  const raw = new Uint8Array(await res.arrayBuffer());
  return copyUint8ToArrayBuffer(raw);
}

export function flattenEpubToc(items: NavItemLike[] | undefined, depth = 0): EpubTocRow[] {
  if (!items?.length) return [];
  const rows: EpubTocRow[] = [];
  for (const item of items) {
    if (!item.href) continue;
    rows.push({
      label: item.label?.trim() || "Chapter",
      href: item.href,
      depth,
    });
    if (item.subitems?.length) {
      rows.push(...flattenEpubToc(item.subitems, depth + 1));
    }
  }
  return rows;
}

/** Spine fallback when the EPUB has no navigation document. */
export function spineFallbackToc(
  spineItems: Array<{ href: string; index: number; label?: string }>,
): EpubTocRow[] {
  return spineItems.map((item, i) => ({
    label: item.label?.trim() || `Section ${i + 1}`,
    href: item.href,
    depth: 0,
  }));
}
