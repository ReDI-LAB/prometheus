import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


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
