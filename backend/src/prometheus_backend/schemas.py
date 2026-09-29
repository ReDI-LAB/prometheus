import uuid
from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict


class MitgliedCreate(BaseModel):
    mitgliedscode: str
    vorname: str
    nachname: str
    geburtsdatum: date
    eintrittsdatum: date
    mitgliedsstatus: Literal["mo", "m"] = "mo"
    anrede: Literal["frau", "herr", "divers", "keine_angabe"] | None = None
    geschlecht: Literal["weiblich", "maennlich", "divers", "keine_angabe"] | None = None
    telefon: str | None = None
    email: str | None = None
    strasse_hausnummer: str | None = None
    postleitzahl: str | None = None
    ort: str | None = None
    # No DB CHECK constraint exists yet for aktivitaetsstatus (default value
    # still unconfirmed with the client), so it is accepted as plain text.
    aktivitaetsstatus: str | None = None


class MitgliedRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mitglied_id: uuid.UUID
    mitgliedscode: str
    vorname: str
    nachname: str
    geburtsdatum: date
    eintrittsdatum: date
    mitgliedsstatus: str
    anrede: str | None
    geschlecht: str | None
    telefon: str | None
    email: str | None
    strasse_hausnummer: str | None
    postleitzahl: str | None
    ort: str | None
    aktivitaetsstatus: str | None
    erstellt_am: datetime
    geandert_am: datetime


class MitgliederPage(BaseModel):
    items: list[MitgliedRead]
    total: int
    limit: int
    offset: int


class AnwesenheitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    anwesenheit_id: uuid.UUID
    mitglied_id: uuid.UUID
    anwesenheitsdatum: date
    ankunftszeit: time
    abgangszeit: time | None


class AnwesenheitPage(BaseModel):
    items: list[AnwesenheitRead]
    total: int
    limit: int
    offset: int


class NotfallkontaktRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    notfallkontakt_id: uuid.UUID
    mitglied_id: uuid.UUID
    name: str
    telefon: str
    beziehung: str | None
    erstellt_am: datetime


class TelefonatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    telefonat_id: uuid.UUID
    mitglied_id: uuid.UUID
    telefonat_datum: date
    anrufer_typ: str
    dauer_minuten: int
    anliegen_code: int
    notiz: str | None
    erstellt_am: datetime


class TelefonatPage(BaseModel):
    items: list[TelefonatRead]
    total: int
    limit: int
    offset: int
