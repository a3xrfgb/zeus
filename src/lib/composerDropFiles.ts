import { readFile } from "@tauri-apps/plugin-fs";
import {
  inferImageMimeFromFilename,
  isComposerImageFile,
  isImageFileByName,
} from "./imageFileTypes";

export { isComposerImageFile };

export async function filesFromAbsolutePaths(paths: string[]): Promise<File[]> {
  const files: File[] = [];
  for (const path of paths) {
    const bytes = await readFile(path);
    const name = path.replace(/^[\\/]+/, "").split(/[/\\]/).pop() || "file";
    const mime = isImageFileByName(name) ? (inferImageMimeFromFilename(name) ?? "") : "";
    files.push(
      new File([new Blob([bytes], { type: mime || undefined })], name, {
        lastModified: Date.now(),
      }),
    );
  }
  return files;
}
