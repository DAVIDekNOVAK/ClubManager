import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { poslanaPosta } from '../src/common/posta.js';
import { prisma } from '../src/common/prisma.js';
import { E_ADMIN, odjemalec, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const NOV = 'nov.clan@example.com';
const NEVELJAVNO = 'Povabilo ni več veljavno – obrnite se na administratorja kluba';
const veljavno = { ime: 'Nik', priimek: 'Novinec', geslo: 'Skrivnost1', gesloPonovno: 'Skrivnost1' };

describe('US-19 – sprejem povabila', () => {
  let zeton: string;
  beforeEach(async () => {
    await pocistiBazo();
    poslanaPosta.length = 0;
    const klub = await ustvariKlub(0);
    const admin = await prijavljen(app, E_ADMIN);
    await admin.post('/api/povabila').send({ ePosta: NOV, ekipaId: klub.ekipa.id, sezonaId: klub.sezona.id, vloga: 'VODJA_EKIPE' });
    zeton = poslanaPosta[0].besedilo.match(/\/povabilo\/([\w-]+)/)![1];
  });

  it('AC 1: obrazec dobi e-poštni naslov iz povabila; naslova pri registraciji ni mogoče spremeniti', async () => {
    const o = odjemalec(app);
    const podatki = await o.get(`/api/povabila/zeton/${zeton}`);
    expect(podatki.status).toBe(200);
    expect(podatki.body).toEqual({ ePosta: NOV, vloga: 'VODJA_EKIPE', ekipa: 'Člani', sezona: 'Aktivna' });

    const odgovor = await o.post(`/api/povabila/zeton/${zeton}/sprejmi`).send({ ...veljavno, ePosta: 'drug@example.com' });
    expect(odgovor.status).toBe(201);
    expect(odgovor.body.ePosta).toBe(NOV);
  });

  it('AC 2: geslo ima vsaj 8 znakov, črko in številko; gesli se morata ujemati', async () => {
    const o = odjemalec(app);
    const poslji = (geslo: string, gesloPonovno = geslo) =>
      o.post(`/api/povabila/zeton/${zeton}/sprejmi`).send({ ...veljavno, geslo, gesloPonovno });

    expect((await poslji('Kratko1')).body.polja.geslo).toBe('Geslo mora imeti vsaj 8 znakov');
    expect((await poslji('12345678')).body.polja.geslo).toBe('Geslo mora vsebovati vsaj eno črko');
    expect((await poslji('samocrke')).body.polja.geslo).toBe('Geslo mora vsebovati vsaj eno številko');
    expect((await poslji('Skrivnost1', 'Skrivnost2')).body.polja.gesloPonovno).toBe('Gesli se ne ujemata');
    const prazno = await o.post(`/api/povabila/zeton/${zeton}/sprejmi`).send({});
    expect(Object.keys(prazno.body.polja).sort()).toEqual(['geslo', 'gesloPonovno', 'ime', 'priimek']);
    expect(await prisma.uporabnik.count({ where: { ePosta: NOV } })).toBe(0);
  });

  it('AC 3: po registraciji je uporabnik prijavljen in član ekipe z vlogo iz povabila', async () => {
    const o = odjemalec(app);
    const odgovor = await o.post(`/api/povabila/zeton/${zeton}/sprejmi`).send(veljavno);
    expect(odgovor.status).toBe(201);
    expect(odgovor.body.ekipe).toEqual([expect.objectContaining({ naziv: 'Člani', vloge: ['VODJA_EKIPE'] })]);

    // Seja je ustvarjena – uporabnik je prijavljen brez dodatne prijave.
    const jaz = await o.get('/api/auth/jaz');
    expect(jaz.status).toBe(200);
    expect(jaz.body.ime).toBe('Nik');

    // Geslo je shranjeno zgoščeno in deluje pri običajni prijavi.
    const u = await prisma.uporabnik.findUniqueOrThrow({ where: { ePosta: NOV } });
    expect(u.gesloHash).toMatch(/^\$argon2id\$/);
    const prijava = await odjemalec(app).post('/api/auth/prijava').send({ ePosta: NOV, geslo: 'Skrivnost1' });
    expect(prijava.status).toBe(200);

    const admin = await prijavljen(app, E_ADMIN);
    expect((await admin.get('/api/povabila')).body[0].status).toBe('SPREJETO');
  });

  it('AC 4: uporabljena, potekla ali neznana povezava ni veljavna', async () => {
    const o = odjemalec(app);
    expect((await o.get('/api/povabila/zeton/neznan-zeton')).status).toBe(410);

    await o.post(`/api/povabila/zeton/${zeton}/sprejmi`).send(veljavno);
    const uporabljeno = await odjemalec(app).get(`/api/povabila/zeton/${zeton}`);
    expect(uporabljeno.status).toBe(410);
    expect(uporabljeno.body.napaka).toBe(NEVELJAVNO);
    const ponovno = await odjemalec(app).post(`/api/povabila/zeton/${zeton}/sprejmi`).send(veljavno);
    expect(ponovno.status).toBe(410);
    expect(await prisma.uporabnik.count({ where: { ePosta: NOV } })).toBe(1);
  });

  it('AC 4: poteklo povabilo ni veljavno', async () => {
    await prisma.povabilo.updateMany({ data: { datumPoteka: new Date(Date.now() - 1000) } });
    const odgovor = await odjemalec(app).post(`/api/povabila/zeton/${zeton}/sprejmi`).send(veljavno);
    expect(odgovor.status).toBe(410);
    expect(odgovor.body.napaka).toBe(NEVELJAVNO);
  });
});
