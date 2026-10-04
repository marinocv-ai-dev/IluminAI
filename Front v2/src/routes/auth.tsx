import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/iluminai-logo-completo-positivo.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar · IluminAI" },
      { name: "description", content: "Inicia sesión para explorar evidencia conectada sobre enfermedades raras." },
      { property: "og:title", content: "Entrar · IluminAI" },
      { property: "og:description", content: "Accede al grafo de evidencia de IluminAI con la guía de Ziva." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/atlas" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/atlas" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth` },
          });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) setMsg("Revisa tu correo para confirmar la cuenta.");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setMsg(String(r.error.message ?? r.error));
  }

  return (
    <main className="flex min-h-dvh items-end justify-center bg-graph-surface px-0 pt-20 sm:items-center sm:px-4 sm:py-10">
      <div className="w-full max-w-md rounded-t-2xl border bg-card px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-7 shadow-xl sm:rounded-2xl sm:p-8">
        <Link to="/" className="block w-fit"><img src={logo} alt="IluminAI" className="h-10 w-auto" /></Link>
        <h1 className="mt-8 font-display text-2xl font-semibold">
          {mode === "in" ? "Entra para explorar" : "Crea tu cuenta"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Accede al grafo con la guía de Ziva y conserva tus recorridos.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
             <Input id="email" className="h-12" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Contraseña</Label>
             <Input id="pw" className="h-12" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && <p className="text-sm text-muted-foreground" role="alert">{msg}</p>}
           <Button type="submit" className="h-12 w-full" disabled={busy}>
            {mode === "in" ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>
         <Button variant="outline" className="mt-3 h-12 w-full" onClick={google}>Continuar con Google</Button>
         <Button
           variant="link"
           className="mt-3 h-11 w-full text-muted-foreground"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
         </Button>
      </div>
    </main>
  );
}
