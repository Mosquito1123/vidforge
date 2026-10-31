import { PrismaClient, ModelType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
      creditAccount: { create: { balance: 1000 } },
    },
  });

  await prisma.creditAccount.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, balance: 1000 },
  });

  // Bootstrap admin account for the /admin console.
  const adminPasswordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD || 'admin12345',
    10,
  );
  const admin = await prisma.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL || 'admin@vidforge.local' },
    update: { role: 'admin', adminRole: 'admin', isAdmin: true },
    create: {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@vidforge.local',
      passwordHash: adminPasswordHash,
      name: 'Platform Admin',
      role: 'admin',
      adminRole: 'admin',
      isAdmin: true,
      creditAccount: { create: { balance: 100000 } },
    },
  });

  await prisma.creditAccount.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, balance: 100000 },
  });

  const models = [
    {
      slug: 'mock-video-v1',
      name: 'Mock Video v1',
      provider: 'mock',
      type: ModelType.VIDEO,
      creditsCost: 10,
      active: true,
    },
    {
      slug: 'mock-image-v1',
      name: 'Mock Image v1',
      provider: 'mock',
      type: ModelType.IMAGE,
      creditsCost: 2,
      active: true,
    },
  ];

  for (const model of models) {
    await prisma.model.upsert({
      where: { slug: model.slug },
      update: { name: model.name, provider: model.provider, type: model.type, creditsCost: model.creditsCost, active: model.active },
      create: model,
    });
  }

  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      description: 'For individuals getting started',
      priceCents: 900,
      credits: 100,
      features: ['100 credits/mo', '720p output', 'Watermark-free', 'Email support'],
    },
    {
      slug: 'pro',
      name: 'Pro',
      description: 'For creators',
      priceCents: 2900,
      credits: 500,
      features: ['500 credits/mo', '1080p output', 'Priority queue', 'Commercial use'],
    },
    {
      slug: 'studio',
      name: 'Studio',
      description: 'For teams',
      priceCents: 9900,
      credits: 2500,
      features: ['2500 credits/mo', '4K output', 'Dedicated support', 'API access'],
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { name: plan.name, priceCents: plan.priceCents, credits: plan.credits, features: plan.features as any },
      create: { slug: plan.slug, name: plan.name, description: plan.description, priceCents: plan.priceCents, credits: plan.credits, features: plan.features as any },
    });
  }

  const packages = [
    { slug: 'credits-100', name: '100 Credits', credits: 100, priceCents: 1000 },
    { slug: 'credits-500', name: '500 Credits', credits: 500, priceCents: 4500 },
    { slug: 'credits-2500', name: '2500 Credits', credits: 2500, priceCents: 20000 },
  ];
  for (const pkg of packages) {
    await prisma.creditPackage.upsert({
      where: { slug: pkg.slug },
      update: { name: pkg.name, credits: pkg.credits, priceCents: pkg.priceCents },
      create: pkg,
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
