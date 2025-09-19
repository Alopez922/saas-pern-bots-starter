// app/backend/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import url from "url";
import OpenAI from "openai";

import authRoutes from "./auth/auth.routes.js";
import botsRoutes from "./bots/bots.routes.js";
import chatRoutes from "./chat/chat.routes.js";
import billingRoutes from "./billing/stripe.routes.js";
import embedRoutes from "./embeds/embed.routes.js";

import { prisma } from "./db/prisma.js";
import { decrypt } from "./utils/crypto.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { validateOriginAndGetBot } from "./lib/origin.js";

// -------------------- APP HTTP --------------------
const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.APP_URL, // p.ej. http://localhost:5173
    credentials: true,
  })
);

// Rutas HTTP
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/bots", botsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/embed", embedRoutes);

// Manejador de errores
app.use(errorHandler);

// -------------------- HTTP + WEBSOCKET --------------------
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

/** ===================== SESIONES (WS/HTTP) =====================
 *  Mantenemos un mapa en memoria: (publicId|sid) -> sessionId (DB)
 *  Esto permite que si el widget se reconecta (misma pestaña, mismo sid),
 *  RE-USEMOS la misma sesión en la base de datos (ChatSession).
 */
const sessionsByKey = new Map(); // key: `${publicId}|${sid}` -> value: sessionId (string)
function keyOf(publicId, sid) {
  return `${publicId}|${sid}`;
}

// Helpers de sesiones/mensajes (DB)
async function startSession(bot, meta = {}) {
  return prisma.chatSession.create({
    data: {
      botId: bot.id,
      ip: meta.ip || null,
      userAgent: meta.ua || null,
      meta: Object.keys(meta).length ? meta : null,
    },
  });
}
async function addMessage(sessionId, role, content, extra = {}) {
  return prisma.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
      tokenIn: extra.tokenIn ?? null,
      tokenOut: extra.tokenOut ?? null,
      latencyMs: extra.latencyMs ?? null,
    },
  });
}
async function endSession(sessionId) {
  return prisma.chatSession.update({
    where: { id: sessionId },
    data: { endedAt: new Date() },
  });
}
async function getHistory(sessionId, limit = 20) {
  const rows = await prisma.chatMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { role: true, content: true },
  });
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

// Upgrade de WS: /ws/chat/:publicId?sid=...
server.on("upgrade", async (req, socket, head) => {
  try {
    const parsed = url.parse(req.url, true);
    const { pathname, query } = parsed || {};
    const parts = (pathname || "").split("/").filter(Boolean); // ["ws","chat","<publicId>"]
    if (parts[0] !== "ws" || parts[1] !== "chat" || !parts[2]) {
      socket.destroy();
      return;
    }

    const publicId = parts[2];
    const sid = String(query?.sid || ""); // <-- sid requerido
    if (!sid) {
      socket.destroy();
      return;
    }

    const origin = String(req.headers.origin || req.headers.referer || "").replace(/\/$/, "");

    // Valida origen + learn_once
    const check = await validateOriginAndGetBot(publicId, origin);
    if (!check.ok) {
      socket.destroy();
      return;
    }
    const bot = check.bot;

    // (Opcional) verificar suscripción activa del dueño
    // const sub = await prisma.subscription.findFirst({ where: { userId: bot.userId, status: "active" } });
    // if (!sub) { socket.destroy(); return; }

    // Pasamos publicId y sid al handler WS vía "ctx"
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { bot, publicId, sid });
    });
  } catch {
    socket.destroy();
  }
});

// Conexión WS: streaming con HISTORIAL y reuso de sesión por (publicId|sid)
wss.on("connection", (ws, req, ctx) => {
  const bot = ctx.bot;
  const publicId = ctx.publicId;
  const sid = ctx.sid;

  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
  const ua = (req.headers["user-agent"] || "").toString();

  const mapKey = keyOf(publicId, sid);
  let sessionId = sessionsByKey.get(mapKey) || null;

  let idleTimer = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    // Cierra el socket por inactividad (2 min), pero NO cierres la sesión en DB
    // para permitir reuso (misma pestaña + mismo sid).
    idleTimer = setTimeout(async () => {
      try { ws.close(); } catch {}
    }, 2 * 60 * 1000);
  };

  resetIdle();

  ws.on("message", async (raw) => {
    try {
      resetIdle();
      const msg = JSON.parse(raw.toString());
      // Espera { type: "user_msg", text: "..." }
      if (msg.type !== "user_msg" || !msg.text) return;

      // 1) Buscar/crear sesión DB una vez por (publicId|sid)
      if (!sessionId) {
        const s = await startSession(bot, { ip, ua, sid, publicId });
        sessionId = s.id;
        sessionsByKey.set(mapKey, sessionId);
        // Envía el id al cliente (opcional)
        try {
          ws.send(JSON.stringify({ type: "session", id: sessionId, sid }));
        } catch {}
      }

      // 2) Guardar mensaje del usuario
      const userText = String(msg.text);
      await addMessage(sessionId, "user", userText);

      // 3) Construir historial con contexto
      const history = await getHistory(sessionId, 20); // hasta 20 previos
      const messages = [
        { role: "system", content: bot.prompt },
        ...history, // incluye turnos previos (ya trae el user recién guardado)
      ];

      // 4) Llamar a OpenAI en stream
      const apiKey = bot.openaiKeyEncrypted ? decrypt(bot.openaiKeyEncrypted) : process.env.OPENAI_API_KEY;
      const client = new OpenAI({ apiKey });

      const tStart = Date.now();
      const stream = await client.chat.completions.create({
        model: bot.model || "gpt-4o-mini",
        temperature: bot.temperature ?? 0.7,
        max_tokens: bot.maxTokens || 800,
        stream: true,
        messages,
      });

      ws.send(JSON.stringify({ type: "bot_start" }));

      let assistantText = "";
      let tFirstChunk = null;

      for await (const part of stream) {
        const delta = part?.choices?.[0]?.delta?.content || "";
        if (delta) {
          if (!tFirstChunk) tFirstChunk = Date.now();
          assistantText += delta;
          ws.send(JSON.stringify({ type: "bot_delta", delta }));
        }
      }

      const latencyMs = tFirstChunk ? tFirstChunk - tStart : null;

      // 5) Guardar respuesta del bot
      await addMessage(sessionId, "assistant", assistantText, { latencyMs });

      ws.send(JSON.stringify({ type: "bot_done" }));

      // Nota: NO cerramos la sesión aquí. Queda viva para reuso por el mismo sid.
    } catch (e) {
      try {
        ws.send(JSON.stringify({ type: "bot_error", error: "stream_failed" }));
      } catch {}
    }
  });

  ws.on("close", async () => {
    if (idleTimer) clearTimeout(idleTimer);
    // No cerramos la sesión en DB aquí para permitir reuso por el mismo sid.
    // Si quieres marcar "endedAt" en algún momento, podemos implementar un GC por inactividad prolongada.
  });
});

// -------------------- RUN --------------------
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`[backend] http://localhost:${PORT}`));
