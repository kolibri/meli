from __future__ import annotations

import sqlite3
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path


Migration = Callable[[sqlite3.Connection], None]


def _migrate_to_v1(connection: sqlite3.Connection) -> None:
    connection.execute("""
        CREATE TABLE library_directories (
            id INTEGER PRIMARY KEY,
            path TEXT NOT NULL UNIQUE
        )
    """)

    connection.execute("""
        CREATE TABLE videos (
            id INTEGER PRIMARY KEY,
            directory_id INTEGER NOT NULL,
            relative_path TEXT NOT NULL,

            FOREIGN KEY (directory_id)
                REFERENCES library_directories(id)
                ON DELETE CASCADE,

            UNIQUE (directory_id, relative_path)
        )
    """)


MIGRATIONS: list[Migration] = [
    _migrate_to_v1,
]

CURRENT_SCHEMA_VERSION = len(MIGRATIONS)


def migrate(connection: sqlite3.Connection) -> None:
    current_version = connection.execute(
        "PRAGMA user_version"
    ).fetchone()[0]

    if current_version > CURRENT_SCHEMA_VERSION:
        raise RuntimeError(
            "Library schema is newer than this version of meli supports: "
            f"{current_version} > {CURRENT_SCHEMA_VERSION}"
        )

    for target_version, migration in enumerate(MIGRATIONS, start=1):
        if target_version <= current_version:
            continue

        with connection:
            migration(connection)
            connection.execute(
                f"PRAGMA user_version = {target_version}"
            )


def create_database(path: Path) -> None:
    if path.exists():
        raise FileExistsError(f"Library already exists: {path}")

    path.parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(path)

    try:
        connection.execute("PRAGMA foreign_keys = ON")
        migrate(connection)
    finally:
        connection.close()


@contextmanager
def open_database(path: Path) -> Iterator[sqlite3.Connection]:
    if not path.is_file():
        raise FileNotFoundError(f"Library does not exist: {path}")

    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")

    try:
        migrate(connection)
        yield connection
    finally:
        connection.close()
