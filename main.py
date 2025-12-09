from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
import models
import schemas
import database
import json
import os
from typing import List
from fastapi import Header, HTTPException, status
from sqlalchemy import text

# ==================== FastAPI app ====================
app = FastAPI(title="Leaderboard API", openapi_url="/api/openapi.json", docs_url="/api/docs")

# Создаём таблицы
models.Base.metadata.create_all(bind=database.engine)

# ==================== Папка для медиа ====================
MEDIA_DIR = "./media"
os.makedirs(MEDIA_DIR, exist_ok=True)

# ==================== CORS ====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== API Роуты ====================

@app.get("/users/{user_id}", response_model=schemas.LeaderRead)
def read_user(user_id: int, db: Session = Depends(database.get_db)):
    db_leader = db.query(models.Leader).filter(models.Leader.id == user_id).first()
    if not db_leader:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return db_leader

@app.put("/users/{user_id}", response_model=schemas.LeaderRead)
def update_user(user_id: int, leader_update: schemas.LeaderCreate, db: Session = Depends(database.get_db)):
    db_leader = db.query(models.Leader).filter(models.Leader.id == user_id).first()
    if not db_leader:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db_leader.username = leader_update.username
    db_leader.score = leader_update.score
    db_leader.stage = leader_update.stage
    db.commit()
    db.refresh(db_leader)
    return db_leader

@app.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(database.get_db)):
    db_leader = db.query(models.Leader).filter(models.Leader.id == user_id).first()
    if not db_leader:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    db.delete(db_leader)
    db.commit()
    return

@app.post("/uploadfile/")
async def create_upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(MEDIA_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            buffer.write(chunk)
    return {"filename": file.filename, "url": f"/media/{file.filename}"}

@app.get("/media/list/", response_model=List[str])
def list_media_files():
    files = [f for f in os.listdir(MEDIA_DIR) if os.path.isfile(os.path.join(MEDIA_DIR, f))]
    return files

@app.post("/submit-score/", response_model=schemas.LeaderRead)
def submit_score(leader_data: schemas.LeaderCreate, db: Session = Depends(database.get_db)):
    db_leader = db.query(models.Leader).filter(models.Leader.username == leader_data.username).first()
    if db_leader:
        updated = False
        if leader_data.score > db_leader.score:
            db_leader.score = leader_data.score
            updated = True
        if leader_data.stage > db_leader.stage:
            db_leader.stage = leader_data.stage
            updated = True
        if updated:
            db.commit()
            db.refresh(db_leader)
        return db_leader
    else:
        new_leader = models.Leader(**leader_data.model_dump())
        db.add(new_leader)
        db.commit()
        db.refresh(new_leader)
        return new_leader

@app.get("/get-progress/", response_model=schemas.LeaderRead)
def get_user_progress(username: str = Query(...), db: Session = Depends(database.get_db)):
    db_leader = db.query(models.Leader).filter(models.Leader.username == username).first()
    if not db_leader:
        new_leader = models.Leader(username=username, score=0, stage=0)
        db.add(new_leader)
        db.commit()
        db.refresh(new_leader)
        return new_leader
    return db_leader

@app.get("/leaderboard/", response_model=list[schemas.LeaderRead])
def get_leaderboard(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(models.Leader).order_by(desc(models.Leader.score)).offset(skip).limit(limit).all()

@app.get("/stage/{stage_num}", response_model=schemas.StageData)
def get_stage_data(stage_num: int, db: Session = Depends(database.get_db)):
    db_stage = db.query(models.VNStage).filter(models.VNStage.stage_num == stage_num).first()
    if not db_stage:
        raise HTTPException(status_code=404, detail=f"Этап {stage_num} не найден")
    return {"stage_num": stage_num, "dialogue_json": db_stage.dialogue_json}

@app.post("/stage/save/", status_code=201)
def save_stage_data(stage_data: schemas.StageSave, db: Session = Depends(database.get_db)):
    json.loads(stage_data.dialogue_json)  # валидация
    db_stage = db.query(models.VNStage).filter(models.VNStage.stage_num == stage_data.stage_num).first()
    if db_stage:
        db_stage.dialogue_json = stage_data.dialogue_json
        msg = f"Этап {db_stage.stage_num} обновлён"
    else:
        db_stage = models.VNStage(stage_num=stage_data.stage_num, dialogue_json=stage_data.dialogue_json)
        db.add(db_stage)
        msg = f"Этап {db_stage.stage_num} создан"
    db.commit()
    db.refresh(db_stage)
    return {"message": msg}

app.mount("/media", StaticFiles(directory="media"), name="media")

# 2. Статические файлы (css/js/иконки)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 3. ВСЁ ОСТАЛЬНОЕ - ПОСЛЕДНИМ! (index.html и т.д.)
# КРИТИЧНО: Это должно быть в самом конце, после всех API роутов
app.mount("/", StaticFiles(directory=".", html=True), name="site")

app.mount("/admin", StaticFiles(directory=".", html=True), name="site")