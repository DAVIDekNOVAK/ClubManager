import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';

describe('ogrodje API', () => {
  const app = ustvariAplikacijo();

  it('GET /api/health vrne stanje ok', async () => {
    const odgovor = await request(app).get('/api/health');
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.status).toBe('ok');
  });

  it('neznana pot vrne 404 v obliki JSON', async () => {
    const odgovor = await request(app).get('/api/ne-obstaja');
    expect(odgovor.status).toBe(404);
    expect(odgovor.body.napaka).toContain('ne obstaja');
  });

  it('neveljaven JSON vrne 400', async () => {
    const odgovor = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{neveljavno');
    expect(odgovor.status).toBe(400);
  });
});
