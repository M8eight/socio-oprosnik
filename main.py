from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
import models
import schemas
import database
from fastapi.middleware.cors import CORSMiddleware
import json

# Инициализация FastAPI
app = FastAPI(title="Leaderboard API")

# Создаем таблицы в БД
models.Base.metadata.create_all(bind=database.engine)

# --- Настройка CORS ---
origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "null"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API МАРШРУТЫ ИДУТ ПЕРВЫМИ! ---

@app.post("/submit-score/", response_model=schemas.LeaderRead, status_code=201)
def submit_score(leader_data: schemas.LeaderCreate, db: Session = Depends(database.get_db)):
    db_leader = db.query(models.Leader).filter(models.Leader.username == leader_data.username).first()

    if db_leader:
        if leader_data.score > db_leader.score:
            db_leader.score = leader_data.score
            db_leader.stage = leader_data.stage
            db.commit()
            db.refresh(db_leader)
            return db_leader
        else:
            return db_leader
    else:
        new_leader = models.Leader(**leader_data.model_dump())
        db.add(new_leader)
        db.commit()
        db.refresh(new_leader)
        return new_leader


@app.get("/leaderboard/", response_model=list[schemas.LeaderRead])
def get_leaderboard(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    leaders = (
        db.query(models.Leader)
        .order_by(desc(models.Leader.score))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return leaders


@app.get("/stage/{stage_num}", response_model=schemas.StageData)
def get_stage_data(stage_num: int, db: Session = Depends(database.get_db)):
    db_stage = db.query(models.VNStage).filter(models.VNStage.stage_num == stage_num).first()

    if not db_stage:
        raise HTTPException(status_code=404, detail=f"Этап {stage_num} не найден в базе данных.")
    
    return {
        "stage_num": stage_num, 
        "dialogue_json": db_stage.dialogue_json
    }


@app.post("/stage/save/", status_code=201)
def save_stage_data(stage_data: schemas.StageSave, db: Session = Depends(database.get_db)):
    db_stage = db.query(models.VNStage).filter(models.VNStage.stage_num == stage_data.stage_num).first()
    
    try:
        json.loads(stage_data.dialogue_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Невалидный JSON-формат диалогов.")
    
    if db_stage:
        db_stage.dialogue_json = stage_data.dialogue_json
        db.commit()
        db.refresh(db_stage)
        return {"message": f"Этап {db_stage.stage_num} успешно обновлен."}
    else:
        new_stage = models.VNStage(
            stage_num=stage_data.stage_num,
            dialogue_json=stage_data.dialogue_json
        )
        db.add(new_stage)
        db.commit()
        db.refresh(new_stage)
        return {"message": f"Этап {new_stage.stage_num} успешно создан."}


# --- СТАТИЧЕСКИЕ ФАЙЛЫ И HTML В КОНЦЕ! ---

@app.get("/")
async def read_root():
    return FileResponse("index.html")

@app.get("/admin")
async def read_admin():
    return FileResponse("admin.html")

# Раздаём папку media
app.mount("/media", StaticFiles(directory="media"), name="media")

app.mount("/static", StaticFiles(directory="static"), name="static")