"""
FastAPI endpoint for HTML chunking and extraction using remote LLMs.
"""
import os
import json
import tempfile
from typing import Optional, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Body
from fastapi.responses import JSONResponse
import uvicorn
from extractor import process_html, LLM_PROVIDERS, DEFAULT_LLM, DEFAULT_MODEL, DEFAULT_MODELS
import logging
from pydantic import BaseModel

# Create a module-level logger
logger = logging.getLogger(__name__)

# Configure the FastAPI app with increased request size limits
app = FastAPI(
    title="HTML Chunker API",
    description="API for extracting structured information from HTML content",
    version="1.0.0"
)

# Define a model for the request body
class HTMLExtractionRequest(BaseModel):
    html_content: str
    text_content: Optional[str] = None
    llm: str = DEFAULT_LLM
    model: str = DEFAULT_MODEL
    max_tokens: int = 24048
    overlap_percent: float = 0.1
    log_level: str = "INFO"

@app.post("/extract", response_model=Dict[str, Any])
async def extract_from_html(
    file: UploadFile = File(...),
    llm: str = Form(DEFAULT_LLM),
    model: str = Form(DEFAULT_MODEL),
    max_tokens: int = Form(24048),
    overlap_percent: float = Form(0.1),
    log_level: str = Form("INFO"),
    text_content: Optional[str] = Form(None)
):
    """
    Extract structured information from an uploaded HTML file.
    
    Args:
        file: HTML file to extract from
        llm: The LLM provider to use
        model: The model name to use
        max_tokens: Maximum tokens per chunk
        overlap_percent: Percentage of overlap between chunks
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        text_content: Optional raw text content to use as a cross-check for extraction
        
    Returns:
        Extracted data as JSON
    """
    # Configure logging based on the provided log level
    log_level_upper = log_level.upper()
    numeric_level = getattr(logging, log_level_upper, logging.INFO)
    
    # Configure the root logger which will be used by all modules
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Clear existing handlers to avoid duplicate logs
    if root_logger.handlers:
        for handler in root_logger.handlers:
            root_logger.removeHandler(handler)
    
    # Add a new handler with the desired format
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    
    logger.info(f"Extraction request received with LLM: {llm}, model: {model}")
    logger.info(f"Log level set to: {log_level_upper}")
    if text_content:
        logger.info("Raw text content provided for cross-checking")
    
    # Validate LLM provider
    if llm not in LLM_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported LLM provider: {llm}. Supported providers: {LLM_PROVIDERS}")
    
    try:
        # Read the uploaded file
        contents = await file.read()
        html_content = contents.decode("utf-8")
        
        # Process the HTML content using the process_html function
        extracted_data = process_html(
            html_content,
            llm=llm,
            model=model,
            max_tokens=max_tokens,
            overlap_percent=overlap_percent,
            text_content=text_content
        )
        return extracted_data
    except Exception as e:
        logger.error(f"Error during extraction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract_from_string", response_model=Dict[str, Any])
async def extract_from_html_string(request: HTMLExtractionRequest):
    """
    Extract structured information from HTML content provided as a string.
    
    Args:
        request: The request object containing HTML content and extraction parameters
        
    Returns:
        Extracted data as JSON
    """
    # Configure logging based on the provided log level
    log_level_upper = request.log_level.upper()
    numeric_level = getattr(logging, log_level_upper, logging.INFO)
    
    # Configure the root logger which will be used by all modules
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Clear existing handlers to avoid duplicate logs
    if root_logger.handlers:
        for handler in root_logger.handlers:
            root_logger.removeHandler(handler)
    
    # Add a new handler with the desired format
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    root_logger.addHandler(handler)
    
    logger.info(f"Extraction request received with LLM: {request.llm}, model: {request.model}")
    logger.info(f"Log level set to: {log_level_upper}")
    logger.info(f"HTML content size: {len(request.html_content)} bytes")
    if request.text_content:
        logger.info(f"Raw text content size: {len(request.text_content)} bytes")
    
    # Validate LLM provider
    if request.llm not in LLM_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported LLM provider: {request.llm}. Supported providers: {LLM_PROVIDERS}")
    
    try:
        # Process the HTML content
        extracted_data = process_html(
            request.html_content,
            llm=request.llm,
            model=request.model,
            max_tokens=request.max_tokens,
            overlap_percent=request.overlap_percent,
            text_content=request.text_content
        )
        return extracted_data
    except Exception as e:
        logger.error(f"Error during extraction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/providers")
async def get_providers():
    """Get the list of supported LLM providers."""
    return {"providers": LLM_PROVIDERS}

@app.get("/models")
async def get_models(provider: str):
    """Get the list of supported models for a provider."""
    if provider not in LLM_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported LLM provider: {provider}")
    
    # Return the default model for the provider
    return {"default_model": DEFAULT_MODELS.get(provider, DEFAULT_MODEL)}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

def start_api(host: str = "0.0.0.0", port: int = 8000):
    """Start the FastAPI server."""
    uvicorn.run(
        "api:app", 
        host=host, 
        port=port,
        log_level="info",
        limit_concurrency=10,
        limit_request_line=8190,
        limit_request_field_size=8190,
        timeout_keep_alive=120
    )

if __name__ == "__main__":
    start_api()
