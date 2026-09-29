import uuid
from datetime import date, datetime

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
