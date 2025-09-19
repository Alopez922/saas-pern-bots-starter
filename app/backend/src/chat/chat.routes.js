// app/backend/src/chat/chat.routes.js
import { Router } from "express";
import OpenAI from "openai";
import { prisma } from "../db/prisma.js";
import { decrypt } from "../utils/crypto.js";
import { validateOriginAndGetBot } from "../lib/origin.js";
import { startSession, addMessage, endSession } from "../lib/chatlog.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/**
 * POST /api/chat/:publicId
 * Endpoint público para el widget (no requiere auth).
 * Valida origin, llama a OpenAI (no-stream) y LOGUEA conversación.
 */
router.post("/:publicId", async (req, res, next) => {
  try {
    const { publicId } = req.params;
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "message required" });

    // valida origen + learn_once
    const origin = String(req.headers.origin || req.headers.referer || "").replace(/\/$/, "");
    const check = await validateOriginAndGetBot(publicId, origin);
    if (!check.ok) return res.status(check.status).json({ error: check.msg });

    const bot = check.bot;
    const apiKey = bot.openaiKeyEncrypted ? decrypt(bot.openaiKeyEncrypted) : process.env.OPENAI_API_KEY;
    const client = new OpenAI({ apiKey });

    // LOG: abre sesión y guarda mensaje de usuario
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "";
    const ua = req.headers["user-agent"] || "";
    const session = await startSession({ botId: bot.id, ip, userAgent: ua, meta: { origin } });
    await addMessage({ sessionId: session.id, role: "user", content: message });

    const t0 = Date.now();
    const resp = await client.chat.completions.create({
      model: bot.model || "gpt-4o-mini",
      temperature: bot.temperature ?? 0.7,
      max_tokens: bot.maxTokens || 800,
      messages: [
        { role: "system", content: bot.prompt },
        { role: "user", content: message }
      ]
    });

    const reply = resp.choices?.[0]?.message?.content || "...";
    const usage = resp.usage || {};
    const latency = Date.now() - t0;

    // LOG: respuesta del asistente + fin de sesión
    await addMessage({
      sessionId: session.id,
      role: "assistant",
      content: reply,
      tokenIn: usage.prompt_tokens ?? null,
      tokenOut: usage.completion_tokens ?? null,
      latencyMs: latency
    });
    await endSession(session.id);

    res.json({ reply });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/chat/bot/:id/sessions  (PROTEGIDO)
 * Lista sesiones del bot del usuario logueado (multi-tenant).
 */
router.get("/bot/:id/sessions", requireAuth, async (req, res, next) => {
  try {
    const bot = await prisma.bot.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true }
    });
    if (!bot) return res.status(404).json({ error: "bot not found" });

    const sessions = await prisma.chatSession.findMany({
      where: { botId: bot.id },
      orderBy: { startedAt: "desc" },
      select: { id: true, startedAt: true, endedAt: true, ip: true, userAgent: true }
    });

    res.json({ sessions });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/chat/session/:id/messages  (PROTEGIDO)
 * Lista mensajes de una sesión, validando que pertenezca a un bot del usuario.
 */
router.get("/session/:id/messages", requireAuth, async (req, res, next) => {
  try {
    const session = await prisma.chatSession.findUnique({
      where: { id: req.params.id },
      select: { id: true, botId: true }
    });
    if (!session) return res.status(404).json({ error: "session not found" });

    // propiedad
    const bot = await prisma.bot.findFirst({
      where: { id: session.botId, userId: req.user.id },
      select: { id: true }
    });
    if (!bot) return res.status(404).json({ error: "not found" });

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, role: true, content: true, createdAt: true, tokenIn: true, tokenOut: true, latencyMs: true }
    });

    res.json({ messages });
  } catch (e) {
    next(e);
  }
});

export default router;
