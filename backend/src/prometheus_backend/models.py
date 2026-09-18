import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Mitglieder(Base):
    __tablename__ = "mitglieder"
    __table_args__ = (
        # The ERD only shows `text NOT NULL` for mitgliedsstatus, with no visible
        # CHECK constraint or enum type at the DB level. Modeled here as a CHECK
        # constraint; confirm against the actual DB constraint once migrations
        # are available.
        sa.CheckConstraint("mitgliedsstatus IN ('mo', 'm')", name="ck_mitglieder_mitgliedsstatus"),
    )

    mitglied_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    mitgliedscode: Mapped[str] = mapped_column(sa.Text, unique=True)
    vorname: Mapped[str] = mapped_column(sa.Text)
    nachname: Mapped[str] = mapped_column(sa.Text)
    geburtsdatum: Mapped[date] = mapped_column(sa.Date)
    eintrittsdatum: Mapped[date] = mapped_column(sa.Date)
    mitgliedsstatus: Mapped[str] = mapped_column(sa.Text, server_default="mo")
    anrede: Mapped[str | None] = mapped_column(sa.Text)
    geschlecht: Mapped[str | None] = mapped_column(sa.Text)
    telefon: Mapped[str | None] = mapped_column(sa.Text)
    email: Mapped[str | None] = mapped_column(sa.Text)
    strasse_hausnummer: Mapped[str | None] = mapped_column(sa.Text)
    postleitzahl: Mapped[str | None] = mapped_column(sa.Text)
    ort: Mapped[str | None] = mapped_column(sa.Text)
    # Nullable with no default: the eventual default value is not yet
    # confirmed with the client.
    aktivitaetsstatus: Mapped[str | None] = mapped_column(sa.Text)
    erstellt_am: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
    # Spelling confirmed from the ERD (not `geaendert_am`). No update trigger
    # exists yet, so this does not auto-update on row changes.
    geandert_am: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
