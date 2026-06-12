import { invoke } from "./core";

export async function join(...parts: string[]): Promise<string> {
  return invoke<string>("path:join", { parts });
}

export async function tempDir(): Promise<string> {
  return invoke<string>("path:tempDir");
}

export async function appDataDir(): Promise<string> {
  return invoke<string>("path:appDataDir");
}

export async function homeDir(): Promise<string> {
  return invoke<string>("path:homeDir");
}

export async function downloadDir(): Promise<string> {
  return invoke<string>("path:downloadDir");
}

export async function documentDir(): Promise<string> {
  return invoke<string>("path:documentDir");
}

export async function basename(path: string): Promise<string> {
  return invoke<string>("path:basename", { path });
}

export async function dirname(path: string): Promise<string> {
  return invoke<string>("path:dirname", { path });
}

export async function extname(path: string): Promise<string> {
  return invoke<string>("path:extname", { path });
}
