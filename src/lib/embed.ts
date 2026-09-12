// Shared by anything that accepts an "embed:<url>" / "iframe:<url>" prefixed
// value (profile banners, group chat icons, ...) to opt into rendering a
// sandboxed <iframe> instead of a plain image.
export function isEmbedRequest(value: string): boolean {
  return /^(?:embed|iframe):/i.test(value.trim());
}

export function extractEmbedUrl(value: string | undefined | null): string {
  const match = value?.trim().match(/^(?:embed|iframe):(.+)$/i);
  if (!match) return "";
  try {
    const url = new URL(match[1].trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
