"""
HTML chunking module for splitting HTML content into manageable chunks for LLM processing.
"""
import os
import re
import json
import logging
from typing import List, Dict, Any, Optional, Tuple, Union
from bs4 import BeautifulSoup

# Create a module-level logger
logger = logging.getLogger(__name__)

from common import LLM_PROVIDERS, DEFAULT_LLM, DEFAULT_MODEL, MODEL_CONTEXT_SIZES, get_model_context_size
from prompts import get_full_extraction_prompt

def get_encoding(llm: str, model: str) -> Any:
    """
    Get the appropriate encoding for the given LLM and model.
    
    Args:
        llm: The LLM provider
        model: The model name
        
    Returns:
        A tokenizer encoding
    """
    logger = logging.getLogger(__name__)
    
    try:
        import tiktoken
        
        # Use cl100k_base for all models
        encoding_name = "cl100k_base"
        logger.debug(f"Using tiktoken encoding: {encoding_name} for {llm}/{model}")
        return tiktoken.get_encoding(encoding_name)
    
    except Exception as e:
        logger.warning(f"Error getting encoding: {str(e)}, using simple token counting approximation")
        
        # Simple token counting approximation
        class SimpleTokenizer:
            def encode(self, text):
                # Approximate token count: 1 token ~= 4 chars for English text
                return [1] * (len(text) // 4 + 1)
                
            def decode(self, tokens):
                return "".join(["X"] * len(tokens))
        
        return SimpleTokenizer()

def get_tokenizer(model: str):
    """
    Get a tokenizer for the specified model.
    
    Args:
        model: The model name
        
    Returns:
        A tokenizer function
    """
    # Simple tokenizer that splits on whitespace
    return lambda text: text.split()

def get_prompt_template_tokens(llm: str, model: str, schema_path: str) -> int:
    """
    Calculate the number of tokens in the prompt template.
    
    Args:
        llm: The LLM provider
        model: The model name
        schema_path: Path to the schema file
        
    Returns:
        Number of tokens in the prompt template
    """
    logger = logging.getLogger(__name__)
    
    try:
        # Load the schema
        with open(schema_path, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        
        # Convert the schema to a string
        schema_str = json.dumps(schema, indent=2)
        
        # Get the template prompt from the centralized prompts module
        template_prompt = get_full_extraction_prompt(schema_str)
        
        # Replace the content placeholder with a short placeholder
        template_prompt = template_prompt.replace("{content}", "[HTML_CONTENT_PLACEHOLDER]")
        
        # Get the encoding
        encoding = get_encoding(llm, model)
        
        # Count the tokens
        template_tokens = len(encoding.encode(template_prompt))
        
        logger.debug(f"Prompt template tokens: {template_tokens}")
        
        return template_tokens
    
    except Exception as e:
        logger.warning(f"Error calculating prompt template tokens: {str(e)}")
        # Return a default value
        return 1000

def split_html_into_chunks(html_content: str, max_chunk_size: int = 8000, 
                          overlap: int = 800, prompt_template_tokens: int = 1000) -> List[str]:
    """
    Split HTML content into chunks for processing.
    
    Args:
        html_content: The HTML content to split
        max_chunk_size: Maximum chunk size in tokens
        overlap: Number of tokens to overlap between chunks
        prompt_template_tokens: Number of tokens in the prompt template
        
    Returns:
        List of HTML chunks
    """
    logger = logging.getLogger(__name__)
    logger.debug(f"Splitting HTML into chunks (max size: {max_chunk_size}, overlap: {overlap})")
    
    # Parse the HTML
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Get all elements at the block level
    block_elements = soup.find_all(['div', 'section', 'article', 'header', 'footer', 
                                   'main', 'aside', 'nav', 'p', 'h1', 'h2', 'h3', 
                                   'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl', 'dt', 
                                   'dd', 'table', 'tr', 'td', 'th'])
    
    # Calculate available tokens for content
    available_tokens = max_chunk_size - prompt_template_tokens
    
    # Initialize chunks
    chunks = []
    current_chunk = ""
    current_tokens = 0
    
    # Process each block element
    for element in block_elements:
        # Get the HTML string for the element
        element_html = str(element)
        
        # Approximate token count (4 chars per token)
        element_tokens = len(element_html) // 4
        
        # Check if adding this element would exceed the available tokens
        if current_tokens + element_tokens > available_tokens and current_chunk:
            # Add the current chunk to the list
            chunks.append(current_chunk)
            
            # Start a new chunk with overlap
            overlap_elements = []
            overlap_tokens = 0
            
            # Find elements to include in the overlap
            for overlap_element in reversed(BeautifulSoup(current_chunk, 'html.parser').find_all()):
                overlap_html = str(overlap_element)
                overlap_element_tokens = len(overlap_html) // 4
                
                if overlap_tokens + overlap_element_tokens <= overlap:
                    overlap_elements.insert(0, overlap_html)
                    overlap_tokens += overlap_element_tokens
                else:
                    break
            
            # Create the overlap chunk
            current_chunk = "".join(overlap_elements)
            current_tokens = overlap_tokens
        
        # Add the element to the current chunk
        current_chunk += element_html
        current_tokens += element_tokens
    
    # Add the final chunk if it's not empty
    if current_chunk:
        chunks.append(current_chunk)
    
    logger.debug(f"Split HTML into {len(chunks)} chunks")
    
    return chunks

def merge_chunk_results(chunk_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Merge results from multiple chunks into a single result.
    
    Args:
        chunk_results: List of results from processing individual chunks
        
    Returns:
        Merged result
    """
    logger = logging.getLogger(__name__)
    logger.debug(f"Merging results from {len(chunk_results)} chunks")
    
    # Initialize merged result
    merged_result = {
        "business_info": {},
        "services": {
            "offered": [],
            "specialties": [],
            "not_offered": []
        },
        "reviews": {
            "individual_reviews": []
        },
        "customer_interaction": {},
        "media": {
            "gallery_links": []
        }
    }
    
    # Track seen items to avoid duplicates
    seen_services = set()
    seen_specialties = set()
    seen_not_offered = set()
    seen_reviews = set()
    seen_gallery_links = set()
    seen_awards = set()  # Add tracking for awards
    
    # Merge business info (take the most complete one)
    for result in chunk_results:
        if "business_info" in result:
            # Handle array fields specially
            for key, value in result["business_info"].items():
                # Special handling for array fields like awards
                if isinstance(value, list):
                    if key not in merged_result["business_info"]:
                        merged_result["business_info"][key] = []
                    
                    # Add items from the array, avoiding duplicates
                    for item in value:
                        item_str = json.dumps(item, sort_keys=True)
                        if key == "awards":  # Special handling for awards
                            if item_str not in seen_awards:
                                seen_awards.add(item_str)
                                merged_result["business_info"][key].append(item)
                        else:  # Generic handling for other arrays
                            if item not in merged_result["business_info"][key]:
                                merged_result["business_info"][key].append(item)
                # Special handling for nested objects like license
                elif isinstance(value, dict):
                    if key not in merged_result["business_info"]:
                        merged_result["business_info"][key] = {}
                    
                    # Merge the nested object fields, preferring non-empty values
                    for subkey, subvalue in value.items():
                        if subvalue and (subkey not in merged_result["business_info"][key] or 
                                        not merged_result["business_info"][key][subkey]):
                            merged_result["business_info"][key][subkey] = subvalue
                # Handle non-array fields
                elif value and (key not in merged_result["business_info"] or not merged_result["business_info"][key]):
                    merged_result["business_info"][key] = value
    
    # Merge services
    for result in chunk_results:
        if "services" in result:
            # Merge offered services
            if "offered" in result["services"]:
                for service in result["services"]["offered"]:
                    service_str = json.dumps(service, sort_keys=True)
                    if service_str not in seen_services:
                        seen_services.add(service_str)
                        merged_result["services"]["offered"].append(service)
            
            # Merge specialties
            if "specialties" in result["services"]:
                for specialty in result["services"]["specialties"]:
                    specialty_str = json.dumps(specialty, sort_keys=True)
                    if specialty_str not in seen_specialties:
                        seen_specialties.add(specialty_str)
                        merged_result["services"]["specialties"].append(specialty)
            
            # Merge not offered services
            if "not_offered" in result["services"]:
                for service in result["services"]["not_offered"]:
                    service_str = json.dumps(service, sort_keys=True)
                    if service_str not in seen_not_offered:
                        seen_not_offered.add(service_str)
                        merged_result["services"]["not_offered"].append(service)
    
    # Merge reviews
    for result in chunk_results:
        if "reviews" in result:
            # Merge review statistics (take the highest values)
            for key, value in result["reviews"].items():
                if key != "individual_reviews":
                    if isinstance(value, dict):
                        # Handle nested objects like rating_distribution
                        if key not in merged_result["reviews"]:
                            merged_result["reviews"][key] = {}
                        for subkey, subvalue in value.items():
                            if subvalue and (subkey not in merged_result["reviews"][key] or 
                                           not merged_result["reviews"][key][subkey]):
                                merged_result["reviews"][key][subkey] = subvalue
                    elif key not in merged_result["reviews"] or (
                        isinstance(value, (int, float)) and 
                        (key not in merged_result["reviews"] or value > merged_result["reviews"][key])
                    ):
                        merged_result["reviews"][key] = value
            
            # Merge individual reviews
            if "individual_reviews" in result["reviews"]:
                for review in result["reviews"]["individual_reviews"]:
                    review_str = json.dumps(review, sort_keys=True)
                    if review_str not in seen_reviews:
                        seen_reviews.add(review_str)
                        merged_result["reviews"]["individual_reviews"].append(review)
    
    # Merge customer interaction
    for result in chunk_results:
        if "customer_interaction" in result:
            # Update customer interaction with non-empty values
            for key, value in result["customer_interaction"].items():
                if value and (key not in merged_result["customer_interaction"] or not merged_result["customer_interaction"][key]):
                    merged_result["customer_interaction"][key] = value
    
    # Merge media
    for result in chunk_results:
        if "media" in result:
            # Merge media statistics
            for key, value in result["media"].items():
                if key != "gallery_links":
                    if key not in merged_result["media"] or (
                        isinstance(value, (int, float)) and value > merged_result["media"].get(key, 0)
                    ):
                        merged_result["media"][key] = value
            
            # Merge gallery links
            if "gallery_links" in result["media"]:
                for link in result["media"]["gallery_links"]:
                    link_str = json.dumps(link, sort_keys=True)
                    if link_str not in seen_gallery_links:
                        seen_gallery_links.add(link_str)
                        merged_result["media"]["gallery_links"].append(link)
    
    logger.debug("Chunk results merged successfully")
    
    return merged_result

def discover_information_locations(chunks: List[str], llm: str, model: str, 
                                  api_key: Optional[str] = None) -> Dict[str, List[int]]:
    """
    Discover which chunks contain which types of information.
    
    Args:
        chunks: List of HTML chunks
        llm: LLM provider
        model: Model name
        api_key: API key for the LLM provider
        
    Returns:
        Mapping of information types to chunk indices
    """
    logger = logging.getLogger(__name__)
    logger.debug(f"Discovering information locations in {len(chunks)} chunks")
    
    # Initialize content map
    content_map = {
        "business_info": [],
        "services": [],
        "reviews": [],
        "customer_interaction": [],
        "media": []
    }
    
    # Process each chunk to discover information types
    for i, chunk in enumerate(chunks):
        logger.debug(f"Analyzing chunk {i+1}/{len(chunks)}")
        
        # Check for business info
        if re.search(r'business|company|address|phone|email|website|hours|about', chunk, re.IGNORECASE):
            content_map["business_info"].append(i)
        
        # Check for services
        if re.search(r'service|product|offer|provide|specialize|specialty', chunk, re.IGNORECASE):
            content_map["services"].append(i)
        
        # Check for reviews
        if re.search(r'review|rating|star|testimonial|feedback', chunk, re.IGNORECASE):
            content_map["reviews"].append(i)
        
        # Check for customer interaction
        if re.search(r'contact|form|message|chat|call|appointment|book|schedule', chunk, re.IGNORECASE):
            content_map["customer_interaction"].append(i)
        
        # Check for media
        if re.search(r'image|photo|gallery|video|media', chunk, re.IGNORECASE):
            content_map["media"].append(i)
    
    logger.debug(f"Information locations discovered: {content_map}")
    
    return content_map

def extract_targeted_information(chunks: List[str], content_map: Dict[str, List[int]], 
                               llm: str, model: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Extract information from chunks based on the content map.
    
    Args:
        chunks: List of HTML chunks
        content_map: Mapping of information types to chunk indices
        llm: LLM provider
        model: Model name
        api_key: API key for the LLM provider
        
    Returns:
        Extracted information
    """
    logger = logging.getLogger(__name__)
    logger.debug("Extracting targeted information based on content map")
    
    # Initialize result
    result = {
        "business_info": {},
        "services": {
            "offered": [],
            "specialties": [],
            "not_offered": []
        },
        "reviews": {
            "individual_reviews": []
        },
        "customer_interaction": {},
        "media": {
            "gallery_links": []
        }
    }
    
    # Extract business info
    if content_map["business_info"]:
        logger.debug(f"Extracting business info from {len(content_map['business_info'])} chunks")
        business_info_chunks = [chunks[i] for i in content_map["business_info"]]
        # This would call the extractor module to extract business info
        # For now, we'll just return a placeholder
        result["business_info"] = {
            "name": "Business Name",
            "address": "Business Address",
            "phone": "Business Phone",
            "email": "Business Email",
            "website": "Business Website",
            "hours": "Business Hours"
        }
    
    # Extract services
    if content_map["services"]:
        logger.debug(f"Extracting services from {len(content_map['services'])} chunks")
        services_chunks = [chunks[i] for i in content_map["services"]]
        # This would call the extractor module to extract services
        # For now, we'll just return a placeholder
        result["services"]["offered"] = [
            {"name": "Service 1", "description": "Service 1 Description"},
            {"name": "Service 2", "description": "Service 2 Description"}
        ]
        result["services"]["specialties"] = [
            {"name": "Specialty 1", "description": "Specialty 1 Description"},
            {"name": "Specialty 2", "description": "Specialty 2 Description"}
        ]
        result["services"]["not_offered"] = [
            {"name": "Not Offered 1", "description": "Not Offered 1 Description"},
            {"name": "Not Offered 2", "description": "Not Offered 2 Description"}
        ]
    
    # Extract reviews
    if content_map["reviews"]:
        logger.debug(f"Extracting reviews from {len(content_map['reviews'])} chunks")
        reviews_chunks = [chunks[i] for i in content_map["reviews"]]
        # This would call the extractor module to extract reviews
        # For now, we'll just return a placeholder
        result["reviews"]["individual_reviews"] = [
            {"author": "Reviewer 1", "rating": 5, "text": "Review 1 Text"},
            {"author": "Reviewer 2", "rating": 4, "text": "Review 2 Text"}
        ]
    
    # Extract customer interaction
    if content_map["customer_interaction"]:
        logger.debug(f"Extracting customer interaction from {len(content_map['customer_interaction'])} chunks")
        customer_interaction_chunks = [chunks[i] for i in content_map["customer_interaction"]]
        # This would call the extractor module to extract customer interaction
        # For now, we'll just return a placeholder
        result["customer_interaction"] = {
            "contact_form": True,
            "chat": False,
            "appointment_booking": True
        }
    
    # Extract media
    if content_map["media"]:
        logger.debug(f"Extracting media from {len(content_map['media'])} chunks")
        media_chunks = [chunks[i] for i in content_map["media"]]
        # This would call the extractor module to extract media
        # For now, we'll just return a placeholder
        result["media"]["gallery_links"] = [
            {"url": "https://example.com/image1.jpg", "alt": "Image 1"},
            {"url": "https://example.com/image2.jpg", "alt": "Image 2"}
        ]
    
    logger.debug("Targeted information extraction complete")
    
    return result

def simple_chunk_text(
    text: str, 
    max_chunk_size: int = 8000, 
    overlap: int = 1000,
    llm: str = DEFAULT_LLM,
    model: str = DEFAULT_MODEL
) -> List[str]:
    """
    Split text into chunks based on token count, preserving line breaks.
    This is a simpler alternative to split_html_into_chunks that doesn't re-parse the HTML,
    which is useful when the text already contains extracted attributes that should be preserved.
    
    Args:
        text: Text to split
        max_chunk_size: Maximum size of each chunk in tokens
        overlap: Number of tokens to overlap between chunks
        llm: The LLM provider to use for token counting
        model: The model name to use for token counting
        
    Returns:
        List of text chunks
    """
    logger = logging.getLogger(__name__)
    logger.debug(f"Simple chunking of text (max size: {max_chunk_size}, overlap: {overlap}, model: {model})")
    
    # Get the appropriate encoding for token counting
    encoding = get_encoding(llm, model)
    
    # Function to count tokens
    def count_tokens(text_to_count):
        return len(encoding.encode(text_to_count))
    
    # Get total token count
    total_tokens = count_tokens(text)
    logger.debug(f"Total tokens in text: {total_tokens}")
    
    # If the text is small enough, return it as a single chunk
    if total_tokens <= max_chunk_size:
        logger.debug("Text fits in a single chunk")
        return [text]
    
    # Split the text by line breaks to preserve natural boundaries
    lines = text.split('\n')
    
    chunks = []
    current_chunk = []
    current_size = 0
    
    for line in lines:
        # Add newline for accurate token counting except for the first line in a chunk
        line_with_newline = line + '\n' if current_chunk else line
        line_tokens = count_tokens(line_with_newline)
        
        # Handle the case where a single line is larger than max_chunk_size
        if line_tokens > max_chunk_size:
            logger.warning(f"Found a line with {line_tokens} tokens, which exceeds max_chunk_size of {max_chunk_size}")
            # If we have content in the current chunk, add it first
            if current_chunk:
                chunk_text = '\n'.join(current_chunk)
                chunks.append(chunk_text)
                current_chunk = []
                current_size = 0
            
            # Split the large line into smaller pieces
            # This is a simple character-based split as a fallback
            char_per_token = 4  # Approximation: 1 token ~= 4 chars
            chars_per_chunk = max_chunk_size * char_per_token
            for i in range(0, len(line), chars_per_chunk):
                line_piece = line[i:i+chars_per_chunk]
                chunks.append(line_piece)
            
            continue
        
        # If adding this line would exceed the max chunk size and we already have content
        if current_size + line_tokens > max_chunk_size and current_chunk:
            # Join the current chunk lines and add to chunks
            chunk_text = '\n'.join(current_chunk)
            chunks.append(chunk_text)
            
            # Start a new chunk with overlap
            overlap_size = 0
            overlap_lines = []
            
            # Go backwards through current chunk to find overlap lines
            for prev_line in reversed(current_chunk):
                prev_line_with_newline = prev_line + '\n'
                prev_line_tokens = count_tokens(prev_line_with_newline)
                
                if overlap_size + prev_line_tokens <= overlap:
                    overlap_lines.insert(0, prev_line)
                    overlap_size += prev_line_tokens
                else:
                    # If we can't fit the whole line, we stop here to avoid partial lines
                    break
            
            # Start new chunk with overlap lines
            current_chunk = overlap_lines.copy()
            current_size = overlap_size
        
        # Add the current line to the chunk
        current_chunk.append(line)
        current_size += line_tokens
    
    # Add the final chunk if it's not empty
    if current_chunk:
        chunks.append('\n'.join(current_chunk))
    
    # Log the actual token counts of each chunk for debugging
    if logger.isEnabledFor(logging.DEBUG):
        for i, chunk in enumerate(chunks):
            chunk_tokens = count_tokens(chunk)
            logger.debug(f"Chunk {i+1}: {chunk_tokens} tokens")
    
    logger.debug(f"Split text into {len(chunks)} chunks")
    return chunks

# Export key functions
__all__ = [
    'get_encoding',
    'get_tokenizer',
    'get_prompt_template_tokens',
    'split_html_into_chunks',
    'merge_chunk_results',
    'discover_information_locations',
    'extract_targeted_information',
    'simple_chunk_text'
]
