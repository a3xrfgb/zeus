const MAX_PDF_CHARS = 120_000;

/** Extract plain text from a PDF ArrayBuffer (all pages). */
export async function extractPdfText(buf: ArrayBuffer): Promise<string | null> {
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    const workerUrl =
      typeof workerMod === "object" && workerMod && "default" in workerMod
        ? (workerMod as { default: string }).default
        : String(workerMod);
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let full = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      for (const item of tc.items) {
        if (item && typeof item === "object" && "str" in item) {
          full += `${String((item as { str: string }).str)} `;
        }
      }
      full += "\n";
    }
    const t = full.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return t.length > 0 ? t : null;
  } catch {
    return null;
  }
}

export function truncatePdfText(text: string, max = MAX_PDF_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[…statement truncated for analysis]`;
}
