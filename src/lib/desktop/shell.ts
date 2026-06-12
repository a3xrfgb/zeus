import { invoke } from "./core";

export async function open(url: string): Promise<void> {
  return invoke<void>("shell:open", { url });
}

export async function openPath(path: string): Promise<void> {
  return invoke<void>("shell:openPath", { path });
}

export async function showItemInFolder(path: string): Promise<void> {
  return invoke<void>("shell:showItemInFolder", { path });
}
