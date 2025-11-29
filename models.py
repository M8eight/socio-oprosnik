from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class VNStage(Base):
    __tablename__ = "vn_stages"

    id = Column(Integer, primary_key=True, index=True)
    # stage_num — уникальный номер этапа (например, 1, 2, 3)
    stage_num = Column(Integer, unique=True, index=True, nullable=False)
    # Text используется для хранения больших строк (JSON-данных)
    dialogue_json = Column(Text, nullable=False)
    
    def __repr__(self):
        return f"<VNStage(stage_num='{self.stage_num}')>"
    
class Leader(Base):
    __tablename__ = "leaders"

    # Поля таблицы
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    score = Column(Integer, default=0)
    stage = Column(Integer, default=1)
    last_update = Column(DateTime, default=func.now())

    def __repr__(self):
        return f"<Leader(username='{self.username}', score={self.score}, stage={self.stage})>"