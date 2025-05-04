"""
Common utilities and constants for HTML chunking and extraction.
"""
import logging
from typing import Dict, List, Any, Optional, Tuple, Union, Callable

# Create a module-level logger
logger = logging.getLogger(__name__)

# Setup logging
def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """
    Set up logging with the specified log level.
    
    Args:
        log_level: The logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)
        
    Returns:
        A configured logger
    """
    # Convert string log level to logging constant
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        raise ValueError(f"Invalid log level: {log_level}")
    
    # Configure logging
    logging.basicConfig(
        level=numeric_level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Create and return a logger
    return logging.getLogger(__name__)

# Constants shared across modules
LLM_PROVIDERS = ['openai', 'anthropic', 'ollama', 'vllm', 'cerebras']
DEFAULT_LLM = 'ollama'
DEFAULT_MODEL = 'qwen2.5:14b-instruct-q4_1'
DEFAULT_MODELS = {
    'openai': 'gpt-4',
    'anthropic': 'claude-3-opus-20240229',
    'ollama': 'qwen2.5:14b-instruct-q4_1',
    'vllm': 'qwen2.5:14b-instruct-q4_1',
    'cerebras': 'cerebras-gpt-2.7b'
}

# Model context sizes
MODEL_CONTEXT_SIZES = {
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 4096,
    'gpt-3.5-turbo-16k': 16384,
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-2.1': 100000,
    'claude-2.0': 100000,
    'claude-instant-1.2': 100000,
    'llama3': 8192,
    'llama3:70b': 8192,
    'qwen2.5:14b-instruct-q4_1': 32768
}

def get_model_context_size(llm: str, model: str) -> int:
    """
    Get the context size for a given model.
    
    Args:
        llm: The LLM provider
        model: The model name
        
    Returns:
        The context size in tokens
    """
    # Check if the model is in the context sizes dictionary
    if model in MODEL_CONTEXT_SIZES:
        return MODEL_CONTEXT_SIZES[model]
    
    # Default context sizes based on provider
    default_sizes = {
        'openai': 4096,
        'anthropic': 100000,
        'ollama': 42768,
        'vllm': 42768,
        'cerebras': 2048
    }
    
    # Return the default size for the provider, or a general default
    return default_sizes.get(llm, 4096)
