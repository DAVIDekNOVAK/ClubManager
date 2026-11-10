import { Router } from 'express';
import { dan } from '../../common/datumi.js';
import { asinh, idIzPoti } from '../../common/http.js';
import { zahtevajVlogoAliAdmina } from '../../common/pravice.js';
import { razpolozljivostEkipe } from '../razpolozljivost/skupno.js';
import { naloziTekmo } from './skupno.js';

/** Pregled razpoložljivosti igralcev pred tekmo (US-17). */
export const razpolozljivostTekmeRouter = Router();

razpolozljivostTekmeRouter.get(
  '/:id/razpolozljivost',
  asinh(async (req, res) => {
    const tekma = await naloziTekmo(req, idIzPoti(req));
    await zahtevajVlogoAliAdmina(req, tekma.ekipaId, 'TRENER');
    // Status se izračuna za dan tekme in ne za današnji dan (US-17, AC 2).
    res.json(await razpolozljivostEkipe(tekma.ekipaId, tekma.sezonaId, dan(tekma.datumInUra)));
  }),
);
