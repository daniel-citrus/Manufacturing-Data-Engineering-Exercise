FROM python:3.14-slim

# Same layout as the repo, so main.py finds ../analysis/data/processed (mounted by compose.yaml).
WORKDIR /app/backend

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py datasets.py ./

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
