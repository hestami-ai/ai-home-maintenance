"""
HTML preprocessing module for cleaning and preparing HTML content for extraction.
"""
import re
import json
import logging
from typing import List, Optional, Dict, Any
from bs4 import BeautifulSoup
import html2text

# Create a module-level logger
logger = logging.getLogger(__name__)

def preprocess_html(html_content: str) -> str:
    """
    Pre-process HTML content to remove specific attributes that may add noise to the extraction process.
    
    Args:
        html_content: Raw HTML content as string
        
    Returns:
        Cleaned HTML content with specified attributes removed
    """
    logger.debug("Starting HTML preprocessing")

    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove spans with class "m_dn" containing "Hired on Thumbtack" text
    for span in soup.find_all('span', class_='m_dn'):
        p_tag = span.find('p')
        if p_tag and 'Hired on Thumbtack' in p_tag.text:
            span.decompose()

    # Remove SVG and path elements
    for svg in soup.find_all('svg'): svg.decompose()
    for path in soup.find_all('path'): path.decompose()

    # Remove style tags containing specific CSS content - Bing Maps
    for style in soup.find_all('style'):
        if style.string and '.csrc{display:inline-block}' in style.string:
            style.decompose()
    
    # Remove xmlns attributes from svg tags
    #for tag in soup.find_all('svg', attrs={'xmlns': True}):
    #    del tag['xmlns']
    # Remove script elements
    for script in soup.find_all('script'): script.decompose()

    # Remove class attributes from all elements, except for 'strike' class
    for tag in soup.find_all(True):
        if tag.has_attr('class'):
            # Check if 'strike' is in the class list
            classes = tag.get('class', [])
            if 'strike' in classes:
                # Keep only the 'strike' class
                tag['class'] = ['strike']
            else:
                # Remove class attribute completely
                del tag['class']
    
    # Remove srcset attributes from all elements
    for tag in soup.find_all(attrs={'srcset': True}):
        del tag['srcset']
    
    # Remove href attributes from all elements
    for tag in soup.find_all(attrs={'href': True}):
        del tag['href']
    
    # Remove src attributes from img tags
    for tag in soup.find_all('img', attrs={'src': True}):
        del tag['src']

    processed_html = str(soup)

    logger.info(f"Original HTML length: {len(html_content)} characters")
    logger.info(f"Preprocessed HTML length: {len(processed_html)} characters")
    logger.debug(f"Full preprocessed HTML:")
    logger.debug(f"{processed_html}")

    logger.debug("HTML preprocessing complete")

    return processed_html



def extract_with_html2text(html_content: str) -> str:
    """
    Extract text from HTML using html2text library.
    
    Args:
        html_content: Raw HTML content as string
        
    Returns:
        Extracted text content
    """
    logger.debug("Using html2text for extraction")
    
    # Configure html2text
    h = html2text.HTML2Text()
    h.ignore_links = True  # Ignore links to avoid URL clutter
    h.ignore_images = True  # Ignore image references
    h.ignore_emphasis = True  # Ignore emphasis markers like * and _
    h.ignore_tables = False  # Keep tables as they often contain important data
    h.body_width = 0  # No wrapping
    h.unicode_snob = True  # Use Unicode instead of ASCII
    h.single_line_break = True  # Convert multiple line breaks to a single one
    h.skip_internal_links = True  # Skip internal document links
    h.inline_links = False  # Don't show links inline
    h.protect_links = False  # Don't protect links from changes
    
    # Extract text
    extracted_text = h.handle(html_content)
    
    # Clean up the text
    # Remove any remaining markdown-style links [text](url)
    extracted_text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', extracted_text)
    
    # Remove any remaining image references
    extracted_text = re.sub(r'!\[[^\]]*\]\([^)]+\)', '', extracted_text)
    
    # Remove excessive newlines
    extracted_text = re.sub(r'\n{3,}', '\n\n', extracted_text)
    
    # Remove any remaining HTML tags
    extracted_text = re.sub(r'<[^>]+>', '', extracted_text)
    
    # Remove any remaining URL references
    extracted_text = re.sub(r'https?://\S+', '', extracted_text)
    
    # Remove any markdown-style headers (# Header)
    extracted_text = re.sub(r'^\s*#+\s+', '', extracted_text, flags=re.MULTILINE)
    
    # Remove any remaining markdown formatting characters
    extracted_text = re.sub(r'[*_~`]', '', extracted_text)
    
    # Remove lines that are just dashes, equals signs, or other separator characters
    extracted_text = re.sub(r'^\s*[-=_*]{3,}\s*$', '', extracted_text, flags=re.MULTILINE)
    
    # Consolidate multiple spaces
    extracted_text = re.sub(r' +', ' ', extracted_text)
    
    
    logger.debug(f"Raw text extraction completed")
    logger.debug(f"Extracted text length: {len(extracted_text)} characters")
    logger.debug(f"Full extracted text:")
    logger.debug(f"{extracted_text}")
    logger.debug("Text extraction complete")
    
    return extracted_text


def is_html_content(content: str) -> bool:
    """
    Check if the content is HTML using BeautifulSoup.
    
    Args:
        content: The content to check
        
    Returns:
        True if the content appears to be HTML, False otherwise
    """
    try:
        # Parse the content with BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        
        # Check if there are any HTML tags
        html_tags = ['html', 'body', 'div', 'span', 'p', 'a', 'img', 'table', 'form', 'script', 'style', 'head']
        
        # First check for doctype declaration
        if content.lower().strip().startswith('<!doctype html'):
            logger.debug("Content appears to be HTML (has DOCTYPE declaration)")
            return True
            
        # Check for html tag
        if soup.find('html'):
            logger.debug("Content appears to be HTML (has <html> tag)")
            return True
            
        # Check for other common HTML tags
        for tag in html_tags:
            if soup.find(tag):
                logger.debug(f"Content appears to be HTML (has <{tag}> tag)")
                return True
                
        # Check for a significant number of tags overall
        all_tags = soup.find_all(True)
        if len(all_tags) > 5:  # If there are more than 5 tags, it's likely HTML
            logger.debug(f"Content appears to be HTML (has {len(all_tags)} tags)")
            return True
            
        logger.debug("Content appears to be plain text (no HTML tags found)")
        return False
    except Exception as e:
        logger.warning(f"Error checking if content is HTML: {str(e)}")
        # If there's an error parsing, it's likely not valid HTML
        return False


# Export key functions
__all__ = [
    'preprocess_html',
    'extract_with_html2text',
    'is_html_content'
]