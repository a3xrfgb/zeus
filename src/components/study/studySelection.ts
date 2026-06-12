/** Collect selected text from the study document root and any nested reader iframes. */
export function getStudySelectionText(root?: ParentNode | null): string {
  const parts: string[] = [];
  const main = window.getSelection()?.toString().trim();
  if (main) parts.push(main);

  const scope =
    root ?? document.querySelector<HTMLElement>("[data-study-document-root]");
  if (!scope) return parts.join("\n");

  for (const iframe of scope.querySelectorAll("iframe")) {
    try {
      const text = iframe.contentDocument?.getSelection()?.toString().trim();
      if (text) parts.push(text);
    } catch {
      /* ignore */
    }
  }

  return parts.join("\n");
}

export async function copyStudySelection(root?: ParentNode | null): Promise<boolean> {
  const text = getStudySelectionText(root);
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function selectAllInStudyRoot(root?: ParentNode | null): void {
  const scope =
    root ?? document.querySelector<HTMLElement>("[data-study-document-root]");
  if (!scope) return;

  const active = document.activeElement;
  if (active instanceof HTMLIFrameElement) {
    try {
      const doc = active.contentDocument;
      const range = doc?.createRange();
      const body = doc?.body;
      if (range && body) {
        range.selectNodeContents(body);
        const sel = doc.defaultView?.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        return;
      }
    } catch {
      /* fall through */
    }
  }

  const range = document.createRange();
  range.selectNodeContents(scope as Node);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
