import os
import requests
from bs4 import BeautifulSoup
from langchain.text_splitter import RecursiveCharacterTextSplitter
import tiktoken
from datetime import datetime

# ---------------------------
# 1. Load HTML from File or URL
# ---------------------------
def load_html(source, is_url=False):
    """Loads HTML from a file or a URL"""
    if is_url:
        response = requests.get(source)
        response.raise_for_status()
        html_content = response.text
    else:
        with open(source, "r", encoding="utf-8") as file:
            html_content = file.read()
    
    return html_content

# ---------------------------
# 2. Clean & Extract Meaningful HTML Content
# ---------------------------
def parse_html(html):
    """Parses HTML and extracts structured content while preserving headings and sections."""
    soup = BeautifulSoup(html, "lxml")

    # Remove unnecessary elements (scripts, styles, ads, etc.)
    for tag in soup(["script", "style", "noscript", "meta", "iframe"]):
        tag.decompose()

    structured_data = []
    
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li"]):
        text_content = tag.get_text(strip=True)
        if not text_content:
            continue  # Skip empty tags

        structured_data.append({
            "text": text_content,
            "html_tag": tag.name,  # Preserve the HTML tag type
            "section_id": f"section-{len(structured_data)}",  # Unique section ID
        })
    
    return structured_data

# ---------------------------
# 3. Token Counting & Splitting
# ---------------------------
def count_tokens(text, model="gpt-4"):
    """Counts tokens to ensure we stay within LLM input limits."""
    enc = tiktoken.encoding_for_model(model)
    return len(enc.encode(text))

def chunk_text(structured_data, chunk_size=1000, chunk_overlap=100):
    """Splits extracted text into structured chunks with metadata."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""]
    )

    # Prepare text for splitting
    text_blocks = [f"{data['text']}\n" for data in structured_data]
    full_text = "\n".join(text_blocks)
    raw_chunks = text_splitter.split_text(full_text)

    # Attach metadata to chunks
    chunks_with_metadata = []
    for i, chunk in enumerate(raw_chunks):
        chunk_tokens = count_tokens(chunk)
        chunks_with_metadata.append({
            "chunk_id": f"chunk-{i+1}",
            "content": chunk,
            "tokens": chunk_tokens,
            "retrieved_at": datetime.utcnow().isoformat() + "Z",
        })

    return chunks_with_metadata

# ---------------------------
# 4. Process HTML and Return JSON Output
# ---------------------------
def process_html(source, is_url=False):
    """Complete pipeline: load, parse, chunk, and add metadata."""
    html_content = load_html(source, is_url)
    structured_data = parse_html(html_content)
    chunks = chunk_text(structured_data)

    # Attach source metadata
    for chunk in chunks:
        chunk["source"] = source
        chunk["source_type"] = "url" if is_url else "file"

    return chunks
