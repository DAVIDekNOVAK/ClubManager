import argon2 from 'argon2';

/** Gesla se shranjujejo kot zgoščene vrednosti Argon2id (ADR-0005). */
export const zgostiGeslo = (geslo: string) => argon2.hash(geslo, { type: argon2.argon2id });

export async function preveriGeslo(hash: string, geslo: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, geslo);
  } catch {
    return false;
  }
}
