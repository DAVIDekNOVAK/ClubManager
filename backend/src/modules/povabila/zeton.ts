import { createHash, randomBytes } from 'node:crypto';

export const VELJAVNOST_DNI = 7;

/** Enkraten naključni žeton za povezavo v povabilu. */
export const novZeton = () => randomBytes(32).toString('base64url');

/** V bazi je shranjena samo zgoščena vrednost žetona, zato ga iz baze ni mogoče prebrati. */
export const zgostiZeton = (zeton: string) => createHash('sha256').update(zeton).digest('hex');
