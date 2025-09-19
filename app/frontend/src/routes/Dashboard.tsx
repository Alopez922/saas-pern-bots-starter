import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Bot = {
  id: string;
  name: string;
  publicId: string;
  isActive?: boolean;
  allowedOrigins?: string[];
  embedSnippet?: string; // 👈 viene del backend para “Copiar script”
};

export default function Dashboard() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/bots`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // backend devuelve { bots: [...] }
        const arr: Bot[] = Array.isArray(data) ? data : data?.bots || [];
        setBots(arr);
      } catch (e: any) {
        setErr(e.message || "Error cargando bots");
      } finally {
        setLoading(false);
      }
    })();
  }, [API]);

  const copy = async (text?: string) => {
    if (!text) return alert("No hay snippet disponible.");
    try {
      await navigator.clipboard.writeText(text);
      alert("Snippet copiado ✅");
    } catch {
      // fallback simple
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Snippet copiado ✅");
    }
  };

  if (loading) {
    return (
      <main className="container py-16">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="opacity-70">Cargando…</p>
      </main>
    );
  }

  if (err) {
    return (
      <main className="container py-16">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-red-400">Error: {err}</p>
      </main>
    );
  }

  return (
    <main className="container py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/bots/new" className="btn">
          Crear Bot
        </Link>
      </div>

      {bots.length === 0 ? (
        <p className="mt-6 opacity-80">
          Aún no tienes bots. Crea uno para obtener tu script embebible.
        </p>
      ) : (
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {bots.map((b) => (
            <div key={b.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-neutral-400">
                    publicId: {b.publicId}
                  </div>
                  <div className="text-xs text-neutral-400">
                    origins: {b.allowedOrigins?.join(", ") || "(vacío → learn_once)"}
                  </div>
                  <div className="text-xs">
                    estado:{" "}
                    <span className={b.isActive ? "text-green-400" : "text-red-400"}>
                      {b.isActive ? "activo" : "inactivo"}
                    </span>
                  </div>
                </div>

                <button
                  className="btn"
                  onClick={() => copy(b.embedSnippet)}
                  title="Copiar script"
                >
                  Copiar script
                </button>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm opacity-80">
                  Ver snippet
                </summary>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words">
                  {b.embedSnippet}
                </pre>
              </details>

              <Link className="btn mt-3 w-full" to={`/bots/${b.id}`}>
                Editar
              </Link>

              <Link to={`/bots/${b.id}/sessions`}>Ver charlas</Link>

            </div>
          ))}
        </div>
      )}
    </main>
  );
}
