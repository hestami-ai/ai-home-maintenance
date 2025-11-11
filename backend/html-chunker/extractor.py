"""
HTML extraction module for extracting structured information from HTML content using LLMs.
"""
import os
import re
import json
import time
import logging
import tempfile
import traceback
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union

# Create a module-level logger
logger = logging.getLogger(__name__)

from common import LLM_PROVIDERS, DEFAULT_LLM, DEFAULT_MODEL, DEFAULT_MODELS, get_model_context_size
from preprocessor import preprocess_html, extract_with_html2text, is_html_content
from chunker import (
    get_encoding, 
    get_prompt_template_tokens, 
    split_html_into_chunks, 
    merge_chunk_results,
    simple_chunk_text
)
from prompts import EXTRACTION_RULES, get_extraction_prompt_with_content


def process_html(
    html_content: str, 
    llm: str = DEFAULT_LLM, 
    model: str = DEFAULT_MODEL, 
    max_tokens: int = 8000, 
    overlap_percent: float = 0.1, 
    api_key: Optional[str] = None,
    output_file: Optional[str] = None,
    show_token_counts: bool = False,
    text_content: Optional[str] = None,
    source_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process HTML content to extract structured information using a remote LLM.
    
    Args:
        html_content: The HTML content to process
        llm: The LLM provider to use
        model: The model name to use
        max_tokens: Maximum tokens per chunk
        overlap_percent: Percentage of overlap between chunks (0.0 to 1.0)
        api_key: Optional API key for providers that require it
        output_file: Optional path to write the output JSON to
        show_token_counts: Whether to display token counts for each chunk
        text_content: Optional raw text content to use as a cross-check for extraction
        source_url: Optional source URL to detect data source and select appropriate prompt
        
    Returns:
        Extracted data as a dictionary
    """
    logger.info("Processing HTML content")
    
    # Detect source from URL if provided
    from source_detector import detect_source_from_url, get_source_display_name
    source = detect_source_from_url(source_url)
    logger.info(f"Detected source: {get_source_display_name(source)}")
    
    # Validate the LLM provider
    if llm not in LLM_PROVIDERS:
        logger.error(f"Unsupported LLM provider: {llm}. Supported providers: {', '.join(LLM_PROVIDERS)}")
        return {"error": f"Unsupported LLM provider: {llm}"}
    
    # Set default model if not specified
    if not model:
        model = DEFAULT_MODELS.get(llm)
        if not model:
            logger.error(f"No model specified and no default model available for {llm}")
            return {"error": f"No model specified and no default model available for {llm}"}
    
    # Print information about the extraction
    logger.info(f"Using LLM: {llm}, Model: {model}")
    logger.info(f"Chunk size (in tokens): {max_tokens}, Overlap percentage: {overlap_percent*100:.1f}%")
    
    try:
        # Check if the content is actually HTML
        if is_html_content(html_content):
            logger.info("Content identified as HTML, applying HTML preprocessing")
            
            # Preprocess the HTML content for further processing
            logger.debug("Preprocessing HTML content...")
            preprocessed_html = preprocess_html(html_content)
    
            # Extract raw text from HTML or use provided text_content if available
            if text_content:
                logger.debug("Using provided raw text content for cross-check")
                raw_text = text_content
            else:
                logger.debug("Extracting raw text from HTML...")
                raw_text = extract_with_html2text(html_content)
    
            # Combine preprocessed HTML and raw text
            preprocessed_html = preprocessed_html + "\n\n###  **Now, cross-check with the following raw text extraction of the HTML content: **\n\n" + raw_text
        else:
            logger.info("Content identified as plain text, skipping HTML preprocessing")
            # If it's not HTML, just use the content as is
            preprocessed_html = html_content

        # Determine the schema to use
        schema_path = determine_schema_path(html_content, None)
        
        # Calculate prompt template tokens
        prompt_template_tokens = get_prompt_template_tokens(llm, model, schema_path, source)
        logger.debug(f"Prompt template requires {prompt_template_tokens} tokens")
        
        # Calculate available tokens for content
        available_tokens = max_tokens - prompt_template_tokens
        logger.debug(f"Available tokens for content: {available_tokens}")
        
        # Get the encoding for token counting
        encoding = get_encoding(llm, model)
        
        # Count tokens in the preprocessed HTML with attributes
        html_tokens = len(encoding.encode(preprocessed_html))
        logger.info(f"Preprocessed HTML contains {html_tokens} tokens")
        
        # Check if we can process the entire HTML in one go
        if html_tokens <= available_tokens:
            logger.info("Processing entire HTML in a single extraction...")
            
            # Extract information directly
            result = extract_directly(preprocessed_html, llm, model, schema_path, api_key, source)
        else:
            logger.info(f"HTML content too large ({html_tokens} tokens), splitting into chunks...")
            
            # Calculate overlap in tokens
            overlap_tokens = int(available_tokens * overlap_percent)
            logger.debug(f"Using overlap of {overlap_tokens} tokens between chunks")
            
            # For text with attributes, use a simpler chunking approach that won't re-parse the HTML
            # and potentially lose the attributes we've injected
            chunks = simple_chunk_text(
                preprocessed_html,
                max_chunk_size=available_tokens,
                overlap=overlap_tokens,
                llm=llm,
                model=model
            )
            
            # Log detailed information about chunks
            logger.info(f"Split HTML into {len(chunks)} chunks")
            if logger.isEnabledFor(logging.DEBUG) or show_token_counts:
                for i, chunk in enumerate(chunks):
                    chunk_tokens = len(encoding.encode(chunk))
                    logger.info(f"Chunk {i+1}: {chunk_tokens} tokens")
            
            # Extract information from each chunk
            chunk_results = []
            for i, chunk in enumerate(chunks):
                chunk_tokens = len(encoding.encode(chunk))
                logger.info(f"Processing chunk {i+1}/{len(chunks)}... ({chunk_tokens} tokens)")
                
                # Extract information from the chunk
                chunk_result = extract_from_chunk(chunk, llm, model, schema_path, api_key, source)
                
                # Add the chunk result to the list
                chunk_results.append(chunk_result)
            
            # Merge the chunk results
            logger.info("Merging chunk results...")
            result = merge_chunk_results(chunk_results)
        
        # Write the result to the output file if specified
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2)
            logger.info(f"Extraction complete. Data saved to {output_file}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error processing HTML content: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        
        # Create an empty data structure
        empty_data = {
            "business_info": {},
            "services": {"offered": [], "specialties": [], "not_offered": []},
            "reviews": {"individual_reviews": []},
            "customer_interaction": {},
            "media": {"gallery_links": []}
        }
        
        return empty_data

def process_html_file(
    html_file: str, 
    output_file: str, 
    llm: str = DEFAULT_LLM, 
    model: Optional[str] = None, 
    api_key: Optional[str] = None, 
    max_tokens: int = 8000, 
    overlap_percent: float = 0.1,
    show_token_counts: bool = False,
    text_content: Optional[str] = None,
    source_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process an HTML file and extract information using an LLM.
    
    Args:
        html_file: Path to the HTML file
        output_file: Path to write the output JSON to
        llm: LLM provider to use
        model: Model name to use
        api_key: API key for the LLM provider
        max_tokens: Maximum tokens to use for extraction
        overlap_percent: Percentage of overlap between chunks (as a decimal)
        show_token_counts: Whether to display token counts for each chunk
        text_content: Optional raw text content to use as a cross-check for extraction
        source_url: Optional source URL to detect data source and select appropriate prompt
        
    Returns:
        Extracted data as a dictionary
    """
    logger.info(f"Processing HTML file: {html_file}")
    
    # Read the HTML file
    try:
        with open(html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        logger.info(f"Read {len(html_content)} bytes from {html_file}")
    except Exception as e:
        logger.error(f"Error reading HTML file: {str(e)}")
        raise
    
    # Process the HTML content
    result = process_html(
        html_content, 
        llm=llm, 
        model=model, 
        max_tokens=max_tokens, 
        overlap_percent=overlap_percent, 
        api_key=api_key,
        output_file=output_file,
        show_token_counts=show_token_counts,
        text_content=text_content,
        source_url=source_url
    )
    
    return result

def determine_schema_path(html_content: str, extraction_type: Optional[str] = None) -> str:
    """
    Determine the schema path based on the HTML content and extraction type.
    
    Args:
        html_content: The HTML content
        extraction_type: Optional extraction type
        
    Returns:
        Path to the schema file
    """
    # For now, always use the service provider schema
    # In the future, this could be more sophisticated based on the content
    return os.path.join(os.path.dirname(__file__), 'schemas', 'service-provider-schema.json')

def extract_directly(html_content: str, llm: str, model: str, schema_path: str, api_key: Optional[str] = None, source: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract information directly from HTML content without chunking.
    
    Args:
        html_content: The HTML content
        llm: LLM provider
        model: Model name
        schema_path: Path to the schema file
        api_key: Optional API key
        source: Optional source identifier for prompt selection
        
    Returns:
        Extracted information as a dictionary
    """
    # Load the schema
    from schema_loader import load_schema
    schema_type = os.path.basename(schema_path).replace('.json', '')
    schema = load_schema(schema_type)
    
    logger.info(f"Extracting information directly (single chunk) using schema: {schema_type}...")
    
    # Create a prompt for extraction
    prompt_text = EXTRACTION_RULES

    # Extract information using the LLM
    return extract_with_llm(prompt_text, html_content, llm, model, schema_type, api_key, source)

def extract_from_chunk(chunk: str, llm: str, model: str, schema_path: str, api_key: Optional[str] = None, source: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract information from a chunk of HTML content.
    
    Args:
        chunk: The HTML chunk
        llm: LLM provider
        model: Model name
        schema_path: Path to the schema file
        api_key: Optional API key
        source: Optional source identifier for prompt selection
        
    Returns:
        Extracted information as a dictionary
    """
    # Get the schema type from the schema path
    schema_type = os.path.basename(schema_path).replace('.json', '')
    
    logger.info(f"Extracting information from chunk using schema: {schema_type}...")
    
    # Create a prompt for extraction
    prompt_text = EXTRACTION_RULES
    
    # Extract information using the LLM
    return extract_with_llm(prompt_text, chunk, llm, model, schema_type, api_key, source)

def extract_with_llm(prompt_text: str, chunk: str, llm: str, model: str, schema_type: str, 
                     api_key: Optional[str] = None, source: Optional[str] = None) -> Dict[str, Any]:
    """
    Send a prompt and chunk of text to the specified LLM and return structured JSON.
    
    Args:
        prompt_text: The instruction prompt
        chunk: The text chunk to process
        llm: The LLM provider (openai, ollama, vllm, cerebras)
        model: The model name
        schema_type: Type of schema to use (e.g., 'business_info', 'services', etc.)
        api_key: Optional API key for providers that require it
        source: Optional source identifier for prompt selection
        
    Returns:
        Extracted data as a dictionary
    """
    logger.info(f"Extracting information from chunk using LLM: {llm} ({model})")
    
    try:
        # Create the extraction prompt
        full_prompt = create_extraction_prompt(prompt_text, chunk, schema_type, source)
        
        # Call the LLM
        response = call_llm(llm, model, full_prompt, api_key)
        
        # Parse the response
        result = _parse_json_response(response)
        
        return result
    
    except Exception as e:
        logger.error(f"Error extracting with LLM: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Return an empty result
        return {}

def call_llm(llm_provider: str, model: str, prompt: str, api_key: Optional[str] = None) -> str:
    """
    Call an LLM API with a prompt and return the response.
    
    Args:
        llm_provider: The LLM provider (openai, anthropic, ollama, vllm, cerebras)
        model: The model name
        prompt: The full prompt text
        api_key: Optional API key for providers that require it
        
    Returns:
        Response content from the API
    """
    logger.debug(f"Sending prompt to {llm_provider} ({model}):")
    logger.debug("=" * 80)
    logger.debug(prompt)
    logger.debug("=" * 80)
    
    # Check for environment variable API keys if not provided
    if api_key is None:
        env_var_name = f"{llm_provider.upper()}_API_KEY"
        api_key = os.environ.get(env_var_name)
    
    # Import necessary modules
    import requests
    
    try:
        # Handle OpenAI
        if llm_provider == 'openai':
            import openai
            
            # Set the API key
            if api_key:
                openai.api_key = api_key
            
            # Create the messages for the chat completion
            messages = [
                {"role": "system", "content": "You are a helpful assistant that extracts structured information from HTML content."},
                {"role": "user", "content": prompt}
            ]
            
            # Make the API call
            response = openai.ChatCompletion.create(
                model=model,
                messages=messages,
                temperature=0.1,
                max_tokens=4000
            )
            
            # Extract the content from the response
            content = response.choices[0].message.content
            
            # Log the response at debug level
            logger.debug(f"Response from {llm_provider} API:\n{content}")
            
            return content
        
        # Handle Anthropic
        elif llm_provider == 'anthropic':
            import anthropic
            
            # Verify API key
            if not api_key:
                raise ValueError("API key is required for Anthropic. Set ANTHROPIC_API_KEY environment variable or provide api_key parameter.")
            
            # Create the client
            client = anthropic.Anthropic(api_key=api_key)
            
            # Make the API call
            response = client.completions.create(
                model=model,
                prompt=f"{anthropic.HUMAN_PROMPT} {prompt} {anthropic.AI_PROMPT}",
                max_tokens_to_sample=4000,
                temperature=0.1
            )
            
            # Extract the content from the response
            content = response.completion
            
            # Log the response at debug level
            logger.debug(f"Response from {llm_provider} API:\n{content}")
            
            return content
        
        # Handle Ollama
        elif llm_provider == 'ollama':
            # Default Ollama endpoint
            ollama_endpoint = os.environ.get('OLLAMA_ENDPOINT', 'http://ollama:11434/api/generate')
            
            # Make the API call
            response = requests.post(
                ollama_endpoint,
                json={
                    'model': model,
                    'prompt': prompt,
                    'system': "You are an intelligent deterministic entity extractor component that reviews and understands the supplied schema and then extracts the relevant information from the supplied unstructured text.",
                    'temperature': 0.1,
                    'stream': False
                }
            )
            
            # Extract the content from the response
            content = response.json()['response']
            
            # Log the response at debug level
            logger.debug(f"Response from {llm_provider} API:\n{content}")
            
            return content
        
        # Handle vLLM
        elif llm_provider == 'vllm':
            # Default vLLM endpoint
            vllm_endpoint = os.environ.get('VLLM_ENDPOINT', 'http://vllm_container:8000/generate')
            
            # Make the API call
            response = requests.post(
                vllm_endpoint,
                json={
                    'model': model,
                    'prompt': f"<s>[INST] {prompt} [/INST]",
                    'temperature': 0.1,
                    'max_tokens': 4000
                }
            )
            
            # Extract the content from the response
            content = response.json()['text'][0]
            
            # Log the response at debug level
            logger.debug(f"Response from {llm_provider} API:\n{content}")
            
            return content
        
        # Handle Cerebras
        elif llm_provider == 'cerebras':
            # Default Cerebras endpoint
            cerebras_endpoint = os.environ.get('CEREBRAS_ENDPOINT', 'https://api.cerebras.ai/v1/completions')
            
            # Verify API key
            if not api_key:
                raise ValueError("API key is required for Cerebras. Set CEREBRAS_API_KEY environment variable or provide api_key parameter.")
            
            # Make the API call
            response = requests.post(
                cerebras_endpoint,
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': model,
                    'prompt': prompt,
                    'temperature': 0.1,
                    'max_tokens': 4000
                }
            )
            
            # Extract the content from the response
            content = response.json()['choices'][0]['text']
            
            # Log the response at debug level
            logger.debug(f"Response from {llm_provider} API:\n{content}")
            
            return content
        
        # Unsupported provider
        else:
            supported_providers = ['openai', 'anthropic', 'ollama', 'vllm', 'cerebras']
            raise ValueError(f"Unsupported LLM provider: {llm_provider}. Supported providers: {', '.join(supported_providers)}")
    
    except Exception as e:
        logger.error(f"Error calling {llm_provider} API: {str(e)}")
        raise

def create_extraction_prompt(prompt_text: str, chunk: str, schema_type: str, source: Optional[str] = None) -> str:
    """
    Create a prompt for extraction with the specified schema.
    
    Args:
        prompt_text: The instruction prompt
        chunk: The text chunk to process
        schema_type: Type of schema to use
        source: Optional source identifier for prompt selection
        
    Returns:
        Full prompt text
    """
    # Load the schema
    from schema_loader import load_schema
    schema = load_schema(schema_type)
    
    # Convert the schema to a string
    schema_str = json.dumps(schema, indent=2)
    
    # Create the full prompt using the centralized prompt template
    return get_extraction_prompt_with_content(schema_str, chunk, prompt_text, source)

def _parse_json_response(content: str) -> Dict[str, Any]:
    """
    Parse a JSON response from an LLM.
    
    Args:
        content: The response content from the LLM
        
    Returns:
        Parsed JSON as a dictionary
    """
    logger.debug(f"Parsing JSON response...")
    
    try:
        # First, try to find a JSON object in the response using regex
        json_match = re.search(r'```(?:json)?\s*({[\s\S]*?})\s*```', content)
        if json_match:
            json_str = json_match.group(1).strip()
            logger.debug(f"Extracted JSON string (length: {len(json_str)})")
            try:
                parsed_json = json.loads(json_str)
                logger.debug("Successfully parsed JSON from response")
                return parsed_json
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse extracted JSON: {e}")
                logger.debug(f"JSON string: {json_str}")
        
        # If no JSON object was found using regex, try to parse the entire response as JSON
        try:
            parsed_json = json.loads(content)
            logger.debug("Successfully parsed full response as JSON")
            return parsed_json
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse full content as JSON: {e}")
            # Show context around the error position
            if hasattr(e, 'pos') and e.pos:
                start = max(0, e.pos - 50)
                end = min(len(content), e.pos + 50)
                context = content[start:end]
                logger.error(f"Error context: ...{context}...")
            logger.debug(f"Content (first 1000 chars): {content[:1000]}")
            
            # Try to clean the response and parse again
            cleaned_response = content.strip()
            
            # Remove invalid control characters (but keep valid ones like \n, \t, \r)
            # Control characters are 0x00-0x1F except for \t (0x09), \n (0x0A), \r (0x0D)
            cleaned_response = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', cleaned_response)
            
            # Remove any text before the first '{'
            first_brace = cleaned_response.find('{')
            if first_brace != -1:
                cleaned_response = cleaned_response[first_brace:]
            # Remove any text after the last '}'
            last_brace = cleaned_response.rfind('}')
            if last_brace != -1:
                cleaned_response = cleaned_response[:last_brace+1]
            
            # Remove comments from JSON (both // and /* */ style)
            cleaned_response = re.sub(r'//.*?$', '', cleaned_response, flags=re.MULTILINE)  # Remove // comments
            cleaned_response = re.sub(r'/\*.*?\*/', '', cleaned_response, flags=re.DOTALL)  # Remove /* */ comments
            
            logger.debug(f"Cleaned JSON for parsing (first 500 chars):\n{cleaned_response[:500]}")
                
            try:
                parsed_json = json.loads(cleaned_response)
                logger.debug("Successfully parsed cleaned response as JSON")
                return parsed_json
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse cleaned response as JSON: {e}")
                
                # As a last resort, try to use a more lenient JSON parser
                try:
                    import demjson3
                    parsed_json = demjson3.decode(cleaned_response)
                    logger.debug("Successfully parsed with demjson3")
                    return parsed_json
                except (ImportError, Exception) as e:
                    logger.error(f"Failed to parse with demjson3: {e}")
        
        # If all parsing attempts fail, return a raw content fallback
        logger.warning("Returning raw content as fallback")
        return {"raw_content": content}
    
    except Exception as e:
        logger.error(f"Error parsing JSON response: {str(e)}")
        return {"error": str(e)}

# Export key functions
__all__ = [
    'process_html',
    'process_html_file',
    'extract_directly',
    'extract_from_chunk',
    'extract_with_llm',
    'call_llm',
    '_parse_json_response',
    'determine_schema_path'
]
