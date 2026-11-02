# Dockerfile — Image of the Flask backend. Production runs gunicorn; compose overrides the command with the
# reloading dev server and bind-mounts the source over /srv/backend.
FROM python:3.12-slim

# No .pyc files (the dev bind mount would fill the repo with root-owned caches); unbuffered logs.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv/backend
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 5000
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:create_app()"]
