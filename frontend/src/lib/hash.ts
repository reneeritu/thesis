/** SHA-256 of UTF-8 string (e.g. URL), hex lowercase — matches legacy archive URL hashing. */
export async function sha256HexFromString(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
