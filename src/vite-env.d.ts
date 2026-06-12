/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  readonly VITE_SPOTIFY_REDIRECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "heic2any" {
  type Heic2AnyResult = Blob | Blob[];
  interface Heic2AnyOptions {
    blob: Blob;
    toType?: string;
    quality?: number;
  }
  function heic2any(options: Heic2AnyOptions): Promise<Heic2AnyResult>;
  export default heic2any;
}
