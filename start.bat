@echo off
echo venv delait...
if not exist venv (
    python -m venv venv
)

echo venv delait 2...
call venv\Scripts\activate.bat

echo shdi...
pip install -r requirements.txt

start chrome http://localhost:8080/

echo Start server est...
uvicorn main:app --reload --port 8080 --host 0.0.0.0


