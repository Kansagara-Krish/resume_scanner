import os
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text
from dotenv import load_dotenv
import psycopg2
from urllib.parse import urlparse

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/hr_copilot")

engine = create_engine(DATABASE_URL, echo=True)

def create_database_if_not_exists():
    url = urlparse(DATABASE_URL)
    db_name = url.path.lstrip('/')
    conn = psycopg2.connect(
        host=url.hostname,
        port=url.port or 5432,
        user=url.username,
        password=url.password,
        database='postgres'
    )
    conn.autocommit = True
    cur = conn.cursor()
    try:
        cur.execute(f"CREATE DATABASE {db_name}")
    except psycopg2.errors.DuplicateDatabase:
        pass
    finally:
        cur.close()
        conn.close()

def init_db():
    create_database_if_not_exists()
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
