import { BrowserWindow, screen } from "electron";

type ResizeSession = {
  win: BrowserWindow;
  direction: string;
  startBounds: Electron.Rectangle;
  startPoint: Electron.Point;
};

let session: ResizeSession | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function directionIncludes(dir: string, axis: "East" | "West" | "North" | "South"): boolean {
  return dir.includes(axis);
}

function applyResize(): void {
  if (!session || session.win.isDestroyed()) {
    stopResizeDrag();
    return;
  }

  const { win, direction, startBounds, startPoint } = session;
  if (win.isMaximized() || win.isFullScreen()) {
    stopResizeDrag();
    return;
  }

  const point = screen.getCursorScreenPoint();
  const dx = point.x - startPoint.x;
  const dy = point.y - startPoint.y;
  const [minW, minH] = win.getMinimumSize();

  let x = startBounds.x;
  let y = startBounds.y;
  let width = startBounds.width;
  let height = startBounds.height;

  if (directionIncludes(direction, "East")) {
    width = Math.max(minW, startBounds.width + dx);
  }
  if (directionIncludes(direction, "West")) {
    const nextW = Math.max(minW, startBounds.width - dx);
    x = startBounds.x + (startBounds.width - nextW);
    width = nextW;
  }
  if (directionIncludes(direction, "South")) {
    height = Math.max(minH, startBounds.height + dy);
  }
  if (directionIncludes(direction, "North")) {
    const nextH = Math.max(minH, startBounds.height - dy);
    y = startBounds.y + (startBounds.height - nextH);
    height = nextH;
  }

  win.setBounds({ x, y, width, height });
}

export function startResizeDrag(win: BrowserWindow, direction: string): void {
  if (win.isDestroyed() || win.isMaximized() || win.isFullScreen()) return;

  stopResizeDrag();

  session = {
    win,
    direction,
    startBounds: win.getBounds(),
    startPoint: screen.getCursorScreenPoint(),
  };

  timer = setInterval(applyResize, 10);
}

export function stopResizeDrag(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  session = null;
}
