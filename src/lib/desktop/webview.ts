import { listen } from "./event";

export function getCurrentWebview() {
  return {
    onDragDropEvent(handler: (event: { payload: { type: string; paths?: string[]; position?: { x: number; y: number } } }) => void) {
      return listen("webview:drag-drop", handler);
    },
  };
}
