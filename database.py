from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# URL для подключения к SQLite. Файл будет создан в корне проекта.
SQLALCHEMY_DATABASE_URL = "sqlite:///./media/sql_app.db"

# Создаем движок (engine) SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    # check_same_thread нужен только для SQLite, т.к. он позволяет только 
    # одному потоку взаимодействовать с БД. Для других БД это не нужно.
    connect_args={"check_same_thread": False}
)

# Создаем класс SessionLocal, который будет использоваться для создания сессий
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для моделей ORM
Base = declarative_base()

# Вспомогательная функция для получения сессии БД (FastAPI Dependency)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()