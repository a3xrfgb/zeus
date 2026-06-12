export interface ZeusDesktopApi {
  isDesktop: true;
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  onEvent<T>(event: string, handler: (payload: T) => void): () => void;
}

declare global {
  interface Window {
    zeus?: ZeusDesktopApi;
  }
}

export {};
