import { invoke } from "./core";

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("fs:readTextFile", { path });
}

export async function readFile(path: string): Promise<Uint8Array> {
  const data = await invoke<number[]>("fs:readFile", { path });
  return new Uint8Array(data);
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  return invoke<void>("fs:writeTextFile", { path, contents });
}

export async function writeFile(path: string, contents: Uint8Array | number[]): Promise<void> {
  const bytes = contents instanceof Uint8Array ? Array.from(contents) : contents;
  return invoke<void>("fs:writeFile", { path, contents: bytes });
}

export async function mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
  return invoke<void>("fs:mkdir", { path, recursive: options?.recursive ?? false });
}

export async function remove(path: string): Promise<void> {
  return invoke<void>("fs:remove", { path });
}

export async function exists(path: string): Promise<boolean> {
  return invoke<boolean>("fs:exists", { path });
}

export async function stat(path: string): Promise<{ size: number; isDirectory: boolean; isFile: boolean; mtime: number | null }> {
  return invoke("fs:stat", { path });
}

export async function copyFile(source: string, destination: string): Promise<void> {
  return invoke<void>("fs:copyFile", { source, destination });
}

export async function rename(oldPath: string, newPath: string): Promise<void> {
  return invoke<void>("fs:rename", { oldPath, newPath });
}

export async function readDir(path: string): Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]> {
  return invoke("fs:readDir", { path });
}

export type BaseDirectory = string;

export const BaseDirectory = {
  Home: "home",
  AppData: "appData",
  Download: "download",
  Document: "document",
} as const;

export async function resolvePath(path: string, baseDir?: string): Promise<string> {
  return invoke<string>("fs:resolvePath", { path, baseDir: baseDir ?? null });
}
