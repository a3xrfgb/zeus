type Unlisten = () => void;

async function waitForEvents(): Promise<void> {
  if (window.zeus?.onEvent) return;
  const start = Date.now();
  while (!window.zeus?.onEvent) {
    if (Date.now() - start > 8000) return;
    await new Promise((r) => setTimeout(r, 25));
  }
}

export async function listen<T>(
  event: string,
  handler: (ev: { payload: T }) => void,
): Promise<Unlisten> {
  await waitForEvents();
  if (!window.zeus?.onEvent) {
    return () => {};
  }
  return window.zeus.onEvent<T>(event, (payload) => handler({ payload }));
}
