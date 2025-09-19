import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // 1) Usuario (where por email: sí es único)
  const user = await prisma.user.upsert({
    where: { email: "alirio@test.com" },
    update: {},
    create: {
      email: "alirio@test.com",
      passwordHash: "dev-only", // TODO: usa hash real en prod
      name: "Alirio López",
      role: "user",
    },
  });

  // 2) Plan (NO usamos where por name, porque no es unique)
  //    Creamos un ID fijo para este plan (permitido aunque tengas @default(cuid()))
  const PLAN_ID = "plan_basic"; // string estable
  let plan = await prisma.plan.findUnique({ where: { id: PLAN_ID } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        id: PLAN_ID,
        name: "basic",
        priceCents: 1900,
        botsIncluded: 1,
      },
    });
  }

  // 3) Suscripción activa (buscar por userId+planId y actualizar/crear)
  const subFound = await prisma.subscription.findFirst({
    where: { userId: user.id, planId: plan.id },
  });
  if (subFound) {
    await prisma.subscription.update({
      where: { id: subFound.id },
      data: { status: "active" },
    });
  } else {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: "active",
      },
    });
  }

  // 4) Bot de prueba (si no existe uno del user, crea uno)
  const existingBot = await prisma.bot.findFirst({
    where: { userId: user.id },
  });

  const bot =
    existingBot ||
    (await prisma.bot.create({
      data: {
        userId: user.id,
        name: "Bot de Alirio",
        prompt: "Eres un bot amable y conciso.",
        model: "gpt-4o-mini",
        maxTokens: 800,
        allowedOrigins: [], // learn_once lo llenará
        isActive: true,
      },
    }));

  console.log("\n✅ Seed OK");
  console.log("Usuario:", user.email);
  console.log("Plan:", plan.name, "(id:", plan.id + ")");
  console.log("Bot publicId:", bot.publicId, "\n");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
