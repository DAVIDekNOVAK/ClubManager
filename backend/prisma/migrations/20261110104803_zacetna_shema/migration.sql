-- CreateEnum
CREATE TYPE "Kategorija" AS ENUM ('CLANI', 'U19', 'U17', 'U15', 'U13', 'DRUGO');

-- CreateEnum
CREATE TYPE "Vloga" AS ENUM ('IGRALEC', 'TRENER', 'VODJA_EKIPE');

-- CreateEnum
CREATE TYPE "StatusTreninga" AS ENUM ('NACRTOVAN', 'ODPOVEDAN', 'IZVEDEN');

-- CreateEnum
CREATE TYPE "PrijavljenaPrisotnost" AS ENUM ('NI_ODGOVORA', 'PRIDE', 'NE_PRIDE');

-- CreateEnum
CREATE TYPE "RazlogOdsotnosti" AS ENUM ('BOLEZEN', 'POSKODBA', 'SOLA_SLUZBA', 'DRUGO');

-- CreateEnum
CREATE TYPE "DejanskaPrisotnost" AS ENUM ('PRISOTEN', 'OPRAVICENO_ODSOTEN', 'NEOPRAVICENO_ODSOTEN');

-- CreateEnum
CREATE TYPE "StatusTekme" AS ENUM ('NACRTOVANA', 'ODPOVEDANA', 'ODIGRANA', 'ZAKLJUCENA');

-- CreateEnum
CREATE TYPE "VrstaTekmovanja" AS ENUM ('PRVENSTVO', 'POKAL', 'PRIJATELJSKA');

-- CreateEnum
CREATE TYPE "VrstaDogodka" AS ENUM ('GOL', 'ASISTENCA', 'RUMENI_KARTON', 'RDECI_KARTON', 'MENJAVA');

-- CreateEnum
CREATE TYPE "StatusRazpolozljivosti" AS ENUM ('NA_VOLJO', 'ODSOTEN', 'POSKODOVAN', 'OMEJENO_TRENIRANJE');

