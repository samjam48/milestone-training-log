from collections.abc import Generator

from sqlmodel import Session, create_engine

from app.settings import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
