import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

type Session = { id: string; startedAt: string; endedAt: string | null; ip?: string | null };
type Message = { id: string; role: "user" | "assistant"; content: string; createdAt: string; latencyMs?: number | null };

export default function BotSessions() {
  const { id } = useParams(); // botId
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

  useEffect(() => {
    if (!id) return;
    fetch(`${API}/api/chat/bot/${id}/sessions`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []));
  }, [id, API]);

  const open = async (sessionId: string) => {
    setSelected(sessionId);
    const r = await fetch(`${API}/api/chat/session/${sessionId}/messages`, { credentials: "include" });
    const d = await r.json();
    setMessages(d.messages || []);
  };

  return (
    <main className="container py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conversaciones</h1>
        <Link className="btn" to="/dashboard">Volver</Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <aside className="md:col-span-1">
          <h2 className="font-semibold mb-2">Sesiones</h2>
          <ul className="space-y-2">
            {sessions.map(s => (
              <li key={s.id}>
                <button className={`btn w-full ${selected === s.id ? "btn-primary" : ""}`} onClick={() => open(s.id)}>
                  {new Date(s.startedAt).toLocaleString()} {s.endedAt ? "" : "• en curso"}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="md:col-span-2">
          <h2 className="font-semibold mb-2">Mensajes</h2>
          {selected == null ? (
            <p className="opacity-70">Selecciona una sesión para ver los mensajes.</p>
          ) : messages.length === 0 ? (
            <p className="opacity-70">No hay mensajes.</p>
          ) : (
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id} className={`p-3 rounded ${m.role === "user" ? "bg-zinc-800" : "bg-zinc-700"}`}>
                  <div className="text-xs opacity-70 mb-1">
                    {m.role} • {new Date(m.createdAt).toLocaleTimeString()} {m.latencyMs ? `• ${m.latencyMs}ms` : ""}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
