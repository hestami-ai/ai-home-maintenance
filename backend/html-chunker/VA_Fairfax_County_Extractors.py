from bs4 import BeautifulSoup
import json
from typing import Dict, List, Any, Tuple, Union
import openai  # or whatever LLM library you're using
import argparse
import os
import re
import logging
from google import genai
import ollama
from llama_api_client import LlamaAPIClient

# Initialize logger
logger = logging.getLogger(__name__)

# Configure logging if not already configured
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

class VA_Fairfax_County_LDIP_Data_Processor:
    """
    Process Fairfax County HTML data using hybrid BeautifulSoup + LLM approach.
    """

    def save_to_json(self, data: Union[List[Dict[str, str]], Dict[str, str]], filename: str = "extracted_data.json"):
        """
        Save extracted data to JSON file.
        
        Args:
            data: Extracted data
            filename: Output filename
        """
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Data saved to {filename}")

    
    def __init__(self):
        """
        Initialize the processor with LLM configuration from environment variables.
        """
        self.llm_provider = os.getenv('HTML_CHUNKER_LLM_PROVIDER', 'google').lower()
        logger.info(f"Using LLM Provider: {self.llm_provider}")
        self.llm_api_key = os.getenv('HTML_CHUNKER_LLM_API_KEY')
        if not self.llm_api_key:
            logger.warning(f"HTML_CHUNKER_LLM_API_KEY not found for provider {self.llm_provider}.")
        else:
            logger.info(f"API Key found for {self.llm_provider}.")
        self.llm_endpoint_url = os.getenv('HTML_CHUNKER_LLM_ENDPOINT_URL')
        default_models = {
            'google': 'gemini-1.5-flash-latest',
            'openai': 'gpt-3.5-turbo',
            'ollama': 'qwen3:4b-q4_K_M',  # Default model for Ollama, can be overridden by env var
            'llama': 'llama-3-8b-instruct'  # Default model for Meta's Llama API
        }
        default_model_for_provider = default_models.get(self.llm_provider, 'unknown_model')
        self.llm_model = os.getenv('HTML_CHUNKER_LLM_MODEL', default_model_for_provider)
        logger.info(f"Using LLM Model: {self.llm_model}")

        self.config = {
            "llm_model": self.llm_model,
            "llm_temperature": 0.1,
            "llm_max_tokens": 2048,
            "extraction_fields": [
                "Tax Map", "Address", "Record Type", "Application Number", "Status",
                "Date Submitted", "Date Issued", "Date Closed", "Description",
                "Owner Name", "Owner Address", "Contractor Name", "Contractor Address",
                "Valuation", "Permit Type", "Jurisdiction", "Parcel ID", "Legal Description"
            ]
        }

        self.llm_client = None
        self._initialize_llm_client()

        if not self.llm_api_key:
            logger.warning("HTML_CHUNKER_LLM_API_KEY not provided. Falling back to regex extraction for some fields.")

    def _initialize_llm_client(self):
        """
        Initializes the appropriate LLM client based on the configured provider.
        """
        if self.llm_provider == 'openai':
            if self.llm_api_key:
                openai.api_key = self.llm_api_key
                if self.llm_endpoint_url:
                    openai.base_url = self.llm_endpoint_url
                self.llm_client = openai.ChatCompletion
            else:
                logger.warning("OpenAI API key not provided. OpenAI client not initialized.")
                self.llm_client = None
        elif self.llm_provider == 'google':
            if self.llm_api_key:
                self.llm_client = genai.Client(api_key=self.llm_api_key)
            else:
                logger.warning("Google API key not provided. Google client not initialized.")
                self.llm_client = None
        elif self.llm_provider == 'anthropic':
            logger.info(f"LLM Provider '{self.llm_provider}' not fully implemented yet.")
            self.llm_client = None
        elif self.llm_provider == 'llama':
            if self.llm_api_key:
                # Initialize Meta's Llama API client
                logger.info(f"Initializing Llama API client with model: {self.llm_model}")
                try:
                    # Use custom endpoint URL if provided, otherwise use default
                    if self.llm_endpoint_url:
                        self.llm_client = LlamaAPIClient(api_key=self.llm_api_key, base_url=self.llm_endpoint_url)
                    else:
                        self.llm_client = LlamaAPIClient(api_key=self.llm_api_key)
                    logger.info(f"Llama API client initialized successfully for model: {self.llm_model}")
                except Exception as e:
                    logger.error(f"Failed to initialize Llama API client: {e}", exc_info=True)
                    self.llm_client = None
            else:
                logger.warning("Llama API key not provided. Llama client not initialized.")
                self.llm_client = None
        elif self.llm_provider == 'ollama':
            ollama_host = self.llm_endpoint_url if self.llm_endpoint_url else 'http://ollama:11434'
            logger.info(f"Initializing Ollama client with host: {ollama_host} and model: {self.llm_model}")
            try:
                self.llm_client = ollama.Client(host=ollama_host)
                # Optional: Test connection, e.g., by listing models. This can be slow.
                # self.llm_client.list()
                logger.info(f"Ollama client initialized successfully for model: {self.llm_model}")
            except Exception as e:
                logger.error(f"Failed to initialize Ollama client at {ollama_host}: {e}", exc_info=True)
                self.llm_client = None
        elif self.llm_provider == 'azure':
            logger.info(f"LLM Provider '{self.llm_provider}' not fully implemented yet.")
            self.llm_client = None
        else:
            logger.warning(f"Unsupported LLM Provider: {self.llm_provider}. No LLM client initialized.")
            self.llm_client = None

    def _call_llm_api(self, prompt: str) -> str:  # Ensure return type is str
        """
        Makes a call to the configured LLM API.
        Returns the text response from the LLM.
        """
        if self.llm_provider == 'openai':
            messages = [
                {"role": "system", "content": "You are a data extraction assistant. Extract field names and values from text and return valid JSON."},
                {"role": "user", "content": prompt}
            ]
            try:
                response = self.llm_client.create(
                    model=self.llm_model,
                    messages=messages,
                    temperature=self.config["llm_temperature"],
                    max_tokens=self.config["llm_max_tokens"]
                )
                return response.choices[0].message.content
            except Exception as e:
                logger.error(f"OpenAI API call failed: {e}", exc_info=True)
                raise
        elif self.llm_provider == 'google':
            try:
                # For Google's genai, the 'contents' arg can be the prompt string directly for text models
                response = self.llm_client.models.generate_content(model=self.llm_model, contents=prompt)
                return response.text
            except Exception as e:
                logger.error(f"Google GenAI API call failed: {e}", exc_info=True)
                raise
        elif self.llm_provider == 'llama':
            messages = [
                {"role": "system", "content": "You are a data extraction assistant. Extract field names and values from text and return valid JSON."},
                {"role": "user", "content": prompt}
            ]
            try:
                logger.debug(f"Llama API generate model: {self.llm_model}, prompt (first 200 chars): {prompt[:200]}...")
                response = self.llm_client.chat.completions.create(
                    model=self.llm_model,
                    messages=messages,
                    temperature=self.config.get("llm_temperature", 0.1),
                    max_tokens=self.config.get("llm_max_tokens", 2048)
                )
                # Extract the completion message from the response
                return response.completion_message.content
            except Exception as e:
                logger.error(f"Llama API call failed: {e}", exc_info=True)
                raise
        elif self.llm_provider == 'ollama':
            # Ollama's generate method takes the full prompt directly.
            # The system message is part of the prompt itself for some Ollama model interaction patterns.
            # However, the _create_extraction_prompt already includes detailed instructions.
            logger.debug(f"Ollama generate model: {self.llm_model}, prompt (first 200 chars): {prompt[:200]}...")
            try:
                response = self.llm_client.generate(
                    model=self.llm_model,
                    prompt=prompt, # Using the prompt from _create_extraction_prompt directly
                    options={
                        "temperature": self.config.get("llm_temperature", 0.1),
                        "num_predict": self.config.get("llm_max_tokens", 2048) # Max tokens for Ollama
                    }
                )
                # response is a dict like {'model': '...', 'created_at': '...', 'response': '...', ...}
                if 'response' in response and response['response']:
                    return response['response']
                else:
                    logger.error(f"Ollama API response missing 'response' key or empty: {response}")
                    # Consider raising an error or returning empty string to trigger fallback
                    raise ValueError("Ollama response malformed or empty") 
            except Exception as e:
                logger.error(f"Ollama API call failed: {e}", exc_info=True)
                raise # Re-raise the exception to be caught by extract_fields_with_llm
        else:
            logger.error(f"API call for LLM Provider '{self.llm_provider}' not implemented.")
            raise NotImplementedError(f"API call for LLM Provider '{self.llm_provider}' not implemented.")

    def extract_search_results(self, html_content: str) -> Union[List[Dict[str, str]], Dict[str, str]]:
        """
        Extract search results from Fairfax County Land Development HTML page.
        
        Args:
            html_content: HTML content as string
            
        Returns:
            List of dictionaries containing extracted data, or error message dict
        """
        # Parse HTML
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Find the searchResults div
        search_results_div = soup.find('div', {'id': 'searchResults'})
        
        if not search_results_div:
            return {"error": "No search results section found"}
        
        # Find the results table
        results_table = search_results_div.find('table', {'id': 'results'})
        
        if not results_table:
            return {"error": "No results table found"}
        
        # Find all rows with class 'searchresult'
        result_rows = results_table.find_all('tr', class_='searchresult')
        
        if not result_rows:
            return {"message": "No results found"}
        
        # Extract data from each row
        extracted_data = []
        
        for row in result_rows:
            try:
                # Find all td elements
                cells = row.find_all('td')
                
                if len(cells) >= 4:  # Expecting at least 4 columns
                    # Extract row ID
                    row_id = cells[0].get_text(strip=True)
                    
                    # Extract record info
                    record_cell = cells[1]
                    record_link = record_cell.find('a')
                    record_text = record_link.get_text(strip=True) if record_link else ""
                    record_url = record_link.get('href', '') if record_link else ""
                    
                    # Extract snippet information (Tax Map and Address)
                    snippet_div = record_cell.find('div', class_='snippet')
                    tax_map = ""
                    address = ""
                    
                    if snippet_div:
                        # Look for tax map
                        divs = snippet_div.find_all('div')
                        for i, div in enumerate(divs):
                            if div.get_text(strip=True) == "Tax Map:" and i + 1 < len(divs):
                                tax_map = divs[i + 1].get_text(strip=True)
                            elif div.get_text(strip=True) == "Address:" and i + 1 < len(divs):
                                address = divs[i + 1].get_text(strip=True)
                    
                    # Extract status
                    status = cells[2].get_text(strip=True)
                    
                    # Extract date
                    date = cells[3].get_text(strip=True)
                    
                    # Extract raw snippet text, preserving line structure for LLM
                    snippet_lines = []
                    if snippet_div:
                        current_label = None  # Stores text from 'left' div
                        for child in snippet_div.children:
                            if child.name == 'div':
                                child_text = child.get_text(strip=True)
                                classes = child.get('class', [])

                                # Skip empty divs unless it's a 'clear' div, which acts as a separator
                                if not child_text and 'clear' not in classes:
                                    continue

                                if 'left' in classes:
                                    if current_label:  # A left was followed by another left (no right/clear)
                                        snippet_lines.append(current_label)
                                    current_label = child_text.rstrip(':') if child_text else ""
                                elif 'right' in classes:
                                    if current_label:
                                        snippet_lines.append(f"{current_label}: {child_text}")
                                        current_label = None
                                    elif child_text:  # A right without a preceding left
                                        snippet_lines.append(child_text)
                                elif 'clear' in classes:
                                    if current_label:  # A left was not followed by a right, but by clear
                                        snippet_lines.append(current_label)
                                        current_label = None
                                    # 'clear' div itself doesn't add text but ensures separation for the next line
                                elif child_text:  # An 'other' div with text (not left, right, or clear)
                                    if current_label:  # If there was a pending label, print it first
                                        snippet_lines.append(current_label)
                                        current_label = None
                                    snippet_lines.append(child_text)
                        
                        if current_label:  # If loop ends and there's a pending label
                            snippet_lines.append(current_label)
                
                    # Join non-empty lines
                    snippet_raw_text = "\n".join(line for line in snippet_lines if line).strip()

                    # Create record dictionary
                    record_dict = {
                        "id": row_id,
                        "record": record_text,
                        "record_url": record_url,
                        "status": status,
                        "date": date,
                        "tax_map": tax_map,
                        "address": address,
                        "snippet_raw_text": snippet_raw_text,
                        "_extraction_metadata": {
                            "id": "beautifulsoup",
                            "record": "beautifulsoup",
                            "record_url": "beautifulsoup",
                            "status": "beautifulsoup",
                            "date": "beautifulsoup",
                            "tax_map": "beautifulsoup",
                            "address": "beautifulsoup",
                            "snippet_raw_text": "beautifulsoup"
                        }
                    }
                    
                    extracted_data.append(record_dict)
                    
            except Exception as e:
                logger.error(f"Error processing row: {str(e)}")
                continue
        
        return extracted_data
    
    def normalize_field_name(self, field_name: str) -> str:
        """
        Normalize field names to lowercase with underscores.
        
        Args:
            field_name: Original field name (e.g., "Tax Map", "Building Use Code")
            
        Returns:
            Normalized field name (e.g., "tax_map", "building_use_code")
        """
        # Convert to lowercase and replace spaces with underscores
        normalized = field_name.lower().replace(' ', '_')
        # Remove any special characters except underscores
        normalized = re.sub(r'[^a-z0-9_]', '', normalized)
        return normalized
    
    def extract_fields_with_llm(self, snippet_text: str) -> Tuple[Dict[str, str], str]:
        """
        Use LLM to extract fields from unstructured snippet text.
        
        Args:
            snippet_text: Raw text from HTML snippet
            
        Returns:
            Tuple of (Dictionary of extracted fields with normalized keys, extraction method)
        """
        if not self.llm_client:
            # Fallback to regex-based extraction if no LLM client is initialized
            fields = self._regex_fallback_extraction(snippet_text)
            return fields, 'regex'
        
        prompt = self._create_extraction_prompt(snippet_text)
        
        try:
            result_text = self._call_llm_api(prompt)
            logger.debug(f"LLM ({self.llm_provider}) raw result_text (length: {len(result_text)}):\n{result_text[:1000]}...") # Log first 1000 chars

            # Remove <think>...</think> block if present
            cleaned_result_text = re.sub(r'<think>.*?</think>', '', result_text, flags=re.DOTALL).strip()
            if len(cleaned_result_text) < len(result_text):
                logger.debug(f"LLM ({self.llm_provider}) result_text after removing <think> block (length: {len(cleaned_result_text)}):\n{cleaned_result_text[:1000]}...")
            else:
                logger.debug(f"LLM ({self.llm_provider}) no <think> block found to remove.")
            
            # Try to extract JSON from the (potentially cleaned) response
            json_match = re.search(r'\{.*\}', cleaned_result_text, re.DOTALL)
            if json_match:
                json_string_to_parse = json_match.group()
                logger.debug(f"LLM ({self.llm_provider}) json_string_to_parse:\n{json_string_to_parse}")
                raw_fields = json.loads(json_string_to_parse)
                # Normalize all field names
                normalized_fields = {}
                for key, value in raw_fields.items():
                    normalized_key = self.normalize_field_name(key)
                    normalized_fields[normalized_key] = value
                return normalized_fields, 'llm'
            else:
                return {}, 'llm'
                
        except Exception as e:
            logger.error(f"LLM extraction failed for provider {self.llm_provider}: {str(e)}")
            fields = self._regex_fallback_extraction(snippet_text)
            return fields, 'regex'
    
    def _create_extraction_prompt(self, snippet_text: str) -> str:
        """
        Create a detailed prompt for field extraction.
        
        Args:
            snippet_text: Raw text to process
            
        Returns:
            Formatted prompt
        """
        prompt = f"""Extract ALL field names and their values from the following text.
        
Text to analyze:
{snippet_text}

Rules:
1. Field names usually end with a colon (:)
2. Values come after the field name
3. Preserve the exact field names as they appear
4. For fields like "Building Use Code", include both the description and code in parentheses
5. Return ONLY valid JSON with field names as keys

Example output format:
{{
    "Tax Map": "045-3 ((03)) 0591",
    "Building Use Code": "Single-Family, Detached Or Semi-Detached (010)",
    "Address": "013511 GRANITE ROCK DR",
    "Type Work Code": "Deck Only-Residential (A33)"
}}

Return the extracted fields as JSON:"""
        
        return prompt
    
    def _regex_fallback_extraction(self, snippet_text: str) -> Dict[str, str]:
        """
        Fallback extraction using regex patterns when LLM is not available.
        
        Args:
            snippet_text: Raw text to process
            
        Returns:
            Dictionary of extracted fields with normalized names
        """
        fields = {}
        
        # Split by common patterns
        # Pattern 1: "Field Name: Value" on same line
        pattern1 = r'([^:]+):\s*([^:]+?)(?=\s*[A-Z][^:]*:|$)'
        matches1 = re.findall(pattern1, snippet_text)
        
        for field, value in matches1:
            field = field.strip()
            value = value.strip()
            if field and value and not any(skip in field.lower() for skip in ['clear', 'left', 'right']):
                normalized_field = self.normalize_field_name(field)
                fields[normalized_field] = value
        
        # Pattern 2: Handle multiline format where field and value are separated
        lines = snippet_text.split()
        i = 0
        while i < len(lines):
            if lines[i].endswith(':'):
                field = lines[i].rstrip(':')
                # Look for the value in the next elements
                value_parts = []
                j = i + 1
                while j < len(lines) and not lines[j].endswith(':'):
                    value_parts.append(lines[j])
                    j += 1
                if value_parts:
                    value = ' '.join(value_parts)
                    normalized_field = self.normalize_field_name(field)
                    if normalized_field not in fields:  # Don't override if already found
                        fields[normalized_field] = value
                i = j
            else:
                i += 1
        
        return fields
    
    def process_search_results_with_llm(self, raw_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Process raw search results with LLM enhancement.
        
        Args:
            raw_results: Results from BeautifulSoup extraction
            
        Returns:
            Enhanced results with LLM-extracted fields and metadata
        """
        processed_results = []
        
        for i, record in enumerate(raw_results):
            logger.info(f"Processing record {i + 1}/{len(raw_results)}...")
            
            # Start with a copy of the record from BeautifulSoup extraction.
            # This includes all fields (id, record, tax_map, address, snippet_raw_text, etc.)
            # and the initial _extraction_metadata set by extract_search_results.
            enhanced_record = record.copy()
            
            # Get a mutable copy of the metadata from the enhanced_record.
            # This metadata already contains "beautifulsoup" entries for relevant fields.
            metadata = enhanced_record.get('_extraction_metadata', {}).copy()
            
            # Get the raw snippet text from the working record
            snippet_text = enhanced_record.get('snippet_raw_text', '')

            if snippet_text:
                # Extract fields using LLM or fallback
                llm_fields, extraction_method = self.extract_fields_with_llm(snippet_text)
                
                # Add new fields and update metadata
                logger.debug(f"Processing LLM fields for record ID: {record.get('id', 'Unknown')}")
                for field_name, field_value in llm_fields.items():
                    is_new_field = field_name not in enhanced_record
                    # Only add if not already present (BeautifulSoup has priority)
                    if is_new_field:
                        enhanced_record[field_name] = field_value
                        metadata[field_name] = extraction_method
                    else:
                        logger.debug(f"Field '{field_name}' already in enhanced_record. Value: '{enhanced_record.get(field_name)}'. Not overwriting with LLM value: '{field_value}'")
            
            # Add the complete metadata (potentially updated by LLM processing)
            enhanced_record['_extraction_metadata'] = metadata
            
            processed_results.append(enhanced_record)
        
        return processed_results

    def create_summary_report(self, processed_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create a summary report of the processed results.
        
        Args:
            processed_results: Processed results with extracted fields
            
        Returns:
            Summary report
        """
        # Collect all unique field names
        all_fields = set()
        for record in processed_results:
            all_fields.update(k for k in record.keys() if not k.startswith('_'))
        
        # Count field occurrences
        field_counts = {}
        for field in all_fields:
            count = sum(1 for record in processed_results if field in record)
            field_counts[field] = count
        
        # Group by record type
        record_types = {}
        for record in processed_results:
            record_type = record.get('record', '').split(' - ')[0]
            if record_type not in record_types:
                record_types[record_type] = 0
            record_types[record_type] += 1
        
        summary = {
            "total_records": len(processed_results),
            "fields_found": sorted(list(all_fields)),
            "field_frequency": field_counts,
            "record_types": record_types,
            "date_range": self._get_date_range(processed_results)
        }
        
        return summary
    
    def _get_date_range(self, records: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Get the date range from records.
        
        Args:
            records: List of records
            
        Returns:
            Dictionary with earliest and latest dates
        """
        dates = []
        for record in records:
            date_str = record.get('date', '')
            # Extract date part (e.g., "2013-02-01" from "Issued: 2013-02-01")
            date_match = re.search(r'\d{4}-\d{2}-\d{2}', date_str)
            if date_match:
                dates.append(date_match.group())
        
        if dates:
            dates.sort()
            return {
                "earliest": dates[0],
                "latest": dates[-1]
            }
        return {"earliest": "N/A", "latest": "N/A"}


# Example usage
def extract_LDIP_fairfax_county_data_from_html(html_content: str) -> List[Dict[str, Any]]:
    """
    Extracts and processes data from Fairfax County LDIP HTML content.

    Args:
        html_content: The HTML content as a string.

    Returns:
        A list of dictionaries, where each dictionary represents a processed record.
        Returns an empty list if extraction or processing fails.
    """
    # Initialize processor. LLM configuration is handled via environment variables.
    processor = VA_Fairfax_County_LDIP_Data_Processor()

    # Step 1: Extract raw data using the class method
    raw_results = processor.extract_search_results(html_content)
    
    if isinstance(raw_results, dict) and ('error' in raw_results or 'message' in raw_results):
        logger.error(f"Extraction failed during raw extraction: {raw_results}")
        return []
    
    if not raw_results: # Handles empty list from no results found or other non-error empty cases
        logger.info("No raw results to process after initial extraction.")
        return []

    # Step 2: Process with LLM
    processed_results = processor.process_search_results_with_llm(raw_results)
    
    return processed_results

def main():
    """
    Main function to demonstrate usage: reads an HTML file, processes it,
    saves the results and a summary.
    """
    parser = argparse.ArgumentParser(description="Process Fairfax County LDIP HTML data.")
    parser.add_argument('-f', '--file', dest='html_file', type=str, required=True, help="Path to the input HTML file.")
    parser.add_argument(
        '-l', '--loglevel',
        dest='loglevel',
        type=str.upper,
        default='INFO',
        choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        help="Set the logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL). Default: INFO"
    )
    args = parser.parse_args()

    # Configure logging based on command-line argument
    numeric_level = getattr(logging, args.loglevel, None)
    if not isinstance(numeric_level, int):
        raise ValueError(f'Invalid log level: {args.loglevel}')
    logging.basicConfig(level=numeric_level, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    logger.info(f"Logging level set to {args.loglevel}.")

    # Read HTML file
    try:
        with open(args.html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
    except FileNotFoundError:
        logger.error(f"HTML file not found: {args.html_file}")
        return
    
    # Use the new function to get processed data
    processed_data = extract_LDIP_fairfax_county_data_from_html(html_content)

    if not processed_data:
        logger.warning("No data was processed by extract_LDIP_fairfax_county_data_from_html. Exiting main.")
        return

    # Initialize processor again for saving and summary. 
    # This is acceptable as processor state is minimal for these actions.
    processor = VA_Fairfax_County_LDIP_Data_Processor()
    
    # Save processed results
    processor.save_to_json(processed_data, 'processed_results.json')
    logger.info(f"Processed data saved to processed_results.json") # Changed to logger for consistency if run as script
    print(f"Processed data saved to processed_results.json") # Keep print for CLI visibility
    
    # Generate summary
    summary = processor.create_summary_report(processed_data)
    
    print("\n=== SUMMARY ===")
    print(f"Total records: {summary['total_records']}")
    print(f"Date range: {summary['date_range']['earliest']} to {summary['date_range']['latest']}")
    print(f"\nRecord types found:")
    for record_type, count in summary['record_types'].items():
        print(f"  - {record_type}: {count}")
    print(f"\nUnique fields found: {len(summary['fields_found'])}")
    print("Fields:", ', '.join(summary['fields_found']))
    
    # Save summary
    processor.save_to_json(summary, 'extraction_summary.json')
    logger.info(f"Extraction summary saved to extraction_summary.json") # Changed to logger
    print(f"Extraction summary saved to extraction_summary.json") # Keep print for CLI visibility


if __name__ == "__main__":
    main()