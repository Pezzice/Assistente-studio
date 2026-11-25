import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, pinToken } from "@/lib/auth";

async function enter(formData: FormData) {
  "use server";
  const pin = process.env.FAMILY_PIN;
  if (!pin || String(formData.get("pin") ?? "") !== pin) redirect("/login?errore=1");
  (await cookies()).set(COOKIE, await pinToken(pin), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 180,
    path: "/",
  });
  redirect("/");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ errore?: string }> }) {
  const { errore } = await searchParams;
  return (
    <main className="login">
      <h1>Assistente studio</h1>
      <form action={enter}>
        <label htmlFor="pin">PIN di famiglia</label>
        <input id="pin" name="pin" type="password" inputMode="numeric" autoComplete="current-password" required autoFocus />
        {errore && <p className="error">PIN non corretto.</p>}
        <button type="submit">Entra</button>
      </form>
    </main>
  );
}
