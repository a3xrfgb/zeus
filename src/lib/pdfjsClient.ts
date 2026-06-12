let workerReady: Promise<void> | null = null;

export async function ensurePdfjsWorker(): Promise<void> {
  if (!workerReady) {
    workerReady = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerMod = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      const workerUrl =
        typeof workerMod === "object" && workerMod && "default" in workerMod
          ? (workerMod as { default: string }).default
          : String(workerMod);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    })();
  }
  return workerReady;
}

export async function loadPdfjs() {
  await ensurePdfjsWorker();
  return import("pdfjs-dist");
}
