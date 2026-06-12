import { invoke } from "./core";

type OpenOptions = {
  directory?: boolean;
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
};

export async function open(options?: OpenOptions): Promise<string | string[] | null> {
  return invoke<string | string[] | null>("dialog:open", { options: options ?? {} });
}

export async function save(options?: {
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | null> {
  return invoke<string | null>("dialog:save", { options: options ?? {} });
}

export async function message(
  message: string,
  options?: { title?: string; kind?: "info" | "warning" | "error" },
): Promise<void> {
  return invoke<void>("dialog:message", { message, options: options ?? {} });
}

export async function ask(message: string, options?: { title?: string; kind?: "info" | "warning" | "error" }): Promise<boolean> {
  return invoke<boolean>("dialog:ask", { message, options: options ?? {} });
}

export async function confirm(message: string, options?: { title?: string; kind?: "info" | "warning" | "error" }): Promise<boolean> {
  return ask(message, options);
}
