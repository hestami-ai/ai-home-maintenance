# Historian Training Service
# Based on Unsloth for efficient QLoRA fine-tuning
#
# Usage:
#   docker compose --profile training up training
#
# GPU Requirements:
#   - NVIDIA RTX 4090 (24GB VRAM) or equivalent
#   - CUDA 12.x drivers

FROM unsloth/unsloth:latest

WORKDIR /app

# Install additional dependencies
RUN pip install --no-cache-dir \
    pyyaml>=6.0 \
    psycopg2-binary>=2.9.9 \
    jsonschema>=4.20.0

# Copy training scripts and configs
COPY services/training/*.py /app/
COPY services/training/configs /app/configs/
COPY schemas /app/schemas/

# Set environment defaults
ENV MODEL_PATH=/models/base
ENV ADAPTERS_PATH=/models/adapters
ENV TRAINING_DATA_PATH=/training-data
ENV CONFIG_PATH=/app/configs/default.yaml

# Entry point
ENTRYPOINT ["python", "train_historian.py"]
