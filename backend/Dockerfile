FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
RUN pip install .

RUN useradd --system --no-create-home --uid 10001 appuser
USER appuser

EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn prometheus_backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
