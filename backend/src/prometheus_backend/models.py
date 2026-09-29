import uuid
from datetime import date, datetime, time

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
        # Confirmed with Natalia/data team: the frontend offers a "Divers"
        # anrede option, so 'divers' is allowed here rather than mapped to
        # 'keine_angabe'. data/prometheus-schema.sql has not been updated to
        # match yet as of this commit.
        sa.CheckConstraint(
            "anrede IN ('frau', 'herr', 'divers', 'keine_angabe')", name="ck_mitglieder_anrede"
        ),
        sa.CheckConstraint(
            "geschlecht IN ('weiblich', 'maennlich', 'divers', 'keine_angabe')",
            name="ck_mitglieder_geschlecht",
        ),
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


class Anwesenheitseintraege(Base):
    __tablename__ = "anwesenheitseintraege"

    anwesenheit_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    # The source SQL declares fk_anwesenheitseintraege_mitglied twice (unfixed
    # bug pending correction from the data team); defined once, correctly, here.
    mitglied_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("mitglieder.mitglied_id", ondelete="RESTRICT", onupdate="NO ACTION"),
        index=True,
    )
    anwesenheitsdatum: Mapped[date] = mapped_column(sa.Date)
    ankunftszeit: Mapped[time] = mapped_column(sa.Time)
    abgangszeit: Mapped[time | None] = mapped_column(sa.Time)


class Notfallkontakte(Base):
    __tablename__ = "notfallkontakte"
    __table_args__ = (
        sa.CheckConstraint(
            "beziehung IN ("
            "'mutter', 'vater', 'schwester', 'bruder', "
            "'ehefrau', 'ehemann', 'sohn', 'tochter', 'sonstige'"
            ")",
            name="ck_notfallkontakte_beziehung",
        ),
    )

    notfallkontakt_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    mitglied_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("mitglieder.mitglied_id", ondelete="CASCADE", onupdate="NO ACTION"),
        index=True,
    )
    name: Mapped[str] = mapped_column(sa.Text)
    telefon: Mapped[str] = mapped_column(sa.Text)
    beziehung: Mapped[str | None] = mapped_column(sa.Text)
    erstellt_am: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )


class Telefonate(Base):
    __tablename__ = "telefonate"
    __table_args__ = (
        sa.CheckConstraint(
            "anrufer_typ IN ('mitglied', 'mitarbeitende_person')", name="ck_telefonate_anrufer_typ"
        ),
        sa.CheckConstraint("dauer_minuten > 0", name="ck_telefonate_dauer_minuten"),
        sa.CheckConstraint("anliegen_code IN (1, 2, 3, 4, 5)", name="ck_telefonate_anliegen_code"),
    )

    telefonat_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")
    )
    mitglied_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("mitglieder.mitglied_id", ondelete="RESTRICT", onupdate="NO ACTION"),
        index=True,
    )
    telefonat_datum: Mapped[date] = mapped_column(sa.Date)
    anrufer_typ: Mapped[str] = mapped_column(sa.Text)
    dauer_minuten: Mapped[int] = mapped_column(sa.Integer)
    anliegen_code: Mapped[int] = mapped_column(sa.Integer)
    notiz: Mapped[str | None] = mapped_column(sa.Text)
    erstellt_am: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), server_default=sa.func.now()
    )
