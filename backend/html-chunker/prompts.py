"""
Centralized prompt templates for HTML extraction.
"""
import logging

# Create a module-level logger
logger = logging.getLogger(__name__)

# Introduction section
EXTRACTION_INTRODUCTION = """
You are an AI assistant tasked with extracting structured data from HTML content according to a predefined schema.
"""

# Extraction rules section
EXTRACTION_RULES = """
### **Extraction Rules:**
- **Strictly adhere to the provided JSON schema** (see schema section).
- **Use `null` for missing values** instead of empty strings or `undefined`.
- **Remove redundant information** and consolidate repetitive text.
- **Extract key information from attributes**, such as `data-star` for ratings.
- **Identify alternative terms for key fields**, such as:
  - "awards" may be labeled as 'recognitions', 'honors', 'top', 'certified', etc.
  - "business name" may be under "brand," "company name," "title."
- **Extract numbers properly**:
  - Convert "5 years in business" to `5`.
  - Convert "100+ employees" to `100` (omit `+` for simplicity).
- **Preserve only relevant information** while ignoring decorative or promotional content.
"""

# Schema overview section
SCHEMA_OVERVIEW = """
### **Expected Output Structure:**

- `business_info`: Name, description, years in business, employees, service areas, business hours, contact details, social media, licenses, background check, awards.
- `services`: Offered, specialties, not offered.
- `reviews`: Ratings, total reviews, distribution, keywords, and individual reviews.
- `customer_interaction`: Onboarding, pricing, communication style.
- `media`: Photos, gallery links.
"""

# HTML parsing guidelines
HTML_PARSING_GUIDELINES = """
### **HTML Content Parsing Guidelines:**
- Some sources have ratings in HTML attributes on div elements in the particular review like `data-star` and `aria-label` attributes.
- **Use the preprocessed HTML** for extraction.

### **Cross-Checking with attached Raw Text Guidelines:**
- Your primary source of truth is the HTML structure and attributes.
- Use raw text extraction section only as a secondary verification method to increase confidence in extracted values.
- Not all data can be verified via raw text, as raw text does not include HTML attributes like:
  - Review ratings, extracted from data-star and aria-label attributes.
  - Service offerings and specialities, which may rely on strike or strikethrough tags to indicate unavailable services.
- For each field, cross-check with raw text only when applicable, but default to HTML as the authoritative source.
"""

# Output format requirements
OUTPUT_FORMAT_REQUIREMENTS = """
### **Output Format Requirements:**
- The output **must be a valid JSON object** strictly following the provided schema.
- **Do not include** comments, explanations, or redundant phrases.
- **Avoid trailing commas** in JSON arrays or objects.
- Ensure that all string values are **trimmed and free of extra whitespace**.
- Use `null` where data is unavailable.
- **Do not infer information** beyond what is explicitly stated in the HTML.
- **Use consistent casing and formatting** for extracted text.
"""

# Example JSON output
EXAMPLE_JSON_OUTPUT = ""


# This is causing it to hallucinate fields it doesn't have answers for.
"""
### **Example JSON Output:**
```json
{
  "business_info": {
    "name": "JNB Specialty Contracting",
    "description": "Roofing services specializing in insurance claims and high-quality workmanship.",
    "years_in_business": 5,
    "employees": 10,
    "service_areas": ["Virginia", "Maryland", "Washington D.C."],
    "business_hours": {
      "Monday": "8 AM - 6 PM",
      "Tuesday": "8 AM - 6 PM",
      "Sunday": "Closed"
    },
    "contact_information": {
      "website": "https://www.example.com",
      "phone": "(123) 456-7890",
      "address": "123 Main Street, Springfield, VA"
    },
    "social_media": ["facebook.com/example", "instagram.com/example"],
    "license": {
      "type": "HIC – Contractor – Home Improvement",
      "number": "2705189619",
      "holder": "Bryan Hernandez",
      "verified_on": "2024-02-01",
      "valid_until": "2026-01-31"
    },
    "background_check": true,
    "awards": [
      {
        "name": "Top Roofer Award",
        "year": 2023,
        "description": "Awarded by XYZ organization."
      }
    ]
  },
  "reviews": {
    "overall_rating": 5.0,
    "total_reviews": 25,
    "rating_distribution": {
      "5_star": 80,
      "4_star": 10,
      "3_star": 5,
      "2_star": 3,
      "1_star": 2
    },
    "review_keywords": ["fast service", "great communication", "insurance assistance"],
    "individual_reviews": [
      {
        "reviewer": "David Q.",
        "rating": 5,
        "date": "2024-04-15",
        "platform": "Thumbtack",
        "review_text": "Bryan did a great job handling my insurance claim and repairing my roof. Highly recommend!",
        "service_performed": "Roof Repair",
        "details": {
          "building_type": "Two-story",
          "insurance_covered": false
        }
      }
    ]
  }
}
```
"""

# Final output requirements
FINAL_OUTPUT_REQUIREMENTS = """
### **Final Output Requirements:**
- **Valid JSON output only** 
- **NO comments, explanations, or extra text**.
- **No unnecessary words or redundant fields**.
- **Strict adherence to JSON schema structure**.
- **Use `null` for missing values**, instead of empty strings or placeholders.
"""

def get_full_extraction_prompt(schema_str, instruction_prompt=None):
    """
    Get the full extraction prompt with schema and instructions.
    
    Args:
        schema_str: JSON schema as a string
        instruction_prompt: Optional custom instruction prompt
        
    Returns:
        Full prompt text
    """
    # Use default extraction rules if no custom instruction is provided
    if instruction_prompt is None:
        instruction_prompt = EXTRACTION_RULES
        
    # Construct the full prompt with clear section separators
    return f"""{EXTRACTION_INTRODUCTION}

---

{instruction_prompt}

---

{SCHEMA_OVERVIEW}

### **Complete JSON Schema:**
{schema_str}

---

{HTML_PARSING_GUIDELINES}

---

{OUTPUT_FORMAT_REQUIREMENTS}

---

{EXAMPLE_JSON_OUTPUT}

---

{FINAL_OUTPUT_REQUIREMENTS}

### **Now, process the following HTML content:**

{{content}}
"""

def get_extraction_prompt_with_content(schema_str, content, instruction_prompt=None):
    """
    Get the full extraction prompt with schema, instructions, and content.
    
    Args:
        schema_str: JSON schema as a string
        content: HTML content to extract from
        instruction_prompt: Optional custom instruction prompt
        
    Returns:
        Full prompt text with content
    """
    prompt_template = get_full_extraction_prompt(schema_str, instruction_prompt)
    return prompt_template.replace("{content}", content)

# Export key functions and variables
__all__ = [
    'EXTRACTION_INTRODUCTION',
    'EXTRACTION_RULES',
    'SCHEMA_OVERVIEW',
    'HTML_PARSING_GUIDELINES',
    'OUTPUT_FORMAT_REQUIREMENTS',
    'EXAMPLE_JSON_OUTPUT',
    'FINAL_OUTPUT_REQUIREMENTS',
    'get_full_extraction_prompt',
    'get_extraction_prompt_with_content'
]