-- CreateTable
CREATE TABLE "Uporabnik" (
    "id" SERIAL NOT NULL,
    "ime" TEXT NOT NULL,
    "priimek" TEXT NOT NULL,
    "ePosta" TEXT NOT NULL,
    "gesloHash" TEXT NOT NULL,
    "jeAdministrator" BOOLEAN NOT NULL DEFAULT false,
    "ustvarjen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "neuspesniPoskusi" INTEGER NOT NULL DEFAULT 0,
    "prviNeuspesenPoskus" TIMESTAMP(3),
    "zaklenjenDo" TIMESTAMP(3),

    CONSTRAINT "Uporabnik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ekipa" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "kategorija" "Kategorija" NOT NULL,
    "jeArhivirana" BOOLEAN NOT NULL DEFAULT false,
    "ustvarjena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ekipa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sezona" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "datumZacetka" DATE NOT NULL,
    "datumKonca" DATE NOT NULL,

    CONSTRAINT "Sezona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClanstvoVEkipi" (
    "id" SERIAL NOT NULL,
    "uporabnikId" INTEGER NOT NULL,
    "ekipaId" INTEGER NOT NULL,
    "sezonaId" INTEGER NOT NULL,
    "datumPridruzitve" DATE NOT NULL,
    "datumOdhoda" DATE,

    CONSTRAINT "ClanstvoVEkipi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VlogaClana" (
    "id" SERIAL NOT NULL,
    "clanstvoId" INTEGER NOT NULL,
    "vloga" "Vloga" NOT NULL,

    CONSTRAINT "VlogaClana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trening" (
    "id" SERIAL NOT NULL,
    "ekipaId" INTEGER NOT NULL,
    "sezonaId" INTEGER NOT NULL,
    "zacetek" TIMESTAMP(3) NOT NULL,
    "konec" TIMESTAMP(3) NOT NULL,
    "lokacija" TEXT NOT NULL,
    "vsebina" TEXT,
    "status" "StatusTreninga" NOT NULL DEFAULT 'NACRTOVAN',
    "spremenjenOb" TIMESTAMP(3),
    "ustvarilId" INTEGER,
    "ustvarjen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prisotnost" (
    "id" SERIAL NOT NULL,
    "treningId" INTEGER NOT NULL,
    "igralecId" INTEGER NOT NULL,
    "prijavljenaPrisotnost" "PrijavljenaPrisotnost" NOT NULL DEFAULT 'NI_ODGOVORA',
    "razlogOdsotnosti" "RazlogOdsotnosti",
    "komentar" TEXT,
    "dejanskaPrisotnost" "DejanskaPrisotnost",

    CONSTRAINT "Prisotnost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZgodovinaPrisotnosti" (
    "id" SERIAL NOT NULL,
    "prisotnostId" INTEGER NOT NULL,
    "spremenilId" INTEGER NOT NULL,
    "staraVrednost" "DejanskaPrisotnost" NOT NULL,
    "novaVrednost" "DejanskaPrisotnost" NOT NULL,
    "datumSpremembe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZgodovinaPrisotnosti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NasprotniKlub" (
    "id" SERIAL NOT NULL,
    "naziv" TEXT NOT NULL,
    "kraj" TEXT NOT NULL,

    CONSTRAINT "NasprotniKlub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tekma" (
    "id" SERIAL NOT NULL,
    "ekipaId" INTEGER NOT NULL,
    "sezonaId" INTEGER NOT NULL,
    "nasprotniKlubId" INTEGER NOT NULL,
    "datumInUra" TIMESTAMP(3) NOT NULL,
    "jeDomaca" BOOLEAN NOT NULL,
    "lokacija" TEXT NOT NULL,
    "vrstaTekmovanja" "VrstaTekmovanja" NOT NULL,
    "status" "StatusTekme" NOT NULL DEFAULT 'NACRTOVANA',
    "domaciGoli" INTEGER,
    "gostujociGoli" INTEGER,
    "ustvarjena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tekma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NastopNaTekmi" (
    "id" SERIAL NOT NULL,
    "tekmaId" INTEGER NOT NULL,
    "igralecId" INTEGER NOT NULL,
    "zacetnaPostava" BOOLEAN NOT NULL,
    "odigraneMinute" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NastopNaTekmi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DogodekNaTekmi" (
    "id" SERIAL NOT NULL,
    "tekmaId" INTEGER NOT NULL,
    "igralecId" INTEGER NOT NULL,
    "vrstaDogodka" "VrstaDogodka" NOT NULL,
    "minuta" INTEGER NOT NULL,
    "vstopilIgralecId" INTEGER,
    "golId" INTEGER,

    CONSTRAINT "DogodekNaTekmi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZgodovinaTekme" (
    "id" SERIAL NOT NULL,
    "tekmaId" INTEGER NOT NULL,
    "spremenilId" INTEGER NOT NULL,
    "vrstaSpremembe" TEXT NOT NULL,
    "razlog" TEXT NOT NULL,
    "stariPodatki" JSONB NOT NULL,
    "noviPodatki" JSONB NOT NULL,
    "datumSpremembe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZgodovinaTekme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RazpolozljivostIgralca" (
    "id" SERIAL NOT NULL,
    "igralecId" INTEGER NOT NULL,
    "status" "StatusRazpolozljivosti" NOT NULL,
    "veljaOd" DATE NOT NULL,
    "veljaDo" DATE,
    "ustvarjena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RazpolozljivostIgralca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Povabilo" (
    "id" SERIAL NOT NULL,
    "ePosta" TEXT NOT NULL,
    "zgoscenaVrednostZetona" TEXT NOT NULL,
    "ekipaId" INTEGER NOT NULL,
    "sezonaId" INTEGER NOT NULL,
    "vloga" "Vloga" NOT NULL,
    "poslanoOb" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datumPoteka" TIMESTAMP(3) NOT NULL,
    "datumSprejetja" TIMESTAMP(3),
    "ustvarilId" INTEGER NOT NULL,

    CONSTRAINT "Povabilo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seja" (
    "id" TEXT NOT NULL,
    "uporabnikId" INTEGER,
    "podatkiSeje" JSONB NOT NULL,
    "datumPoteka" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Uporabnik_ePosta_key" ON "Uporabnik"("ePosta");

-- CreateIndex
CREATE UNIQUE INDEX "Sezona_naziv_key" ON "Sezona"("naziv");

-- CreateIndex
CREATE INDEX "ClanstvoVEkipi_ekipaId_sezonaId_idx" ON "ClanstvoVEkipi"("ekipaId", "sezonaId");

-- CreateIndex
CREATE UNIQUE INDEX "ClanstvoVEkipi_uporabnikId_ekipaId_sezonaId_key" ON "ClanstvoVEkipi"("uporabnikId", "ekipaId", "sezonaId");

-- CreateIndex
CREATE UNIQUE INDEX "VlogaClana_clanstvoId_vloga_key" ON "VlogaClana"("clanstvoId", "vloga");

-- CreateIndex
CREATE INDEX "Trening_ekipaId_zacetek_idx" ON "Trening"("ekipaId", "zacetek");

-- CreateIndex
CREATE UNIQUE INDEX "Prisotnost_treningId_igralecId_key" ON "Prisotnost"("treningId", "igralecId");

-- CreateIndex
CREATE UNIQUE INDEX "NasprotniKlub_naziv_kraj_key" ON "NasprotniKlub"("naziv", "kraj");

-- CreateIndex
CREATE INDEX "Tekma_ekipaId_datumInUra_idx" ON "Tekma"("ekipaId", "datumInUra");

-- CreateIndex
CREATE UNIQUE INDEX "NastopNaTekmi_tekmaId_igralecId_key" ON "NastopNaTekmi"("tekmaId", "igralecId");

-- CreateIndex
CREATE INDEX "DogodekNaTekmi_tekmaId_minuta_idx" ON "DogodekNaTekmi"("tekmaId", "minuta");

-- CreateIndex
CREATE INDEX "RazpolozljivostIgralca_igralecId_veljaOd_idx" ON "RazpolozljivostIgralca"("igralecId", "veljaOd");

-- CreateIndex
CREATE UNIQUE INDEX "Povabilo_zgoscenaVrednostZetona_key" ON "Povabilo"("zgoscenaVrednostZetona");

-- CreateIndex
CREATE INDEX "Povabilo_ePosta_idx" ON "Povabilo"("ePosta");

-- CreateIndex
CREATE INDEX "Seja_datumPoteka_idx" ON "Seja"("datumPoteka");

-- AddForeignKey
ALTER TABLE "ClanstvoVEkipi" ADD CONSTRAINT "ClanstvoVEkipi_uporabnikId_fkey" FOREIGN KEY ("uporabnikId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanstvoVEkipi" ADD CONSTRAINT "ClanstvoVEkipi_ekipaId_fkey" FOREIGN KEY ("ekipaId") REFERENCES "Ekipa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClanstvoVEkipi" ADD CONSTRAINT "ClanstvoVEkipi_sezonaId_fkey" FOREIGN KEY ("sezonaId") REFERENCES "Sezona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VlogaClana" ADD CONSTRAINT "VlogaClana_clanstvoId_fkey" FOREIGN KEY ("clanstvoId") REFERENCES "ClanstvoVEkipi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trening" ADD CONSTRAINT "Trening_ekipaId_fkey" FOREIGN KEY ("ekipaId") REFERENCES "Ekipa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trening" ADD CONSTRAINT "Trening_sezonaId_fkey" FOREIGN KEY ("sezonaId") REFERENCES "Sezona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trening" ADD CONSTRAINT "Trening_ustvarilId_fkey" FOREIGN KEY ("ustvarilId") REFERENCES "Uporabnik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prisotnost" ADD CONSTRAINT "Prisotnost_treningId_fkey" FOREIGN KEY ("treningId") REFERENCES "Trening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prisotnost" ADD CONSTRAINT "Prisotnost_igralecId_fkey" FOREIGN KEY ("igralecId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZgodovinaPrisotnosti" ADD CONSTRAINT "ZgodovinaPrisotnosti_prisotnostId_fkey" FOREIGN KEY ("prisotnostId") REFERENCES "Prisotnost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZgodovinaPrisotnosti" ADD CONSTRAINT "ZgodovinaPrisotnosti_spremenilId_fkey" FOREIGN KEY ("spremenilId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tekma" ADD CONSTRAINT "Tekma_ekipaId_fkey" FOREIGN KEY ("ekipaId") REFERENCES "Ekipa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tekma" ADD CONSTRAINT "Tekma_sezonaId_fkey" FOREIGN KEY ("sezonaId") REFERENCES "Sezona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tekma" ADD CONSTRAINT "Tekma_nasprotniKlubId_fkey" FOREIGN KEY ("nasprotniKlubId") REFERENCES "NasprotniKlub"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NastopNaTekmi" ADD CONSTRAINT "NastopNaTekmi_tekmaId_fkey" FOREIGN KEY ("tekmaId") REFERENCES "Tekma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NastopNaTekmi" ADD CONSTRAINT "NastopNaTekmi_igralecId_fkey" FOREIGN KEY ("igralecId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogodekNaTekmi" ADD CONSTRAINT "DogodekNaTekmi_tekmaId_fkey" FOREIGN KEY ("tekmaId") REFERENCES "Tekma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogodekNaTekmi" ADD CONSTRAINT "DogodekNaTekmi_igralecId_fkey" FOREIGN KEY ("igralecId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogodekNaTekmi" ADD CONSTRAINT "DogodekNaTekmi_vstopilIgralecId_fkey" FOREIGN KEY ("vstopilIgralecId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DogodekNaTekmi" ADD CONSTRAINT "DogodekNaTekmi_golId_fkey" FOREIGN KEY ("golId") REFERENCES "DogodekNaTekmi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZgodovinaTekme" ADD CONSTRAINT "ZgodovinaTekme_tekmaId_fkey" FOREIGN KEY ("tekmaId") REFERENCES "Tekma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZgodovinaTekme" ADD CONSTRAINT "ZgodovinaTekme_spremenilId_fkey" FOREIGN KEY ("spremenilId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RazpolozljivostIgralca" ADD CONSTRAINT "RazpolozljivostIgralca_igralecId_fkey" FOREIGN KEY ("igralecId") REFERENCES "Uporabnik"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Povabilo" ADD CONSTRAINT "Povabilo_ekipaId_fkey" FOREIGN KEY ("ekipaId") REFERENCES "Ekipa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Povabilo" ADD CONSTRAINT "Povabilo_sezonaId_fkey" FOREIGN KEY ("sezonaId") REFERENCES "Sezona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Povabilo" ADD CONSTRAINT "Povabilo_ustvarilId_fkey" FOREIGN KEY ("ustvarilId") REFERENCES "Uporabnik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seja" ADD CONSTRAINT "Seja_uporabnikId_fkey" FOREIGN KEY ("uporabnikId") REFERENCES "Uporabnik"("id") ON DELETE CASCADE ON UPDATE CASCADE;
