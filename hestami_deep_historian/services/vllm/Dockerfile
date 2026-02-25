# vLLM Inference Server for Historian Agent Platform
# Serves Qwen3-14B model with OpenAI-compatible API
#
# Based on vLLM v0.15.0 with CUDA 13.0 support

FROM vllm/vllm-openai:v0.15.0-cu130

# No additional packages needed - base image includes everything
# The model is mounted at runtime via volume

# Default entrypoint from base image runs vllm.entrypoints.openai.api_server
# Command is provided in docker-compose.yml
