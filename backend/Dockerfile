FROM python:3.12-slim

WORKDIR /backend

# Install system packages required for ML libraries and PostgreSQL drivers
RUN apt-get -o Acquire::ForceIPv4=true update && apt-get -o Acquire::ForceIPv4=true install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy source code
COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
