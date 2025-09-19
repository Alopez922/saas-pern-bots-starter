// app/backend/src/lib/origin.js
import { prisma } from "../db/prisma.js";

/**
 * Valida el origen contra allowedOrigins (TEXT[]) del bot.
 * - Si la lista está vacía => learn_once: guarda el primer origin automáticamente.
 * - Devuelve { ok, status, msg, bot } para usar en rutas HTTP/WS.
 */
export async function validateOriginAndGetBot(publicId, originRaw) {
  const bot = await prisma.bot.findUnique({ where: { publicId } });
  if (!bot || !bot.isActive) {
    return { ok: false, status: 404, msg: "Bot not found" };
  }

  const origin = String(originRaw || "").replace(/\/$/, "");
  const list = (bot.allowedOrigins || []).map((o) => o.replace(/\/$/, ""));

  // Si ya hay orígenes, validar
  if (list.length > 0) {
    if (origin && list.includes(origin)) return { ok: true, bot };
    return { ok: false, status: 403, msg: "Origin not allowed" };
  }

  // learn_once: si no hay orígenes aún, aprendemos el primero
  if (!origin) return { ok: false, status: 400, msg: "Missing Origin" };

  await prisma.bot.update({
    where: { id: bot.id },
    data: { allowedOrigins: { push: origin } },
  });

  return { ok: true, bot: { ...bot, allowedOrigins: [origin] } };
}
