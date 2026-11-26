// The app is served under the Vite `base` (/runtime), and nginx proxies
// /runtime/productImg to the backend. Backend image paths start at "/".
export function assetUrl(path: string): string {
  if (!path.startsWith('/')) return path
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`
}
