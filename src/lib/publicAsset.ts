/** Public folder asset URL — works in dev (http) and packaged Electron (file://). */
export function publicAsset(path: string): string {
  const clean = path.replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
}
