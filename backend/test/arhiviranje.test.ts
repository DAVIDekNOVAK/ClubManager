import { beforeEach, describe, expect, it } from 'vitest';
import { ustvariAplikacijo } from '../src/app.js';
import { prisma } from '../src/common/prisma.js';
import { zahtevajAktivnoEkipo } from '../src/modules/ekipe/routes.js';
import { E_ADMIN, E_TRENER, pocistiBazo, prijavljen, ustvariKlub } from './pomoc.js';

const app = ustvariAplikacijo();
const nazivi = (telo: { naziv: string }[]) => telo.map((e) => e.naziv);

describe('US-04 – arhiviranje ekipe', () => {
  let klub: Awaited<ReturnType<typeof ustvariKlub>>;
  beforeEach(async () => {
    await pocistiBazo();
    klub = await ustvariKlub(1);
  });

  it('AC 2: arhivirana ekipa ni na privzetem seznamu, vidna je s filtrom', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const odgovor = await admin.post(`/api/ekipe/${klub.ekipa.id}/arhiviraj`);
    expect(odgovor.status).toBe(200);
    expect(odgovor.body.jeArhivirana).toBe(true);

    expect(nazivi((await admin.get('/api/ekipe')).body)).toEqual(['U17']);
    expect(nazivi((await admin.get('/api/ekipe?arhivirane=true')).body)).toEqual(['Člani']);
  });

  it('AC 3: za arhivirano ekipo ni mogoče ustvarjati novih aktivnosti', async () => {
    await expect(zahtevajAktivnoEkipo(klub.ekipa.id)).resolves.toMatchObject({ naziv: 'Člani' });
    await prisma.ekipa.update({ where: { id: klub.ekipa.id }, data: { jeArhivirana: true } });
    await expect(zahtevajAktivnoEkipo(klub.ekipa.id)).rejects.toMatchObject({ status: 409 });
  });

  it('AC 4: arhiviranje ohrani članstva in zgodovino', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    const predClanstva = await prisma.clanstvoVEkipi.count({ where: { ekipaId: klub.ekipa.id } });
    await admin.post(`/api/ekipe/${klub.ekipa.id}/arhiviraj`);
    expect(await prisma.clanstvoVEkipi.count({ where: { ekipaId: klub.ekipa.id } })).toBe(predClanstva);
    const clani = await admin.get(`/api/ekipe/${klub.ekipa.id}/clanstva?sezonaId=${klub.sezona.id}`);
    expect(clani.body).toHaveLength(predClanstva);
  });

  it('AC 5: administrator lahko ekipo ponovno aktivira', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    await admin.post(`/api/ekipe/${klub.ekipa.id}/arhiviraj`);
    const odgovor = await admin.post(`/api/ekipe/${klub.ekipa.id}/aktiviraj`);
    expect(odgovor.body.jeArhivirana).toBe(false);
    expect(nazivi((await admin.get('/api/ekipe')).body)).toEqual(['Člani', 'U17']);
  });

  it('ponovna aktivacija ni mogoča, če medtem obstaja aktivna ekipa z enakim nazivom', async () => {
    const admin = await prijavljen(app, E_ADMIN);
    await admin.post(`/api/ekipe/${klub.ekipa.id}/arhiviraj`);
    await admin.post('/api/ekipe').send({ naziv: 'Člani', kategorija: 'CLANI' });
    expect((await admin.post(`/api/ekipe/${klub.ekipa.id}/aktiviraj`)).status).toBe(409);
  });

  it('arhivira in aktivira lahko samo administrator', async () => {
    const trener = await prijavljen(app, E_TRENER);
    expect((await trener.post(`/api/ekipe/${klub.ekipa.id}/arhiviraj`)).status).toBe(403);
    expect((await trener.post(`/api/ekipe/${klub.ekipa.id}/aktiviraj`)).status).toBe(403);
  });
});
