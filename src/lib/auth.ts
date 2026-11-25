/** Family PIN check shared by middleware and the login action (Web Crypto, edge-safe). */
export const COOKIE = "studio_pin";

export async function pinToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`assistente-studio:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
