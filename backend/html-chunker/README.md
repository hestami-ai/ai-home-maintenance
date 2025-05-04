# HTML Chunker

A tool for extracting structured information from HTML files containing business listings using remote LLMs.

## Overview

This tool processes HTML files containing business listings and extracts structured information using remote language models. The extracted data is formatted according to a predefined JSON schema and includes business details, services offered, customer reviews, pricing information, and awards.

## Features

- Processes HTML files to extract structured business information
- Uses remote LLMs (OpenAI, Ollama, vLLM, Cerebras) for intelligent extraction
- Implements smart chunking for handling large HTML files
- Provides both CLI and FastAPI interfaces
- Configurable chunk size and overlap

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Command Line Interface

```bash
python remote_extractor.py --mode cli --llm vllm --model Qwen/Qwen2.5-3B-Instruct --input path/to/input.html --output path/to/output.json --max-tokens 2048 --overlap 2000

python remote_extractor.py --mode cli --llm vllm --model Qwen/Qwen2.5-3B-Instruct --input ../../docs/hestami-ai/docs/Thumbtack-Example-JNB-DOM-as-HTML(Focused).html --output JNB-Extracted.json --debug

python remote_extractor.py --mode cli --llm vllm --model Qwen/Qwen2.5-14B-Instruct-GPTQ-Int4 --input ../../docs/hestami-ai/docs/Thumbtack-Example-GandG(Focused).html --output GandG-Extracted.json --debug --max-tokens 7000

python remote_extractor.py --mode cli --llm ollama --model qwen2.5:14b-instruct-q4_1 --input ../../docs/hestami-ai/docs/Thumbtack-Example-Best-American-Paint(Focused).html --output BAP-Extracted.json --debug --max-tokens 24000

python remote_extractor.py --mode cli --llm ollama --model deepseek-r1:14b-qwen-distill-q4_K_M --input ../../docs/hestami-ai/docs/Thumbtack-Example-JNB-DOM-as-HTML(Focused).html --output JNP-Extracted.json --debug --max-tokens 7000
```

Options:
- `--mode`: Mode of operation (`cli` or `api`)
- `--llm`: LLM provider to use (`openai`, `ollama`, `vllm`, `cerebras`)
- `--model`: Model name to use with the LLM provider
- `--input`: Path to the input HTML file
- `--output`: Path to save the output JSON file
- `--max-tokens`: Maximum tokens per chunk (default: 2048)
- `--overlap`: Number of tokens to overlap between chunks (default: 2000)
- `--api-key`: API key for providers that require it (e.g., OpenAI, Cerebras)

### Web API

Start the API server:

```bash
python remote_extractor.py --mode api
```

Or directly:

```bash
python api.py
```

The API will be available at `http://localhost:8000` with the following endpoints:

- `POST /extract`: Extract information from an uploaded HTML file
- `GET /providers`: Get the list of supported LLM providers
- `GET /health`: Health check endpoint

#### Example API request using curl:

```bash
curl -X POST "http://localhost:8000/extract" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@path/to/input.html" \
  -F "llm=vllm" \
  -F "model=Qwen/Qwen2.5-3B-Instruct" \
  -F "max_tokens=2048" \
  -F "overlap=2000"
```

## Output Format

The extracted data is saved in JSON format according to the service provider schema, including:

- Business information (name, description, hours, etc.)
- Services offered and not offered
- Customer reviews
- Pricing information
- Awards and credentials
