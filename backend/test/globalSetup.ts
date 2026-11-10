import { execSync } from 'node:child_process';

/** Pred testi pripravi testno bazo: ustvari jo (če je ni) in izvede vse migracije. */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    'postgresql://clubmanager:clubmanager@localhost:5433/clubmanager_test?schema=public';
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
