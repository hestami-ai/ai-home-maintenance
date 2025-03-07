#!/bin/bash

# Start Ollama server
ollama serve &

# Wait for Ollama server to start
sleep 5

# Pull the phi3 model if not already present
#ollama pull phi3:medium-128k
#ollama pull phi4:14b-q8_0
#ollama pull granite3.2:8b-instruct-fp16
#ollama pull deepseek-r1:14b-qwen-distill-q8_0
#ollama pull phi4-mini:3.8b-fp16
ollama pull command-r7b:7b-12-2024-fp16

# Keep container running
wait
