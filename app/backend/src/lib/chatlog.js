// app/backend/src/lib/chatlog.js
import { prisma } from "../db/prisma.js";

/** Crea una sesión de chat para un bot */
export async function startSession({ botId, ip, userAgent, meta = {} }) {
  const session = await prisma.chatSession.create({
    data: { botId, ip: ip || null, userAgent: userAgent || null, meta }
  });
  return session;
}

/** Agrega un mensaje a una sesión */
export async function addMessage({ sessionId, role, content, tokenIn = null, tokenOut = null, latencyMs = null }) {
  const msg = await prisma.chatMessage.create({
    data: { sessionId, role, content, tokenIn, tokenOut, latencyMs }
  });
  return msg;
}

/** Cierra la sesión (marca endedAt) */
export async function endSession(sessionId) {
  try {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() }
    });
  } catch {} // idempotente
}
