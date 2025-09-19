import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
// 👇 protege TODO /api/bots
router.use(requireAuth);

// "a,b , c/" -> ["a","b","c"] (sin slash final)
function normalizeOrigins(val) {
  if (Array.isArray(val)) {
    return val
      .map(String)
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }
  const str = String(val ?? "");
  if (!str.trim()) return [];
  return str
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

// CREATE
router.post("/", async (req, res, next) => {
  try {
    const {
      userId,                 // en prod debería venir de req.user.id
      name,
      prompt,
      model = "gpt-4o-mini",
      temperature = 0.7,
      maxTokens = 800,
      openaiKeyEncrypted = null,
      n8nWebhookUrl = null,
      allowedOrigins
    } = req.body || {};

    // Asegurar ownerId
    let ownerId = userId || (req.user && req.user.id);
    if (!ownerId) {
      const u = await prisma.user.findFirst();
      if (!u) return res.status(400).json({ error: "No hay usuarios para asignar como dueño (seed primero un User)" });
      ownerId = u.id;
    }

    const allowed = normalizeOrigins(allowedOrigins);

    const bot = await prisma.bot.create({
      data: {
        userId: ownerId,          // <- usa FK directa, NADA de { user: ... }
        name,
        prompt,
        model,
        temperature,
        maxTokens,
        openaiKeyEncrypted,
        n8nWebhookUrl,
        allowedOrigins: allowed,  // <- siempre array
        isActive: true,
      },
    });

    res.json({ ok: true, bot });
  } catch (e) {
    next(e);
  }
});

// UPDATE (PUT/PATCH)
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const data = { ...req.body };

    // Nunca permitir anidar 'user' en updates
    if ("user" in data) delete data.user;

    // Normalizar allowedOrigins si viene
    if ("allowedOrigins" in data) {
      data.allowedOrigins = normalizeOrigins(data.allowedOrigins);
    }

    // Limpieza opcional de nullables
    if ("n8nWebhookUrl" in data && data.n8nWebhookUrl == null) data.n8nWebhookUrl = null;
    if ("openaiKeyEncrypted" in data && data.openaiKeyEncrypted == null) data.openaiKeyEncrypted = null;

    const bot = await prisma.bot.update({ where: { id }, data });
    res.json({ ok: true, bot });
  } catch (e) {
    next(e);
  }
});
// helper: arma el snippet
function buildEmbedSnippet(bot, req) {
  // Detecta base del servidor (usa ENV si existe, si no se arma con host)
  const base =
    process.env.API_URL ||
    `${req.protocol}://${req.get("host")}`;

  return `<script defer
  src="${base}/api/embed/widget.js"
  data-server="${base}"
  data-bot="${bot.publicId}"
  data-autopen="0"
  data-position="right"></script>`;
}

// GET /api/bots  -> lista bots del usuario logueado (o primer user en dev)
router.get("/", async (req, res, next) => {
  try {
    let ownerId = (req.user && req.user.id) || null;
    if (!ownerId) {
      const u = await prisma.user.findFirst();
      if (!u) return res.json({ bots: [] });
      ownerId = u.id;
    }

    const bots = await prisma.bot.findMany({
      where: { userId: ownerId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        publicId: true,
        model: true,
        isActive: true,
        allowedOrigins: true,
        createdAt: true,
      },
    });

    // añade snippet de una vez (con la URL actual del server)
    const withSnippets = bots.map((b) => ({
      ...b,
      embedSnippet: buildEmbedSnippet(b, req),
    }));

    res.json({ bots: withSnippets });
  } catch (e) {
    next(e);
  }
});

// GET /api/bots/:id/embed -> devuelve solo el snippet
router.get("/:id/embed", async (req, res, next) => {
  try {
    const { id } = req.params;
    const bot = await prisma.bot.findUnique({
      where: { id },
      select: { id: true, publicId: true, isActive: true },
    });
    if (!bot) return res.status(404).json({ error: "bot not found" });

    res.json({ embedSnippet: buildEmbedSnippet(bot, req) });
  } catch (e) {
    next(e);
  }
});

export default router;
