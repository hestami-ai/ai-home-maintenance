#!/usr/bin/env python
"""
CLI interface for HTML chunking and extraction using remote LLMs.
"""
import argparse
import json
import os
import sys
import logging
import time
from extractor import process_html_file, LLM_PROVIDERS, DEFAULT_LLM, DEFAULT_MODEL

def main():
    """Main entry point for the CLI application."""
    parser = argparse.ArgumentParser(description="Extract structured information from HTML files using remote LLMs")
    
    parser.add_argument("--mode", choices=["cli", "api"], default="cli",
                        help="Mode of operation: cli for command line, api for web service")
    
    parser.add_argument("--llm", choices=LLM_PROVIDERS, default=DEFAULT_LLM,
                        help=f"LLM provider to use. Available options: {', '.join(LLM_PROVIDERS)}")
    
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL,
                        help="Model name to use with the LLM provider")
    
    parser.add_argument("--input", type=str, required=True,
                        help="Path to the input HTML file")
    
    parser.add_argument("--output", type=str, required=True,
                        help="Path to save the output JSON file")
    
    parser.add_argument("--text-input", type=str,
                        help="Optional path to a raw text file to use as a cross-check for extraction")
    
    parser.add_argument("--max-tokens", type=int, default=2048,
                        help="Maximum tokens per chunk (default: 2048)")
    
    parser.add_argument("--overlap-percent", type=float, default=0.1,
                        help="Percentage of overlap between chunks (0.0 to 1.0, default: 0.1 or 10%)")
    
    parser.add_argument("--api-key", type=str,
                        help="API key for providers that require it (e.g., OpenAI, Cerebras)")
    
    parser.add_argument("--show-token-counts", action="store_true",
                        help="Display token counts for the HTML content and each chunk")
    
    parser.add_argument("--log-level", choices=['CRITICAL', 'ERROR', 'WARNING', 'INFO', 'DEBUG'], default='INFO',
                        help="Set the logging level (CRITICAL, ERROR, WARNING, INFO, DEBUG)")
    
    args = parser.parse_args()
    
    # Configure logging
    log_level = getattr(logging, args.log_level)
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Create a logger for this module
    logger = logging.getLogger(__name__)
    
    # Check if we should run in API mode
    if args.mode == "api":
        logger.info("Starting API server...")
        # Import here to avoid dependency if only using CLI
        from api import start_api
        start_api()
        return
    
    # Validate input file
    if not os.path.isfile(args.input):
        logger.error(f"Input file '{args.input}' does not exist or is not a file")
        sys.exit(1)
    
    # Check if text input file is provided and valid
    text_content = None
    if args.text_input:
        if not os.path.isfile(args.text_input):
            logger.error(f"Text input file '{args.text_input}' does not exist or is not a file")
            sys.exit(1)
        try:
            with open(args.text_input, 'r', encoding='utf-8') as f:
                text_content = f.read()
            logger.info(f"Loaded raw text content from '{args.text_input}' for cross-checking")
        except Exception as e:
            logger.error(f"Error reading text input file: {str(e)}")
            sys.exit(1)
    
    # Process the HTML file
    try:
        extracted_data = process_html_file(
            html_file=args.input,
            output_file=args.output,
            llm=args.llm,
            model=args.model,
            api_key=args.api_key,
            overlap_percent=args.overlap_percent,
            max_tokens=args.max_tokens,
            show_token_counts=args.show_token_counts,
            text_content=text_content
        )
                
    except Exception as e:
        logger.error(f"Error during extraction: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    main()
