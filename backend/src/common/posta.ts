import nodemailer from 'nodemailer';
import { config, jeTest } from '../config.js';

export interface Sporocilo {
  za: string;
  zadeva: string;
  besedilo: string;
  html?: string;
}

/** V testih se e-pošta ne pošilja, ampak zbira v tem seznamu. */
export const poslanaPosta: Sporocilo[] = [];

const prenos = jeTest
  ? null
  : nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: false,
      connectionTimeout: 5000,
    });

export async function posljiPosto(sporocilo: Sporocilo): Promise<void> {
  if (!prenos) {
    poslanaPosta.push(sporocilo);
    return;
  }
  await prenos.sendMail({
    from: config.MAIL_FROM,
    to: sporocilo.za,
    subject: sporocilo.zadeva,
    text: sporocilo.besedilo,
    html: sporocilo.html,
  });
}
