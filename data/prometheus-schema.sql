CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.mitglieder (
	mitglied_id uuid NOT NULL DEFAULT gen_random_uuid(),
	mitgliedscode text NOT NULL,
	vorname text NOT NULL,
	nachname text NOT NULL,
	geburtsdatum date NOT NULL,
	eintrittsdatum date NOT NULL,
	mitgliedsstatus text NOT NULL DEFAULT 'mo',
	anrede text,
	geschlecht text,
	telefon text,
	email text,
	strasse_hausnummer text,
	postleitzahl text,
	ort text,
	aktivitaetsstatus text,
	erstellt_am timestamptz NOT NULL DEFAULT now(),
	geandert_am timestamptz NOT NULL DEFAULT now(),
	
	CONSTRAINT pk_mitglieder
		PRIMARY KEY (mitglied_id),
	
	CONSTRAINT uq_mitglieder_mitgliedscode
		UNIQUE (mitgliedscode),
	
	CONSTRAINT ck_mitglieder_mitgliedsstatus
		CHECK (mitgliedsstatus IN ('mo', 'm')),
	
	CONSTRAINT ck_mitglieder_anrede
		CHECK (anrede IN ('frau', 'herr', 'keine_angabe')),
		
	CONSTRAINT ck_mitglieder_geschlecht
		CHECK (geschlecht IN ('weiblich', 'maennlich', 'divers', 'keine_angabe')),
	
	CONSTRAINT ck_mitglieder_aktivitaetsstatus
		CHECK (aktivitaetsstatus IN ('aktiv', 'inaktiv'))
);


CREATE TABLE public.anwesenheitseintraege (
	anwesenheit_id uuid NOT NULL DEFAULT gen_random_uuid(),
	mitglied_id uuid NOT NULL,
	anwesenheitsdatum date NOT NULL,
	ankunftszeit time NOT NULL,
	abgangszeit time,
	
	CONSTRAINT pk_anwesenheitseintraege
		PRIMARY KEY (anwesenheit_id),
	
	CONSTRAINT fk_anwesenheitseintraege_mitglied
		FOREIGN KEY (mitglied_id)
		REFERENCES public.mitglieder (mitglied_id)
	
	CONSTRAINT fk_anwesenheitseintraege_mitglied
		FOREIGN KEY (mitglied_id)
		REFERENCES public.mitglieder (mitglied_id)
		ON UPDATE NO ACTION
		ON DELETE RESTRICT
);

CREATE INDEX ix_anwesenheitseintraege_mitglied_id
ON public.anwesenheitseintraege (mitglied_id);

CREATE TABLE public.notfallkontakte (
    notfallkontakt_id uuid NOT NULL DEFAULT gen_random_uuid(),
    mitglied_id uuid NOT NULL,
    name text NOT NULL,
    telefon text NOT NULL,
    beziehung text,
    erstellt_am timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_notfallkontakte
        PRIMARY KEY (notfallkontakt_id),

    CONSTRAINT fk_notfallkontakte_mitglied
        FOREIGN KEY (mitglied_id)
        REFERENCES public.mitglieder (mitglied_id)
        ON UPDATE NO ACTION
        ON DELETE CASCADE,
    
    CONSTRAINT ck_notfallkontakte_beziehung
    CHECK (
        beziehung IN (
            'mutter',
            'vater',
            'schwester',
            'bruder',
            'ehefrau',
            'ehemann',
            'sohn',
            'tochter',
            'sonstige'
        )
    )    
);

CREATE INDEX ix_notfallkontakte_mitglied_id
ON public.notfallkontakte (mitglied_id);

CREATE TABLE public.telefonate (
    telefonat_id uuid NOT NULL DEFAULT gen_random_uuid(),
    mitglied_id uuid NOT NULL,
    telefonat_datum date NOT NULL,
    anrufer_typ text NOT NULL,
    dauer_minuten integer NOT NULL,
    anliegen_code integer NOT NULL,
    notiz text,
    erstellt_am timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_telefonate
    		PRIMARY KEY (telefonat_id),

	CONSTRAINT fk_telefonate_mitglied
    		FOREIGN KEY (mitglied_id)
    		REFERENCES public.mitglieder (mitglied_id)
    		ON UPDATE NO ACTION
    		ON DELETE RESTRICT,

	CONSTRAINT ck_telefonate_anrufer_typ
    		CHECK (anrufer_typ IN ('mitglied', 'mitarbeitende_person')),

	CONSTRAINT ck_telefonate_dauer_minuten
    		CHECK (dauer_minuten > 0),

	CONSTRAINT ck_telefonate_anliegen_code
    		CHECK (anliegen_code IN (1, 2, 3, 4, 5))
);

CREATE INDEX ix_telefonate_mitglied_id
ON public.telefonate (mitglied_id);

CREATE TABLE public.mitarbeitende (
    mitarbeitende_id uuid NOT NULL DEFAULT gen_random_uuid(),
    vorname text NOT NULL,
    nachname text NOT NULL,
    rolle text NOT NULL,
    email text,
    aktiv boolean NOT NULL DEFAULT true,
    erstellt_am timestamptz NOT NULL DEFAULT now(),
    geaendert_am timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_mitarbeitende
        PRIMARY KEY (mitarbeitende_id),

    CONSTRAINT uq_mitarbeitende_email
        UNIQUE (email)
);
