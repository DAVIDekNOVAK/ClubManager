import { PrismaClient } from '@prisma/client';

/** En sam odjemalec Prisma za celotno aplikacijo (skupni bazen povezav). */
export const prisma = new PrismaClient();
