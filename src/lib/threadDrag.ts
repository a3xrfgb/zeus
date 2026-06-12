/** Custom data transfer type for dragging one or more chat threads to a project. */
export const THREAD_DRAG_MIME = "application/x-zeus-thread-ids+json";

const THREAD_DRAG_PLAIN_PREFIX = "zeus-thread-ids:";

function parseThreadIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function writeThreadIdsToDataTransfer(
  dt: DataTransfer,
  threadIds: string[],
): void {
  const payload = JSON.stringify(threadIds);
  dt.setData(THREAD_DRAG_MIME, payload);
  // Fallback for environments that strip custom MIME types during drag.
  dt.setData("text/plain", `${THREAD_DRAG_PLAIN_PREFIX}${payload}`);
  dt.effectAllowed = "move";
}

export function readThreadIdsFromDataTransfer(dt: DataTransfer): string[] {
  try {
    const custom = dt.getData(THREAD_DRAG_MIME);
    if (custom) {
      const ids = parseThreadIds(custom);
      if (ids.length > 0) return ids;
    }

    const plain = dt.getData("text/plain");
    if (plain.startsWith(THREAD_DRAG_PLAIN_PREFIX)) {
      return parseThreadIds(plain.slice(THREAD_DRAG_PLAIN_PREFIX.length));
    }
    return [];
  } catch {
    return [];
  }
}
