# Backend image for Cloud Run. Listens on $PORT (Cloud Run sets it) and binds to 0.0.0.0.
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

RUN useradd --create-home appuser && mkdir -p /app/uploads && chown appuser /app/uploads
USER appuser

CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
