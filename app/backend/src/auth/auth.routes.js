import { Router } from "express";
import { prisma } from "../db/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();

// helper para setear la cookie de sesión
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, process.env.SECRET_KEY, { expiresIn: "7d" });
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",   // "none" si front/back están en dominios distintos
    secure: isProd,                      // en prod con HTTPS debe ser true
    maxAge: 7 * 24 * 3600 * 1000,        // 7 días
  });
}

// REGISTER
router.post("/register", async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email/password required" });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "Email already used" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, passwordHash, name } });

    setAuthCookie(res, { id: user.id, email: user.email, role: user.role });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) { next(e); }
});

// LOGIN
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "email/password required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    setAuthCookie(res, { id: user.id, email: user.email, role: user.role });
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch (e) { next(e); }
});

// LOGOUT
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.json({ ok: true });
});

export default router;
