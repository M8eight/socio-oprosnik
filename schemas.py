from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

# Схема для создания/обновления результата (данные, которые приходят от клиента)
class LeaderCreate(BaseModel):
    username: str = Field(..., min_length=1, description="Имя пользователя")
    score: int = Field(..., ge=0, description="Общее количество баллов")
    stage: int = Field(..., ge=0, description="Текущий этап")

# Схема для чтения результата (данные, которые отдаются клиенту)
class LeaderRead(LeaderCreate):
    id: int
    last_update: datetime

    class Config:
        # Позволяет Pydantic работать с объектами SQLAlchemy
        from_attributes = True
        
class Choice(BaseModel):
    text: str
    next: int
    isCorrect: bool = False

class Question(BaseModel):
    character: str
    text: str
    choices: List[Choice]
    type: str = "dialogue"
    correctResponse: Optional[str] = None
    wrongResponse: Optional[str] = None
    isLastQuiz: bool = False # Флаг для завершения этапа
    isEnd: bool = False

# Схема для возврата полного набора вопросов этапа
class StageData(BaseModel):
    stage_num: int = Field(..., ge=1, description="Номер этапа")
    dialogue_json: str = Field(..., description="JSON-строка с вопросами/диалогами ИЛИ персонажами")

# Схема для сохранения диалогов (для Admin UI)
class StageSave(BaseModel):
    stage_num: int = Field(..., ge=1, description="Номер этапа")
    # Используем строку, так как мы будем сохранять JSON-строку в БД
    dialogue_json: str = Field(..., description="JSON-строка с вопросами/диалогами")

# --- СУЩЕСТВУЮЩИЕ СХЕМЫ (ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ) ---

class LeaderCreate(BaseModel):
    username: str = Field(..., min_length=1, description="Имя пользователя")
    score: int = Field(..., ge=0, description="Общее количество баллов")
    stage: int = Field(..., ge=0, description="Текущий этап")

class LeaderRead(LeaderCreate):
    id: int
    last_update: datetime

    class Config:
        from_attributes = True