2. Evidenca zaračunanih postavk

Nov stolpec ID_RACUN_IZDANI (INTEGER) na MM_NAROCILO_STORITEV: DDL v bazi in posodobljen dbmap. Brez dbmap DataBase::save() vrednost tiho izpusti.
Ko je račun izdan, se njegov id vpiše na postavke, ki so na njem.

3. Razdelitev postavk po potovanjih

Nova funkcija, npr. Passengers::orderInvoiceGroups($orderId).
Vsako potovanje (vrstica brez parentVariation) je svoja skupina. Prijavnina in doplačila gredo k svojemu potovanju po parentArticleId in parentVariation.
Vrne samo postavke, ki še niso na računu (ID_RACUN_IZDANI je prazen).

4. Webhook (OrderWebhook::issueInvoice())

Za vsako skupino pokliči createFiscalInvoiceFromOrder($orderId, null, $ids) in na postavke vpiši id računa.
Nato fiscalize() za vsak račun naročila brez EOR.
orderInvoiceId() zamenjaj s funkcijo, ki vrne vse račune naročila.

5. Preverjanje

Naročilo z dvema potovanjema da dva računa z zaporednima številkama, na vsakem eno potovanje s prijavnino.
Plačilo na vsakem računu je enako znesku računa.
Oba računa imata EOR.
Ponovni klic webhooka ne naredi novih računov.
Mail ali profil kupca pokaže vse račune.