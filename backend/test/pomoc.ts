import { prisma } from '../src/common/prisma.js';

/** Izprazni vse tabele testne baze in ponastavi števce id. */
export async function pocistiBazo() {
  const tabele = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tabele.length === 0) return;
  const seznam = tabele.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${seznam} RESTART IDENTITY CASCADE`);
}
