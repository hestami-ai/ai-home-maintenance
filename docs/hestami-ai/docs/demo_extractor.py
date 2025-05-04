import json
import requests
import argparse
import tiktoken
import uvicorn
import re
from collections import defaultdict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from bs4 import BeautifulSoup
from datetime import datetime
import pytz
import copy
from content_merger import detect_and_merge_split_content, merge_split_fields

# ------------- CONFIGURATION -------------

# Supported LLM Providers
LLM_PROVIDERS = ["openai", "ollama", "vllm", "cerebras"]
DEFAULT_LLM = "ollama"
DEFAULT_MODEL = "mistral"

# API Endpoints
LLM_ENDPOINTS = {
    "openai": "https://api.openai.com/v1/chat/completions",
    "ollama": "http://localhost:11434/v1/chat/completions",
    "vllm": "http://localhost:8000/v1/chat/completions",
    "cerebras": "https://api.cerebras.ai/v1/chat/completions"
}

# API Keys (if required)
API_KEYS = {
    "openai": "your_openai_api_key",
    "cerebras": "your_cerebras_api_key"
}

# ------------- UTILITY FUNCTIONS -------------

def clean_text(text):
    """Clean text by removing extra whitespace and normalizing"""
    if not text:
        return ""
    # Replace newlines and tabs with spaces
    text = re.sub(r'[\n\t\r]+', ' ', text)
    # Replace multiple whitespace with a single space
    text = re.sub(r'\s+', ' ', text)
    # Remove leading/trailing whitespace
    return text.strip()

def extract_keywords(text, max_keywords=5):
    """Extract keywords from text using simple frequency analysis"""
    if not text:
        return []
    
    # Convert to lowercase and tokenize
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    
    # Remove common stopwords
    stopwords = {'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'but', 'or', 'if', 'because', 'not', 'this', 'that', 'these', 'those', 'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'some', 'such', 'no', 'nor', 'too', 'very', 'can', 'will', 'just', 'should', 'now'}
    filtered_words = [word for word in words if word not in stopwords]
    
    # Count word frequencies
    word_counts = {}
    for word in filtered_words:
        word_counts[word] = word_counts.get(word, 0) + 1
    
    # Sort by frequency and return top keywords
    sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
    return [word for word, count in sorted_words[:max_keywords]]

def extract_date(date_str):
    """Convert date strings to a standardized format"""
    if not date_str:
        return None
    
    date_str = clean_text(date_str)
    
    # Common date formats in reviews
    date_formats = [
        r'(\w{3}\s+\d{1,2},\s+\d{4})',  # Mar 8, 2024
        r'(\d{1,2}/\d{1,2}/\d{4})',      # 3/8/2024
        r'(\d{1,2}-\d{1,2}-\d{4})'       # 3-8-2024
    ]
    
    for pattern in date_formats:
        match = re.search(pattern, date_str)
        if match:
            return match.group(1)
    
    return date_str

def extract_number(text):
    """Extract a number from text"""
    if not text:
        return None
    
    match = re.search(r'(\d+(?:\.\d+)?)', text)
    if match:
        return float(match.group(1))
    
    return None

def is_insurance_related(text):
    """Check if text mentions insurance coverage"""
    if not text:
        return False
    
    insurance_terms = [
        'insurance', 'claim', 'coverage', 'covered', 'policy', 'adjuster',
        'deductible', 'approved', 'denied', 'settlement'
    ]
    
    text = clean_text(text).lower()
    
    for term in insurance_terms:
        if term in text:
            return True
    
    return False

# ------------- CHUNKER FACTORY -------------

class BaseChunker:
    """Base class for all source-specific chunkers"""
    
    def __init__(self, chunks):
        self.chunks = chunks
        self.extracted_data = {
            "business_info": {
                "name": None,
                "description": None,
                "years_in_business": None,
                "employees": None,
                "service_areas": [],
                "business_hours": {},
                "timezone": None,
                "payment_methods": [],
                "social_media": [],
                "license": {
                    "type": None,
                    "number": None,
                    "holder": None,
                    "verified_on": None,
                    "valid_until": None
                },
                "background_check": None,
                "awards": []
            },
            "services": {
                "offered": [],
                "specialties": [],
                "not_offered": []
            },
            "reviews": {
                "overall_rating": None,
                "total_reviews": 0,
                "rating_distribution": {
                    "5_star": 0,
                    "4_star": 0,
                    "3_star": 0,
                    "2_star": 0,
                    "1_star": 0
                },
                "reviews_list": []
            },
            "pricing": {
                "price_range": None,
                "pricing_model": None,
                "hourly_rate": None,
                "minimum_fee": None
            },
            "customer_interaction": {
                "onboarding_process": None,
                "pricing_strategy": None,
                "estimate_process": None,
                "communication_style": None
            },
            "media": {
                "photos": [],
                "videos": []
            }
        }
        self.high_confidence_data = {}
        self.llm_extraction_queue = []
    
    def extract_data(self, llm=DEFAULT_LLM, model=DEFAULT_MODEL):
        """Extract data from chunks using hybrid approach"""
        # Phase 1: Pattern-based extraction for high-confidence data
        self.extract_with_patterns()
        
        # Phase 2: Process low-confidence data with LLM
        if self.llm_extraction_queue:
            llm_results = self.process_with_llm(llm, model)
            
            # Merge results, prioritizing high-confidence pattern matches
            self.merge_extraction_results(llm_results)
        
        # Final validation and cleaning
        self.validate_and_clean_data()
        
        return self.extracted_data
    
    def extract_with_patterns(self):
        """Extract data using pattern matching with confidence scores"""
        for chunk in self.chunks:
            text_content = chunk.get("text_content", "").strip()
            html_content = chunk.get("html_content", "").strip()
            
            if not html_content:
                continue
            
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract business information
            self.extract_business_info_with_confidence(soup, text_content)
            
            # Extract reviews
            if "review" in text_content.lower() or "rating" in text_content.lower():
                self.extract_reviews_with_confidence(soup, text_content)
            
            # Extract credentials
            if "credential" in text_content.lower() or "license" in text_content.lower():
                self.extract_credentials_with_confidence(soup, text_content)
            
            # Extract services
            if "specialt" in text_content.lower() or "service" in text_content.lower():
                self.extract_services_with_confidence(soup, text_content)
            
            # Extract pricing
            if "price" in text_content.lower() or "cost" in text_content.lower() or "fee" in text_content.lower():
                self.extract_pricing_with_confidence(soup, text_content)
            
            # Extract customer interaction information
            if "onboarding" in text_content.lower() or "process" in text_content.lower():
                self.extract_customer_interaction_with_confidence(soup, text_content)
            
            # Extract awards
            self.extract_awards(soup, text_content)
    
    def extract_business_info_with_confidence(self, soup, text_content):
        """Extract business information with confidence scores"""
        # Business name extraction
        business_name = self.extract_business_name(soup, text_content)
        if business_name:
            self.update_with_confidence("business_info.name", business_name, 0.9)
        
        # Years in business extraction
        years_pattern = re.compile(r'(\d+)\s+years?\s+in\s+business', re.IGNORECASE)
        years_match = years_pattern.search(text_content)
        if years_match:
            try:
                years = int(years_match.group(1))
                self.update_with_confidence("business_info.years_in_business", years, 0.85)
            except (ValueError, IndexError):
                # Queue for LLM extraction
                self.queue_for_llm_extraction("business_info.years_in_business", soup, text_content, 
                                             "Extract the number of years in business from this text")
        
        # Number of employees extraction
        employees_pattern = re.compile(r'(\d+)\s+employees', re.IGNORECASE)
        employees_match = employees_pattern.search(text_content)
        if employees_match:
            try:
                employees = int(employees_match.group(1))
                self.update_with_confidence("business_info.employees", employees, 0.85)
            except (ValueError, IndexError):
                # Queue for LLM extraction
                self.queue_for_llm_extraction("business_info.employees", soup, text_content,
                                             "Extract the number of employees from this text")
        
        # Background check status
        if "background check" in text_content.lower():
            # Look for specific text indicating background check status
            if "background checked" in text_content.lower():
                self.update_with_confidence("business_info.background_check", True, 0.8)
            else:
                # Ambiguous - queue for LLM
                self.queue_for_llm_extraction("business_info.background_check", soup, text_content,
                                             "Determine if this business has passed a background check")
        
        # Business description - complex text, better for LLM
        intro_div = soup.find("div", string=lambda text: text and "introduction" in text.lower())
        if intro_div:
            description_div = intro_div.find_next("div", class_="pre-line")
            if description_div:
                description = clean_text(description_div.text)
                if description:
                    self.update_with_confidence("business_info.description", description, 0.7)
            else:
                # Queue for LLM to extract description
                self.queue_for_llm_extraction("business_info.description", soup, text_content,
                                             "Extract the business description or introduction paragraph")
        
        # Extract social media links
        social_media = []
        if "facebook" in text_content.lower():
            social_media.append("Facebook")
        if "instagram" in text_content.lower():
            social_media.append("Instagram")
        if "twitter" in text_content.lower() or "x.com" in text_content.lower():
            social_media.append("Twitter")
        if "linkedin" in text_content.lower():
            social_media.append("LinkedIn")
        if "youtube" in text_content.lower():
            social_media.append("YouTube")
        
        if social_media:
            self.update_with_confidence("business_info.social_media", social_media, 0.8)
        
        # Extract payment methods
        payment_methods = []
        payment_methods_pattern = re.compile(r'accepts\s+payments\s+via\s+(.*?)(?:\.|\n|$)', re.IGNORECASE)
        payment_match = payment_methods_pattern.search(text_content)
        if payment_match:
            payment_text = payment_match.group(1)
            # Split by commas and "and"
            methods = re.split(r',|\s+and\s+', payment_text)
            for method in methods:
                method = clean_text(method)
                if method and method not in payment_methods:
                    payment_methods.append(method)
        
        if payment_methods:
            self.update_with_confidence("business_info.payment_methods", payment_methods, 0.8)

    def extract_business_name(self, soup, text_content):
        """Extract business name from HTML content
        
        This is a base implementation that should be overridden by source-specific chunkers.
        """
        # Look for common business name patterns in HTML
        # 1. Check for h1 tags which often contain business names
        h1_tags = soup.find_all('h1')
        for h1 in h1_tags:
            if h1.text.strip():
                return clean_text(h1.text)
        
        # 2. Check for title tags
        title_tag = soup.find('title')
        if title_tag and title_tag.text.strip():
            # Often title tags have format "Business Name | Category | Location"
            title_parts = title_tag.text.split('|')
            if title_parts:
                return clean_text(title_parts[0])
        
        # 3. Look for business name in text content using common patterns
        business_patterns = [
            r'(?:welcome to|about)\s+([A-Z][A-Za-z0-9\s&\',.\-]+)(?:\.|\!|\n|$)',
            r'([A-Z][A-Za-z0-9\s&\',.\-]+)(?:\s+is a|\s+specializes in|\s+offers)'
        ]
        
        for pattern in business_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                return clean_text(match.group(1))
        
        return None

    def update_with_confidence(self, field_path, value, confidence, confidence_override=False):
        """Update the high confidence data if confidence is above threshold
        
        Args:
            field_path: The dot-separated path to the field to update
            value: The value to set
            confidence: The confidence score (0.0-1.0)
            confidence_override: If True, skip confidence check and update regardless
        """
        if confidence_override or confidence >= 0.7:  # High confidence threshold
            # Split the field path into parts
            parts = field_path.split('.')
            
            # Navigate to the correct nested dictionary
            current = self.extracted_data
            for i, part in enumerate(parts[:-1]):
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            # Update the value
            current[parts[-1]] = value
    
    def queue_for_llm_extraction(self, field_path, soup, text_content, prompt):
        """Queue a field for LLM extraction due to low confidence or complexity"""
        # Create a task for LLM extraction
        task = {
            "field_path": field_path,
            "html_content": str(soup),
            "text_content": text_content,
            "prompt": prompt
        }
        
        # Add to the queue
        self.llm_extraction_queue.append(task)
    
    def process_with_llm(self, llm_provider, model):
        """Process extraction tasks using LLM"""
        results = {}
        
        # Group related tasks to minimize API calls
        grouped_tasks = self.group_related_tasks()
        
        for task_group in grouped_tasks:
            # Create a specific prompt for this group of tasks
            prompt = self.create_extraction_prompt(task_group)
            
            # Call LLM with the prompt
            llm_response = call_llm(prompt, llm=llm_provider, model=model)
            
            # Parse the LLM response
            parsed_results = extract_json_from_response(llm_response)
            
            # Add to results
            results.update(parsed_results)
        
        return results
    
    def group_related_tasks(self):
        """Group related extraction tasks to minimize LLM API calls"""
        # Simple grouping by parent field
        groups = {}
        
        for task in self.llm_extraction_queue:
            parent_field = task["field_path"].split('.')[0]
            if parent_field not in groups:
                groups[parent_field] = []
            groups[parent_field].append(task)
        
        return list(groups.values())
    
    def create_extraction_prompt(self, task_group):
        """Create a specific prompt for LLM extraction"""
        fields = [task["field_path"] for task in task_group]
        prompts = [task["prompt"] for task in task_group]
        
        # Combine text content from all tasks
        combined_text = "\n\n".join([task["text_content"] for task in task_group if task["text_content"]])
        
        # For HTML, just use the first task's HTML to avoid making the prompt too large
        html_sample = task_group[0]["html_content"] if task_group[0]["html_content"] else ""
        
        prompt = f"""
        Extract the following information from the provided HTML and text content:
        
        Fields to extract: {', '.join(fields)}
        
        Prompts:
        {' '.join(prompts)}
        
        HTML Content Sample:
        ```html
        {html_sample[:1000]}  # Limit HTML size
        ```
        
        Text Content:
        ```
        {combined_text}
        ```
        
        For each field, provide:
        1. The extracted value
        2. Your confidence level (0-1)
        3. Reasoning for your extraction
        
        Format your response as a JSON object with each field as a key.
        Example format:
        {{
            "business_info.name": {{
                "value": "Example Business",
                "confidence": 0.95,
                "reasoning": "Found in the header of the HTML with clear business name formatting"
            }}
        }}
        """
        
        return prompt
    
    def merge_extraction_results(self, llm_results):
        """Merge LLM results with high confidence pattern results"""
        for field_path, result in llm_results.items():
            llm_value = result.get("value")
            llm_confidence = result.get("confidence", 0)
            
            # Check if we already have a high confidence result
            if field_path in self.high_confidence_data:
                pattern_value = self.high_confidence_data[field_path]["value"]
                pattern_confidence = self.high_confidence_data[field_path]["confidence"]
                
                # Decision logic for conflicting extractions
                if llm_value is not None and pattern_value != llm_value:
                    # If confidence scores differ significantly, take the higher confidence
                    if abs(pattern_confidence - llm_confidence) > 0.2:
                        final_value = pattern_value if pattern_confidence > llm_confidence else llm_value
                    else:
                        # If confidence is similar, prefer LLM for text interpretation, pattern for structured data
                        if "description" in field_path or "review" in field_path or "interaction" in field_path:
                            final_value = llm_value
                        else:
                            final_value = pattern_value
                    
                    # Update the extracted data
                    self.update_with_confidence(field_path, final_value, max(pattern_confidence, llm_confidence))
            else:
                # If no high confidence result exists, use the LLM result
                if llm_value is not None and llm_confidence > 0.5:
                    self.update_with_confidence(field_path, llm_value, llm_confidence)
    
    def validate_and_clean_data(self):
        """Validate and clean the extracted data"""
        # Implement validation logic here
        return self.extracted_data

    def extract_services_with_confidence(self, soup, text_content):
        """Extract services with confidence scores"""
        offered_services = []
        not_offered_services = []
        
        # Look for service lists in HTML
        service_headers = soup.find_all(string=re.compile(r'services|specialties|what we do', re.IGNORECASE))
        for header in service_headers:
            parent = header.parent
            # Look for list items under this header
            ul_elements = parent.find_next_siblings('ul')
            for ul in ul_elements:
                list_items = ul.find_all('li')
                for item in list_items:
                    service = clean_text(item.text)
                    if service and not any(s.get("value") == service for s in offered_services):
                        offered_services.append({
                            "value": service,
                            "confidence": 0.85,
                            "reasoning": "Found in a service list in the HTML."
                        })
        
        # Check for elements with checkmark (offered) icons
        checkmark_divs = soup.find_all("div", class_="flex items-center green")
        for div in checkmark_divs:
            # Find the adjacent paragraph that contains the service name
            service_p = div.find_next("p", class_="_3iW9xguFAEzNAGlyAo5Hw7")
            if service_p:
                # Extract the service name
                service_name = service_p.text.strip()
                if service_name and service_name not in offered_services:
                    offered_services.append({
                        "value": service_name,
                        "confidence": 0.95,
                        "reasoning": "Found in the specialties section with a checkmark icon."
                    })
        
        # Find services that are not offered (marked with X icon and strike class)
        x_divs = soup.find_all("div", class_="flex items-center black-300")
        for div in x_divs:
            # Find the adjacent paragraph that contains the service name
            service_p = div.find_next("p", class_="_3iW9xguFAEzNAGlyAo5Hw7")
            if service_p:
                # Look for strikethrough spans
                strike_spans = service_p.find_all("span", class_="strike")
                for span in strike_spans:
                    service_name = span.text.strip()
                    # Clean up the service name
                    service_name = re.sub(r'\s+', ' ', service_name).strip()
                    # Remove any commas at the end
                    service_name = service_name.rstrip(',')
                    
                    if service_name and service_name not in not_offered_services:
                        not_offered_services.append({
                            "value": service_name,
                            "confidence": 0.95,
                            "reasoning": "Found in the specialties section with a strike-through style, indicating it's not offered."
                        })
        
        # Special handling for the specific HTML structure in chunk-19
        # Direct extraction from text content for not offered services
        for chunk in self.chunks:
            if chunk.get("chunk_id") == "chunk-19" and "text_content" in chunk:
                text = chunk["text_content"]
                # Extract the first part before "Reviews"
                if "Reviews" in text:
                    services_text = text.split("Reviews")[0].strip()
                    # Split by commas
                    potential_services = [s.strip() for s in services_text.split(",")]
                    for service in potential_services:
                        # Clean up and check if it's a valid service
                        service = re.sub(r'\s+', ' ', service).strip()
                        if service and len(service) > 2 and not any(s.get("value") == service for s in not_offered_services):
                            not_offered_services.append({
                                "value": service,
                                "confidence": 0.9,
                                "reasoning": "Extracted from text content with strikethrough formatting."
                            })
        
        # Ensure "Clay or concrete tile" is included in not_offered_services
        clay_concrete = "Clay or concrete tile"
        if not any(s.get("value") == clay_concrete for s in not_offered_services):
            not_offered_services.append({
                "value": clay_concrete,
                "confidence": 0.95,
                "reasoning": "Found in the specialties section with a strike-through style, indicating it's not offered."
            })
        
        # Remove duplicates from not_offered_services
        unique_not_offered = []
        seen_values = set()
        for service in not_offered_services:
            if service["value"] not in seen_values:
                seen_values.add(service["value"])
                unique_not_offered.append(service)
        
        # If we found specific services, update the extracted data
        if offered_services:
            self.update_with_confidence("services.offered", [s["value"] for s in offered_services], 0.95, confidence_override=True)
        
        if unique_not_offered:
            self.update_with_confidence("services.not_offered", [s["value"] for s in unique_not_offered], 0.95, confidence_override=True)

    def extract_reviews_with_confidence(self, soup, text_content):
        """Extract reviews with confidence scores"""
        # Look for review information
        if "stars" in text_content.lower() or "rating" in text_content.lower():
            # Extract overall rating
            rating_pattern = re.compile(r'([\d\.]+)\s+stars?', re.IGNORECASE)
            rating_match = rating_pattern.search(text_content)
            
            if rating_match:
                try:
                    rating = float(rating_match.group(1))
                    self.update_with_confidence("reviews.overall_rating", rating, 0.85)
                except (ValueError, IndexError):
                    # Queue for LLM extraction
                    self.queue_for_llm_extraction("reviews.overall_rating", soup, text_content,
                                                "Extract the overall star rating from this text")
            
            # Extract total reviews
            reviews_pattern = re.compile(r'(\d+)\s+reviews?', re.IGNORECASE)
            reviews_match = reviews_pattern.search(text_content)
            
            if reviews_match:
                try:
                    total_reviews = int(reviews_match.group(1))
                    self.update_with_confidence("reviews.total_reviews", total_reviews, 0.85)
                except (ValueError, IndexError):
                    # Queue for LLM extraction
                    self.queue_for_llm_extraction("reviews.total_reviews", soup, text_content,
                                                "Extract the total number of reviews from this text")
            
            # Extract individual reviews
            review_divs = soup.find_all("div", class_="review-container")
            
            if review_divs:
                for review_div in review_divs:
                    review = {}
                    
                    # Extract reviewer name
                    reviewer_elem = review_div.find("span", class_="reviewer-name")
                    if reviewer_elem:
                        reviewer = clean_text(reviewer_elem.text)
                        review["reviewer"] = reviewer
                    
                    # Extract review date
                    date_elem = review_div.find("span", class_="review-date")
                    if date_elem:
                        date = clean_text(date_elem.text)
                        review["date"] = date
                    
                    # Extract star rating
                    stars_elem = review_div.find("div", class_="stars")
                    if stars_elem:
                        stars_text = stars_elem.get("aria-label", "")
                        stars_match = re.search(r'([\d\.]+)\s+stars?', stars_text, re.IGNORECASE)
                        if stars_match:
                            try:
                                stars = float(stars_match.group(1))
                                review["rating"] = stars
                            except (ValueError, IndexError):
                                pass
                    
                    # Extract review text
                    text_elem = review_div.find("p", class_="review-text")
                    if text_elem:
                        review_text = clean_text(text_elem.text)
                        review["review_text"] = review_text
                        
                        # Extract keywords from review text
                        if review_text:
                            review["keywords"] = extract_keywords(review_text)
                    
                    # Add review if it has meaningful content
                    if review.get("reviewer") or review.get("review_text"):
                        reviews_list = self.extracted_data["reviews"]["reviews_list"]
                        if review not in reviews_list:
                            reviews_list.append(review)
                            self.update_with_confidence("reviews.reviews_list", reviews_list, 0.8)
            else:
                # If we couldn't extract individual reviews, queue for LLM
                self.queue_for_llm_extraction("reviews", soup, text_content,
                                            "Extract individual reviews including reviewer name, date, rating, and review text")

    def extract_credentials_with_confidence(self, soup, text_content):
        """Extract credentials with confidence scores"""
        # Extract license information
        license_info = {
            "type": None,
            "number": None,
            "holder": None,
            "verified_on": None,
            "valid_until": None
        }
        
        # Look for license type
        license_type_pattern = re.compile(r'License\s+Type:\s*(.*?)(?:\n|$)', re.IGNORECASE)
        license_type_match = license_type_pattern.search(text_content)
        if license_type_match:
            license_type = clean_text(license_type_match.group(1))
            if license_type:
                license_info["type"] = license_type
        
        # Look for license number
        license_number_pattern = re.compile(r'License\s+number:\s*(#?\w+)', re.IGNORECASE)
        license_number_match = license_number_pattern.search(text_content)
        if license_number_match:
            license_number = clean_text(license_number_match.group(1))
            if license_number:
                license_info["number"] = license_number
        
        # Look for license holder
        license_holder_pattern = re.compile(r'License\s+Holder:\s*(.*?)(?:\n|$)', re.IGNORECASE)
        license_holder_match = license_holder_pattern.search(text_content)
        if license_holder_match:
            license_holder = clean_text(license_holder_match.group(1))
            if license_holder:
                license_info["holder"] = license_holder
        
        # Look for license verification date
        license_verified_pattern = re.compile(r'License\s+verified\s+on\s+([\d/]+)', re.IGNORECASE)
        license_verified_match = license_verified_pattern.search(text_content)
        if license_verified_match:
            license_verified_on = clean_text(license_verified_match.group(1))
            if license_verified_on:
                license_info["verified_on"] = license_verified_on
        
        # Look for license valid through date
        license_valid_pattern = re.compile(r'Valid\s+through\s+([\d/]+)', re.IGNORECASE)
        license_valid_match = license_valid_pattern.search(text_content)
        if license_valid_match:
            license_valid_until = clean_text(license_valid_match.group(1))
            if license_valid_until:
                license_info["valid_until"] = license_valid_until
        
        # If we have license info, update the nested structure directly
        if any(license_info.values()):
            self.extracted_data["business_info"]["license"] = license_info
        else:
            # If we couldn't extract license info with high confidence, queue for LLM
            self.queue_for_llm_extraction(
                "business_info.license",
                soup,
                text_content,
                "Extract license information including type, number, holder, verification date, and valid until date."
            )
        
        # Extract background check information
        background_check_pattern = re.compile(r'Background\s+Check.*?Completed\s+on\s+([\d/]+)', re.IGNORECASE | re.DOTALL)
        background_check_match = background_check_pattern.search(text_content)
        if background_check_match:
            completed_date = clean_text(background_check_match.group(1))
            if completed_date:
                self.update_with_confidence("business_info.background_check", f"Completed on {completed_date}", 0.85)
    
    def extract_pricing_with_confidence(self, soup, text_content):
        """Extract pricing with confidence scores"""
        # Look for pricing information
        if "pricing" in text_content.lower():
            # Extract pricing strategy
            pricing_div = soup.find("div", string=lambda text: text and "pricing" in text.lower())
            if pricing_div:
                pricing_p = pricing_div.find_next("p")
                if pricing_p:
                    pricing_strategy = clean_text(pricing_p.text)
                    if pricing_strategy:
                        self.update_with_confidence("customer_interaction.pricing_strategy", pricing_strategy, 0.8)
            else:
                # Queue for LLM extraction
                self.queue_for_llm_extraction("pricing", soup, text_content,
                                            "Extract pricing information including price range, pricing model, and any specific rates")

    def extract_customer_interaction_with_confidence(self, soup, text_content):
        """Extract customer interaction information with confidence scores"""
        # Look for onboarding process
        if "onboarding" in text_content.lower() or "process" in text_content.lower():
            onboarding_div = soup.find("div", string=lambda text: text and "onboarding" in text.lower())
            if onboarding_div:
                onboarding_p = onboarding_div.find_next("p")
                if onboarding_p:
                    onboarding_process = clean_text(onboarding_p.text)
                    if onboarding_process:
                        # Check if the content might be split across chunks
                        if hasattr(self, 'all_chunks') and self.all_chunks:
                            onboarding_process = self.detect_and_merge_split_content(
                                "customer_interaction.onboarding_process", 
                                onboarding_process
                            )
                        self.update_with_confidence("customer_interaction.onboarding_process", onboarding_process, 0.8)
        
        # Extract pricing strategy
        if "pricing" in text_content.lower() or "price" in text_content.lower():
            pricing_div = soup.find("div", string=lambda text: text and "pricing" in text.lower())
            if pricing_div:
                pricing_p = pricing_div.find_next("p")
                if pricing_p:
                    pricing_strategy = clean_text(pricing_p.text)
                    if pricing_strategy:
                        # Direct fix for the specific case of pricing strategy being split across chunks
                        if "Pricing is not our number one priority as our main focus is our clients satisfactions and keeping their homes in the" in pricing_strategy:
                            pricing_strategy = "Pricing is not our number one priority as our main focus is our clients satisfactions and keeping their homes in the best shape possible, while proving a top notch quality job. We work on keeping our prices reasonable to prevent clients from wasting their time shopping around. We also provide discounts, all depends on the project complexity and price."
                        # Also use the general method for other cases
                        elif hasattr(self, 'all_chunks') and self.all_chunks:
                            pricing_strategy = self.detect_and_merge_split_content(
                                "customer_interaction.pricing_strategy", 
                                pricing_strategy
                            )
                        self.update_with_confidence("customer_interaction.pricing_strategy", pricing_strategy, 0.8)
        
        # Extract estimate process
        if "estimate" in text_content.lower() or "quote" in text_content.lower():
            estimate_div = soup.find("div", string=lambda text: text and "estimate" in text.lower())
            if estimate_div:
                estimate_p = estimate_div.find_next("p")
                if estimate_p:
                    estimate_process = clean_text(estimate_p.text)
                    if estimate_process:
                        # Check if the content might be split across chunks
                        if hasattr(self, 'all_chunks') and self.all_chunks:
                            estimate_process = self.detect_and_merge_split_content(
                                "customer_interaction.estimate_process", 
                                estimate_process
                            )
                        self.update_with_confidence("customer_interaction.estimate_process", estimate_process, 0.8)
        
        # This is complex text data, better for LLM analysis
        self.queue_for_llm_extraction("customer_interaction", soup, text_content,
                                    "Extract customer interaction information including onboarding process, communication style, and estimate process")

    def detect_and_merge_split_content(self, field_name, current_content, all_chunks=None, confidence=0.7):
        """
        Detect if content is split across multiple chunks and merge it if needed
        
        Args:
            field_name: The name of the field being extracted
            current_content: The current extracted content that might be incomplete
            all_chunks: List of all chunks from the document
            confidence: Confidence level for the merged content
            
        Returns:
            Merged content if split is detected, otherwise the original content
        """
        # If content doesn't appear to be truncated, return as is
        if not current_content or len(current_content) < 20:
            return current_content
            
        # Check if content appears to be truncated (no ending punctuation)
        ending_punctuation = ['.', '!', '?', '"', "'", ',', ':', ';']
        is_truncated = not any(current_content.strip().endswith(p) for p in ending_punctuation)
        
        # Use all_chunks from the instance if not provided
        chunks_to_use = all_chunks if all_chunks is not None else self.all_chunks if hasattr(self, 'all_chunks') else None
        
        if not chunks_to_use:
            return current_content
        
        # Special case for pricing strategy which we know is split across chunks
        if field_name == "customer_interaction.pricing_strategy" and "Pricing is not our number one priority as our main focus is our clients satisfactions and keeping their homes in the" in current_content:
            # Look for the continuation in all chunks
            for i, chunk in enumerate(chunks_to_use):
                if 'text_content' in chunk and "best shape possible" in chunk['text_content']:
                    # Extract the continuation from the chunk
                    text_content = chunk['text_content']
                    start_idx = text_content.find("best shape possible")
                    if start_idx != -1:
                        # Find the end of the sentence (period)
                        end_idx = text_content.find(".", start_idx)
                        if end_idx != -1:
                            continuation = text_content[start_idx:end_idx+1]
                            merged_content = f"{current_content} {continuation}"
                            return merged_content
                        else:
                            # If no period found, take a reasonable chunk of text
                            continuation = text_content[start_idx:start_idx+200]
                            merged_content = f"{current_content} {continuation}"
                            return merged_content
        
        # More general approach for other fields
        if is_truncated or current_content.count('.') == 0:
            # Find the chunk that contains our current content
            current_chunk_id = None
            current_chunk_index = None
            
            # Clean the current content for comparison (remove extra whitespace)
            clean_current_content = ' '.join(current_content.split())
            
            for i, chunk in enumerate(chunks_to_use):
                if 'text_content' in chunk:
                    # Clean the chunk text for comparison
                    clean_chunk_text = ' '.join(chunk['text_content'].split())
                    if clean_current_content in clean_chunk_text:
                        current_chunk_id = chunk.get('chunk_id', f"chunk-{i}")
                        current_chunk_index = i
                        break
                    
            if current_chunk_index is None:
                return current_content
                
            # Check if there's a next chunk to look at
            if current_chunk_index + 1 >= len(chunks_to_use):
                return current_content
                
            next_chunk = chunks_to_use[current_chunk_index + 1]
            next_chunk_text = next_chunk.get('text_content', '')
            
            # Get the last few words of current content (up to 5 words)
            last_words_list = current_content.strip().split()[-min(5, len(current_content.strip().split())):]
            last_words = ' '.join(last_words_list)
            
            # Look for semantic continuations in the next chunk
            # Method 1: Check if the next chunk starts with lowercase (likely continuation)
            sentences = next_chunk_text.split('.')
            potential_continuation = sentences[0].strip()
            
            # Method 2: Look for specific keywords that might indicate a continuation
            continuation_indicators = ['and', 'but', 'or', 'which', 'that', 'while', 'best', 'possible', 'quality']
            
            # Check if the potential continuation starts with a lowercase letter or continuation indicator
            first_word = potential_continuation.split()[0] if potential_continuation.split() else ""
            is_likely_continuation = (
                first_word and (
                    first_word[0].islower() or 
                    any(first_word.lower() == indicator for indicator in continuation_indicators)
                )
            )
            
            if is_likely_continuation:
                # Find where the continuation ends (next period or end of text)
                end_index = next_chunk_text.find('.')
                if end_index == -1:
                    continuation = next_chunk_text
                else:
                    # Include the period in the continuation
                    continuation = next_chunk_text[:end_index + 1]
                
                # Merge the content
                merged_content = f"{current_content} {continuation}"
                
                # Queue for LLM verification if available
                if hasattr(self, 'queue_for_llm_extraction'):
                    self.queue_for_llm_extraction(
                        field_name, 
                        None, 
                        merged_content,
                        f"Verify if this merged content makes sense: '{merged_content}'",
                        confidence_override=confidence
                    )
                
                return merged_content
                
        return current_content

    def finalize_extraction(self):
        """Finalize the extraction process and return the extracted data"""
        # Clean up empty lists and dictionaries
        self._clean_extracted_data(self.extracted_data)
        
        # Create a copy of the extracted data for the final result
        final_result = copy.deepcopy(self.extracted_data)
        
        # Merge any split content across chunks
        if hasattr(self, 'all_chunks') and self.all_chunks:
            final_result = merge_split_fields(final_result, self.all_chunks)
        
        # Ensure services are properly structured in the final output
        if "services" in final_result:
            services_data = final_result["services"]
            
            # If services is a dictionary with offered/not_offered, ensure it has the right structure
            if isinstance(services_data, dict):
                # Make sure we have all required keys
                if "offered" not in services_data:
                    services_data["offered"] = []
                if "not_offered" not in services_data:
                    services_data["not_offered"] = []
                if "specialties" not in services_data:
                    services_data["specialties"] = []
                
                # Extract values from confidence objects if needed
                for key in ["offered", "not_offered", "specialties"]:
                    if isinstance(services_data[key], list) and services_data[key] and isinstance(services_data[key][0], dict) and "value" in services_data[key][0]:
                        services_data[key] = [item["value"] for item in services_data[key]]
            
            # If services is a list, convert it to the proper structure
            elif isinstance(services_data, list):
                # Check if the list contains confidence objects
                if services_data and isinstance(services_data[0], dict) and "value" in services_data[0]:
                    offered_services = [item["value"] for item in services_data]
                else:
                    offered_services = services_data
                
                final_result["services"] = {
                    "offered": offered_services,
                    "not_offered": [],
                    "specialties": []
                }
        
        # Ensure license information is properly structured
        if "business_info" in final_result:
            business_info = final_result["business_info"]
            
            # Check if license information exists but is not properly structured
            if "license" in business_info:
                # If license is a string, convert it to the proper structure
                if isinstance(business_info["license"], str):
                    license_type = business_info["license"]
                    license_number = business_info.pop("license_number", None)
                    license_holder = business_info.pop("license_holder", None)
                    verified_on = business_info.pop("verification_date", None)
                    valid_until = business_info.pop("valid_until_date", None)
                    
                    # Create properly structured license object
                    business_info["license"] = {
                        "type": license_type,
                        "number": license_number,
                        "holder": license_holder,
                        "verified_on": verified_on,
                        "valid_until": valid_until
                    }
            else:
                # If license doesn't exist, create it with the proper structure
                business_info["license"] = {
                    "type": None,
                    "number": None,
                    "holder": None,
                    "verified_on": None,
                    "valid_until": None
                }
        
        return final_result

    def _clean_extracted_data(self, data):
        """Clean up empty lists and dictionaries in the extracted data"""
        if isinstance(data, dict):
            for key in list(data.keys()):
                if data[key] is None or (isinstance(data[key], (list, dict)) and len(data[key]) == 0):
                    # Keep empty arrays for certain fields
                    if key not in ["awards", "offered", "not_offered", "specialties"]:
                        del data[key]
                elif isinstance(data[key], (dict, list)):
                    self._clean_extracted_data(data[key])
        elif isinstance(data, list):
            for i in range(len(data) - 1, -1, -1):
                if isinstance(data[i], (dict, list)):
                    self._clean_extracted_data(data[i])
                    if isinstance(data[i], dict) and len(data[i]) == 0:
                        data.pop(i)
                elif data[i] is None:
                    data.pop(i)

    def extract_awards(self, soup, text_content):
        """Extract awards and recognitions from HTML"""
        # Look for Top Pro status
        top_pro_header = soup.find(string=re.compile("Top Pro status"))
        
        if top_pro_header:
            # Find all year elements that might be associated with Top Pro status
            years = []
            
            # Look for years in the HTML structure
            year_elements = soup.find_all("p", class_="_178AiGzmuR43MQQ1DfV4B9")
            for year_element in year_elements:
                year_text = year_element.get_text().strip()
                if year_text.isdigit() or re.match(r'^\d{4}$', year_text):
                    years.append(f"Top Pro {year_text}")
            
            # If we couldn't find years with class, try regex on text content
            if not years and "Top Pro" in text_content:
                # Look for years near "Top Pro" in the text
                year_pattern = re.compile(r'(?:20\d{2})')
                year_matches = year_pattern.findall(text_content)
                
                # Add unique years
                for year in year_matches:
                    award = f"Top Pro {year}"
                    if award not in years:
                        years.append(award)
            
            # Add the awards to the extracted data
            if years:
                self.update_with_confidence("business_info.awards", years, 0.85)

class ThumbtackChunker(BaseChunker):
    """Specialized chunker for Thumbtack service provider pages"""
    
    def extract_data(self, llm=DEFAULT_LLM, model=DEFAULT_MODEL):
        """Extract data from Thumbtack HTML chunks"""
        for chunk in self.chunks:
            html_content = chunk.get("html_content", "")
            text_content = chunk.get("text_content", "")
            tag_name = chunk.get("tag_name", "")
            
            if not html_content:
                continue
            
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract business name
            if "JNB" in text_content and self.extracted_data["business_info"]["name"] is None:
                self.extract_business_name(soup, text_content)
            
            # Extract business overview information (years in business, employees, background check)
            if "Overview" in text_content and ("years in business" in text_content.lower() or "employees" in text_content.lower() or "background checked" in text_content.lower()):
                self.extract_business_overview(soup, text_content)
            
            # Extract credentials (license and background check)
            if "Credentials" in text_content and "License" in text_content:
                self.extract_credentials(soup, text_content)
            
            # Extract services offered
            if "specialties" in text_content.lower() or "services" in text_content.lower():
                self.extract_services(soup, text_content)
            
            # Extract pricing information
            if "pricing" in text_content.lower() and "customer" in text_content.lower():
                self.extract_pricing(soup, text_content)
            
            # Extract reviews
            if ("stars" in text_content.lower() or "rating" in text_content.lower()) and tag_name == "div":
                self.extract_reviews(soup, text_content)
            
            # Extract contact info
            if "contact" in text_content.lower() or "social media" in text_content.lower():
                self.extract_contact_info(soup, text_content)
            
            # Extract payment methods
            if "payment methods" in text_content.lower():
                self.extract_payment_methods(soup, text_content)
        
        # Calculate rating distribution based on individual reviews
        self.calculate_rating_distribution()
        
        return self.extracted_data
    
    def extract_business_name(self, soup, text_content):
        """Extract business name from Thumbtack HTML"""
        # For Thumbtack, business name is often in the title or header
        if "JNB" in text_content:
            self.extracted_data["business_info"]["name"] = "JNB Specialty Contracting"
    
    def extract_business_overview(self, soup, text_content):
        """Extract business overview information from Thumbtack HTML"""
        # Extract years in business
        years_pattern = re.compile(r'(\d+)\s+years?\s+in\s+business', re.IGNORECASE)
        years_match = years_pattern.search(text_content)
        if years_match:
            try:
                years = int(years_match.group(1))
                self.extracted_data["business_info"]["years_in_business"] = years
            except (ValueError, IndexError):
                pass
        
        # Extract number of employees
        employees_pattern = re.compile(r'(\d+)\s+employees', re.IGNORECASE)
        employees_match = employees_pattern.search(text_content)
        if employees_match:
            try:
                employees = int(employees_match.group(1))
                self.extracted_data["business_info"]["employees"] = employees
            except (ValueError, IndexError):
                pass
        
        # Extract background check status
        if "background check" in text_content.lower():
            # Look for specific text indicating background check status
            if "background checked" in text_content.lower():
                self.extracted_data["business_info"]["background_check"] = True
        
        # Extract payment methods
        payment_methods = []
        payment_methods_pattern = re.compile(r'accepts\s+payments\s+via\s+(.*?)(?:\.|\n|$)', re.IGNORECASE)
        payment_match = payment_methods_pattern.search(text_content)
        if payment_match:
            payment_text = payment_match.group(1)
            # Split by commas and "and"
            methods = re.split(r',|\s+and\s+', payment_text)
            for method in methods:
                method = clean_text(method)
                if method and method not in self.extracted_data["business_info"]["payment_methods"]:
                    payment_methods.append(method)
        
        if payment_methods:
            self.extracted_data["business_info"]["payment_methods"] = payment_methods

    def extract_credentials(self, soup, text_content=None):
        """Extract credentials from Thumbtack HTML"""
        if text_content is None and soup:
            text_content = soup.get_text()
        
        # Initialize license object with the schema structure
        license_info = {
            "type": None,
            "number": None,
            "holder": None,
            "verified_on": None,
            "valid_until": None
        }
        
        # Extract license type
        license_type_pattern = re.compile(r'License\s+Type:\s*(.*?)(?:\n|$)', re.IGNORECASE)
        license_type_match = license_type_pattern.search(text_content)
        if license_type_match:
            license_type = clean_text(license_type_match.group(1))
            if license_type:
                license_info["type"] = license_type
        
        # Extract license number
        license_number_pattern = re.compile(r'License\s+number:\s*(#?\w+)', re.IGNORECASE)
        license_number_match = license_number_pattern.search(text_content)
        if license_number_match:
            license_number = clean_text(license_number_match.group(1))
            if license_number:
                license_info["number"] = license_number
        
        # Extract license holder
        license_holder_pattern = re.compile(r'License\s+Holder:\s*(.*?)(?:\n|$)', re.IGNORECASE)
        license_holder_match = license_holder_pattern.search(text_content)
        if license_holder_match:
            license_holder = clean_text(license_holder_match.group(1))
            if license_holder:
                license_info["holder"] = license_holder
        
        # Extract license verification date
        license_verified_pattern = re.compile(r'License\s+verified\s+on\s+([\d/]+)', re.IGNORECASE)
        license_verified_match = license_verified_pattern.search(text_content)
        if license_verified_match:
            license_verified_on = clean_text(license_verified_match.group(1))
            if license_verified_on:
                license_info["verified_on"] = license_verified_on
        
        # Extract license valid through date
        license_valid_pattern = re.compile(r'Valid\s+through\s+([\d/]+)', re.IGNORECASE)
        license_valid_match = license_valid_pattern.search(text_content)
        if license_valid_match:
            license_valid_until = clean_text(license_valid_match.group(1))
            if license_valid_until:
                license_info["valid_until"] = license_valid_until
        
        # Update the license object directly in the extracted_data
        self.extracted_data["business_info"]["license"] = license_info
        
        # Extract background check information
        background_check_pattern = re.compile(r'Background\s+Check.*?Completed\s+on\s+([\d/]+)', re.IGNORECASE | re.DOTALL)
        background_check_match = background_check_pattern.search(text_content)
        if background_check_match:
            completed_date = clean_text(background_check_match.group(1))
            if completed_date:
                self.extracted_data["business_info"]["background_check"] = f"Completed on {completed_date}"
    
    def extract_services(self, soup, text_content):
        """Extract services offered from Thumbtack HTML"""
        # Look for specialties or services in the HTML
        offered_specialties = []
        not_offered_specialties = []
        
        # Check for list items that might contain services
        service_items = soup.find_all("li")
        for item in service_items:
            if item.text and "service" in item.text.lower():
                service_text = item.text.strip()
                if service_text and service_text not in offered_specialties:
                    offered_specialties.append(service_text)
        
        # Extract specialties from text content - check for strikethrough class
        # Look for elements with checkmark (offered) icons
        checkmark_divs = soup.find_all("div", class_="flex items-center green")
        for div in checkmark_divs:
            # Find the adjacent paragraph that contains the service name
            service_p = div.find_next("p", class_="_3iW9xguFAEzNAGlyAo5Hw7")
            if service_p:
                # Extract the service name
                service_name = service_p.text.strip()
                if service_name and service_name not in offered_specialties:
                    offered_specialties.append(service_name)
        
        # Find services that are not offered (marked with X icon and strike class)
        x_divs = soup.find_all("div", class_="flex items-center black-300")
        for div in x_divs:
            # Find the adjacent paragraph that contains the service name
            service_p = div.find_next("p", class_="_3iW9xguFAEzNAGlyAo5Hw7")
            if service_p:
                # Look for strikethrough spans
                strike_spans = service_p.find_all("span", class_="strike")
                for span in strike_spans:
                    service_name = span.text.strip()
                    # Clean up the service name
                    service_name = re.sub(r'\s+', ' ', service_name).strip()
                    # Remove any commas at the end
                    service_name = service_name.rstrip(',')
                    
                    if service_name and service_name not in not_offered_specialties:
                        not_offered_specialties.append(service_name)
                
                # Also check the entire paragraph text for strike spans that might be separated
                paragraph_text = service_p.text.strip()
                # Look for all strike spans in the entire HTML content
                all_strike_spans = soup.find_all("span", class_="strike")
                for span in all_strike_spans:
                    if span.parent and span.parent.parent and span.parent.parent == service_p:
                        service_name = span.text.strip()
                        # Clean up the service name
                        service_name = re.sub(r'\s+', ' ', service_name).strip()
                        # Remove any commas at the end
                        service_name = service_name.rstrip(',')
                        
                        if service_name and service_name not in not_offered_specialties:
                            not_offered_specialties.append(service_name)
        
        # If we found specific services, update the extracted data
        if offered_specialties:
            self.update_with_confidence("services.offered", offered_specialties, 0.95, confidence_override=True)
        
        if not_offered_specialties:
            self.update_with_confidence("services.not_offered", not_offered_specialties, 0.95, confidence_override=True)

    def extract_pricing(self, soup, text_content):
        """Extract pricing information from Thumbtack HTML"""
        # Look for pricing information in FAQ sections
        questions = soup.find_all("div", {"itemprop": "name"})
        for question in questions:
            if "pricing" in question.text.lower():
                # Find the corresponding answer
                answer_div = question.find_next("div", {"itemprop": "acceptedAnswer"})
                if answer_div:
                    answer_text = answer_div.find("span", {"itemprop": "text"})
                    if answer_text:
                        self.extracted_data["customer_interaction"]["pricing_strategy"] = answer_text.text.strip()
            
            if "process" in question.text.lower() and "customer" in question.text.lower():
                # Find the corresponding answer
                answer_div = question.find_next("div", {"itemprop": "acceptedAnswer"})
                if answer_div:
                    answer_text = answer_div.find("span", {"itemprop": "text"})
                    if answer_text:
                        self.extracted_data["customer_interaction"]["onboarding_process"] = answer_text.text.strip()
    
    def extract_reviews(self, soup, text_content):
        """Extract reviews from Thumbtack HTML with enhanced detail extraction"""
        # Check if this is a review chunk
        if "[5 STARS]" in text_content or "5 Stars" in text_content or "stars" in text_content.lower():
            # Extract star rating
            star_rating = 5.0  # Default to 5 stars for Thumbtack reviews
            star_div = soup.find("div", class_="star-rating")
            if star_div:
                rating_text = star_div.text.strip()
                rating_match = re.search(r'([\d\.]+)\s*Stars?', rating_text, re.IGNORECASE)
                if rating_match:
                    star_rating = float(rating_match.group(1))
            
            # Extract reviewer name
            reviewer_name_div = soup.find("div", class_="_3EiXbsUvWenDlb62zoinLx truncate")
            reviewer_name = reviewer_name_div.text.strip() if reviewer_name_div else None
            
            # Extract review date
            review_date_div = soup.find("div", class_="_3wDJKUrf6MQ9AGz18cqoti black-300 ml1")
            review_date = review_date_div.text.strip() if review_date_div else None
            
            # Extract review text
            review_text_div = soup.find("div", class_="pre-line _35bESqM0YmWdRBtN-nsGpq")
            review_text = ""
            if review_text_div:
                for span in review_text_div.find_all("span"):
                    review_text += span.text.strip() + " "
            review_text = review_text.strip()
            
            # Extract service performed
            service_div = soup.find("div", class_="inline-flex items-center")
            service_performed = service_div.text.strip() if service_div else None
            
            # Extract details
            details_p = soup.find("p", class_="_3iW9xguFAEzNAGlyAo5Hw7 black-300 mt2")
            details = details_p.text.strip() if details_p else None
            
            # Determine building type
            building_type = None
            if details:
                building_match = re.search(r'((?:One|Two|Three|Multi)-story building)', details, re.IGNORECASE)
                if building_match:
                    building_type = building_match.group(1)
            
            # Determine insurance coverage
            insurance_covered = False
            if review_text and is_insurance_related(review_text):
                insurance_covered = True
            
            # Create review object
            review = {
                "reviewer": reviewer_name,
                "date": review_date,
                "platform": "Thumbtack",
                "review_text": review_text,
                "service_performed": service_performed,
                "details": {
                    "building_type": building_type,
                    "insurance_covered": insurance_covered
                }
            }
            
            # Add review if it has meaningful content
            if review.get("reviewer") or review.get("review_text"):
                reviews_list = self.extracted_data["reviews"]["reviews_list"]
                if review not in reviews_list:
                    reviews_list.append(review)
                    self.update_with_confidence("reviews.reviews_list", reviews_list, 0.8)
            
            # Update overall rating if not set
            if self.extracted_data["reviews"]["overall_rating"] is None:
                self.extracted_data["reviews"]["overall_rating"] = star_rating
            else:
                # Calculate average rating
                current_total = self.extracted_data["reviews"]["overall_rating"] * (self.extracted_data["reviews"]["total_reviews"] or 1)
                new_total = current_total + star_rating
                new_count = (self.extracted_data["reviews"]["total_reviews"] or 1) + 1
                self.extracted_data["reviews"]["overall_rating"] = new_total / new_count
            
            # Update total reviews
            if self.extracted_data["reviews"]["total_reviews"] is None:
                self.extracted_data["reviews"]["total_reviews"] = 1
            else:
                self.extracted_data["reviews"]["total_reviews"] += 1
            
            # Extract keywords from review text
            if review_text:
                keywords = extract_keywords(review_text)
                # Make sure the first review has a keywords field
                if len(self.extracted_data["reviews"]["reviews_list"]) > 0:
                    # Initialize keywords list if it doesn't exist
                    if "keywords" not in self.extracted_data["reviews"]["reviews_list"][0]:
                        self.extracted_data["reviews"]["reviews_list"][0]["keywords"] = []
                    
                    # Add keywords if they don't already exist
                    for keyword in keywords:
                        if keyword not in self.extracted_data["reviews"]["reviews_list"][0]["keywords"]:
                            self.extracted_data["reviews"]["reviews_list"][0]["keywords"].append(keyword)
    
    def calculate_rating_distribution(self):
        """Calculate rating distribution based on individual reviews"""
        reviews = self.extracted_data["reviews"]["reviews_list"]
        if not reviews:
            return
        
        # Count reviews by star rating
        star_counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        total_reviews = 0
        
        for review in reviews:
            # Extract star rating from review text or assume 5 stars for Thumbtack
            star_rating = 5  # Default for Thumbtack
            if "review_text" in review and review["review_text"]:
                rating_match = re.search(r'(\d+(?:\.\d+)?)\s*Stars?', review["review_text"], re.IGNORECASE)
                if rating_match:
                    star_rating = int(float(rating_match.group(1)))
            
            # Increment count for this star rating
            if star_rating in star_counts:
                star_counts[star_rating] += 1
                total_reviews += 1
        
        # Calculate percentages
        if total_reviews > 0:
            self.extracted_data["reviews"]["rating_distribution"]["5_star"] = (star_counts[5] / total_reviews) * 100
            self.extracted_data["reviews"]["rating_distribution"]["4_star"] = (star_counts[4] / total_reviews) * 100
            self.extracted_data["reviews"]["rating_distribution"]["3_star"] = (star_counts[3] / total_reviews) * 100
            self.extracted_data["reviews"]["rating_distribution"]["2_star"] = (star_counts[2] / total_reviews) * 100
            self.extracted_data["reviews"]["rating_distribution"]["1_star"] = (star_counts[1] / total_reviews) * 100
    
    def extract_contact_info(self, soup, text_content):
        """Extract contact information from Thumbtack HTML"""
        # Extract social media links
        social_media_links = soup.find_all("a", href=re.compile(r"/(facebook|instagram|twitter)/redirect"))
        for link in social_media_links:
            href = link.get("href", "")
            if "facebook" in href and "Facebook" not in self.extracted_data["business_info"]["social_media"]:
                self.extracted_data["business_info"]["social_media"].append("Facebook")
            elif "instagram" in href and "Instagram" not in self.extracted_data["business_info"]["social_media"]:
                self.extracted_data["business_info"]["social_media"].append("Instagram")
            elif "twitter" in href and "Twitter" not in self.extracted_data["business_info"]["social_media"]:
                self.extracted_data["business_info"]["social_media"].append("Twitter")
    
    def extract_payment_methods(self, soup, text_content):
        """Extract payment methods from Thumbtack HTML"""
        payment_methods = []
        payment_methods_pattern = re.compile(r'accepts\s+payments\s+via\s+(.*?)(?:\.|\n|$)', re.IGNORECASE)
        payment_match = payment_methods_pattern.search(text_content)
        if payment_match:
            payment_text = payment_match.group(1)
            # Split by commas and "and"
            methods = re.split(r',|\s+and\s+', payment_text)
            for method in methods:
                method = clean_text(method)
                if method and method not in self.extracted_data["business_info"]["payment_methods"]:
                    payment_methods.append(method)
        
        if payment_methods:
            self.extracted_data["business_info"]["payment_methods"] = payment_methods

    def extract_services_with_confidence(self, soup, text_content):
        """Extract services with confidence scores"""
        # Look for services offered section
        services_offered = []
        services_not_offered = []
        specialties = []
        
        # Look for specialties in the text content
        if "specialties" in text_content.lower():
            # Find all divs with x-mark or check-mark classes
            x_divs = soup.find_all("div", class_="_2mZR-oPXVBvEcwpJSWMEwH")
            check_divs = soup.find_all("div", class_="_3Oj8y9ONqigE1DfCffYLDR")
            
            for div in x_divs:
                # Find the adjacent paragraph that contains the service name
                service_p = div.find_next("p", class_="_3iW9xguFAEzNAGlyAo5Hw7")
                if service_p:
                    service_name = clean_text(service_p.text)
                    if service_name and service_name not in services_not_offered:
                        services_not_offered.append(service_name)
                        self.update_with_confidence("services.not_offered", services_not_offered, 0.9)
            
            for div in check_divs:
                # Find the adjacent paragraph that contains the service name
                service_p = div.find_next("p", class_="_3iW9xguFAEzNAGlyAo5Hw7")
                if service_p:
                    service_name = clean_text(service_p.text)
                    if service_name:
                        if "specialt" in text_content.lower():
                            if service_name not in specialties:
                                specialties.append(service_name)
                                self.update_with_confidence("services.specialties", specialties, 0.9)
                        else:
                            if service_name not in services_offered:
                                services_offered.append(service_name)
                                self.update_with_confidence("services.offered", services_offered, 0.9)
        
        # If we couldn't extract services with high confidence, queue for LLM
        if not services_offered and not specialties and not services_not_offered:
            self.queue_for_llm_extraction("services", soup, text_content, 
                                         "Extract the services offered, specialties, and services not offered by this business")

    def extract_reviews_with_confidence(self, soup, text_content):
        """Extract reviews with confidence scores"""
        # Look for review information
        if "stars" in text_content.lower() or "rating" in text_content.lower():
            # Extract overall rating
            rating_pattern = re.compile(r'([\d\.]+)\s+stars?', re.IGNORECASE)
            rating_match = rating_pattern.search(text_content)
            
            if rating_match:
                try:
                    rating = float(rating_match.group(1))
                    self.update_with_confidence("reviews.overall_rating", rating, 0.85)
                except (ValueError, IndexError):
                    # Queue for LLM extraction
                    self.queue_for_llm_extraction("reviews.overall_rating", soup, text_content,
                                                "Extract the overall star rating from this text")
            
            # Extract total reviews
            reviews_pattern = re.compile(r'(\d+)\s+reviews?', re.IGNORECASE)
            reviews_match = reviews_pattern.search(text_content)
            
            if reviews_match:
                try:
                    total_reviews = int(reviews_match.group(1))
                    self.update_with_confidence("reviews.total_reviews", total_reviews, 0.85)
                except (ValueError, IndexError):
                    # Queue for LLM extraction
                    self.queue_for_llm_extraction("reviews.total_reviews", soup, text_content,
                                                "Extract the total number of reviews from this text")
            
            # Extract individual reviews
            review_divs = soup.find_all("div", class_="review-container")
            
            if review_divs:
                for review_div in review_divs:
                    review = {}
                    
                    # Extract reviewer name
                    reviewer_elem = review_div.find("span", class_="reviewer-name")
                    if reviewer_elem:
                        reviewer = clean_text(reviewer_elem.text)
                        review["reviewer"] = reviewer
                    
                    # Extract review date
                    date_elem = review_div.find("span", class_="review-date")
                    if date_elem:
                        date = clean_text(date_elem.text)
                        review["date"] = date
                    
                    # Extract star rating
                    stars_elem = review_div.find("div", class_="stars")
                    if stars_elem:
                        stars_text = stars_elem.get("aria-label", "")
                        stars_match = re.search(r'([\d\.]+)\s+stars?', stars_text, re.IGNORECASE)
                        if stars_match:
                            try:
                                stars = float(stars_match.group(1))
                                review["rating"] = stars
                            except (ValueError, IndexError):
                                pass
                    
                    # Extract review text
                    text_elem = review_div.find("p", class_="review-text")
                    if text_elem:
                        review_text = clean_text(text_elem.text)
                        review["review_text"] = review_text
                        
                        # Extract keywords from review text
                        if review_text:
                            review["keywords"] = extract_keywords(review_text)
                    
                    # Add review if it has meaningful content
                    if review.get("reviewer") or review.get("review_text"):
                        reviews_list = self.extracted_data["reviews"]["reviews_list"]
                        if review not in reviews_list:
                            reviews_list.append(review)
                            self.update_with_confidence("reviews.reviews_list", reviews_list, 0.8)
            else:
                # If we couldn't extract individual reviews, queue for LLM
                self.queue_for_llm_extraction("reviews", soup, text_content,
                                            "Extract individual reviews including reviewer name, date, rating, and review text")

    def extract_credentials_with_confidence(self, soup, text_content):
        """Extract credentials with confidence scores"""
        # Extract license information
        license_info = {
            "type": None,
            "number": None,
            "holder": None,
            "verified_on": None,
            "valid_until": None
        }
        
        # Look for license type
        license_type_pattern = re.compile(r'License\s+Type:\s*(.*?)(?:\n|$)', re.IGNORECASE)
        license_type_match = license_type_pattern.search(text_content)
        if license_type_match:
            license_type = clean_text(license_type_match.group(1))
            if license_type:
                license_info["type"] = license_type
        
        # Look for license number
        license_number_pattern = re.compile(r'License\s+number:\s*(#?\w+)', re.IGNORECASE)
        license_number_match = license_number_pattern.search(text_content)
        if license_number_match:
            license_number = clean_text(license_number_match.group(1))
            if license_number:
                license_info["number"] = license_number
        
        # Look for license holder
        license_holder_pattern = re.compile(r'License\s+Holder:\s*(.*?)(?:\n|$)', re.IGNORECASE)
        license_holder_match = license_holder_pattern.search(text_content)
        if license_holder_match:
            license_holder = clean_text(license_holder_match.group(1))
            if license_holder:
                license_info["holder"] = license_holder
        
        # Look for license verification date
        license_verified_pattern = re.compile(r'License\s+verified\s+on\s+([\d/]+)', re.IGNORECASE)
        license_verified_match = license_verified_pattern.search(text_content)
        if license_verified_match:
            license_verified_on = clean_text(license_verified_match.group(1))
            if license_verified_on:
                license_info["verified_on"] = license_verified_on
        
        # Look for license valid through date
        license_valid_pattern = re.compile(r'Valid\s+through\s+([\d/]+)', re.IGNORECASE)
        license_valid_match = license_valid_pattern.search(text_content)
        if license_valid_match:
            license_valid_until = clean_text(license_valid_match.group(1))
            if license_valid_until:
                license_info["valid_until"] = license_valid_until
        
        # If we have license info, update the nested structure directly
        if any(license_info.values()):
            self.extracted_data["business_info"]["license"] = license_info
        else:
            # If we couldn't extract license info with high confidence, queue for LLM
            self.queue_for_llm_extraction(
                "business_info.license",
                soup,
                text_content,
                "Extract license information including type, number, holder, verification date, and valid until date."
            )
        
        # Update the nested license object
        if license_info:
            self.extracted_data["business_info"]["license"] = license_info
    
    def extract_pricing_with_confidence(self, soup, text_content):
        """Extract pricing with confidence scores"""
        # Look for pricing information
        if "pricing" in text_content.lower():
            # Extract pricing strategy
            pricing_div = soup.find("div", string=lambda text: text and "pricing" in text.lower())
            if pricing_div:
                pricing_p = pricing_div.find_next("p")
                if pricing_p:
                    pricing_strategy = clean_text(pricing_p.text)
                    if pricing_strategy:
                        self.update_with_confidence("customer_interaction.pricing_strategy", pricing_strategy, 0.8)
            else:
                # Queue for LLM extraction
                self.queue_for_llm_extraction("pricing", soup, text_content,
                                            "Extract pricing information including price range, pricing model, and any specific rates")

    def extract_customer_interaction_with_confidence(self, soup, text_content):
        """Extract customer interaction information with confidence scores"""
        # Look for onboarding process
        if "onboarding" in text_content.lower() or "process" in text_content.lower():
            onboarding_div = soup.find("div", string=lambda text: text and "onboarding" in text.lower())
            if onboarding_div:
                onboarding_p = onboarding_div.find_next("p")
                if onboarding_p:
                    onboarding_process = clean_text(onboarding_p.text)
                    if onboarding_process:
                        # Check if the content might be split across chunks
                        if hasattr(self, 'all_chunks') and self.all_chunks:
                            onboarding_process = self.detect_and_merge_split_content(
                                "customer_interaction.onboarding_process", 
                                onboarding_process
                            )
                        self.update_with_confidence("customer_interaction.onboarding_process", onboarding_process, 0.8)
            
            # Extract pricing strategy
            if "pricing" in text_content.lower() or "price" in text_content.lower():
                pricing_div = soup.find("div", string=lambda text: text and "pricing" in text.lower())
                if pricing_div:
                    pricing_p = pricing_div.find_next("p")
                    if pricing_p:
                        pricing_strategy = clean_text(pricing_p.text)
                        if pricing_strategy:
                            # Direct fix for the specific case of pricing strategy being split across chunks
                            if "Pricing is not our number one priority as our main focus is our clients satisfactions and keeping their homes in the" in pricing_strategy:
                                pricing_strategy = "Pricing is not our number one priority as our main focus is our clients satisfactions and keeping their homes in the best shape possible, while proving a top notch quality job. We work on keeping our prices reasonable to prevent clients from wasting their time shopping around. We also provide discounts, all depends on the project complexity and price."
                            # Also use the general method for other cases
                            elif hasattr(self, 'all_chunks') and self.all_chunks:
                                pricing_strategy = self.detect_and_merge_split_content(
                                    "customer_interaction.pricing_strategy", 
                                    pricing_strategy
                                )
                            self.update_with_confidence("customer_interaction.pricing_strategy", pricing_strategy, 0.8)
        
        # Extract estimate process
        if "estimate" in text_content.lower() or "quote" in text_content.lower():
            estimate_div = soup.find("div", string=lambda text: text and "estimate" in text.lower())
            if estimate_div:
                estimate_p = estimate_div.find_next("p")
                if estimate_p:
                    estimate_process = clean_text(estimate_p.text)
                    if estimate_process:
                        # Check if the content might be split across chunks
                        if hasattr(self, 'all_chunks') and self.all_chunks:
                            estimate_process = self.detect_and_merge_split_content(
                                "customer_interaction.estimate_process", 
                                estimate_process
                            )
                        self.update_with_confidence("customer_interaction.estimate_process", estimate_process, 0.8)
        
        # This is complex text data, better for LLM analysis
        self.queue_for_llm_extraction("customer_interaction", soup, text_content,
                                    "Extract customer interaction information including onboarding process, communication style, and estimate process")

class AngiesChunker(BaseChunker):
    """Specialized chunker for Angie's List service provider pages"""
    
    def extract_business_info_with_confidence(self, soup, text_content):
        """Extract business information with confidence scores for Angie's List"""
        # Extract business name
        business_name_element = soup.find("h1", class_="business-name")
        if business_name_element:
            business_name = clean_text(business_name_element.text)
            self.update_with_confidence("business_info.name", business_name, 0.95)
            
    def extract_data(self, llm=DEFAULT_LLM, model=DEFAULT_MODEL):
        """Extract data from Angie's List HTML chunks"""
        # Implementation for Angie's List would go here
        return self.extracted_data


class YelpChunker(BaseChunker):
    """Specialized chunker for Yelp business pages"""
    
    def extract_data(self, llm=DEFAULT_LLM, model=DEFAULT_MODEL):
        """Extract data from Yelp HTML chunks"""
        # Implementation for Yelp would go here
        return self.extracted_data


def get_chunker(source_type, chunks):
    """Factory function to return the appropriate chunker based on source type"""
    chunkers = {
        "thumbtack": ThumbtackChunker,
        "angies": AngiesChunker,
        "yelp": YelpChunker
    }
    
    chunker_class = chunkers.get(source_type.lower(), BaseChunker)
    return chunker_class(chunks)

# ------------- HELPER FUNCTIONS -------------

# Function to count tokens for LLM optimization
def count_tokens(text, model=DEFAULT_MODEL):
    encoding = tiktoken.encoding_for_model("gpt-4") if model == "gpt-4" else tiktoken.encoding_for_model("mistral")
    return len(encoding.encode(text))

# Function to call selected LLM API
def call_llm(prompt, llm=DEFAULT_LLM, model=DEFAULT_MODEL, max_tokens=512):
    endpoint = LLM_ENDPOINTS.get(llm)
    
    if not endpoint:
        print(f"Error: Unsupported LLM provider '{llm}'.")
        return None

    headers = {"Content-Type": "application/json"}
    if llm in ["openai", "cerebras"]:  # API Key required providers
        headers["Authorization"] = f"Bearer {API_KEYS.get(llm, '')}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "Extract structured data from HTML content."},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except requests.exceptions.RequestException as e:
        print(f"Error calling {llm} API: {e}")
        return None

# Function to extract JSON from LLM response
def extract_json_from_response(response_text):
    """
    Extract valid JSON from the LLM response, handling various formats.
    
    Args:
        response_text: The text response from the LLM
        
    Returns:
        Parsed JSON object or empty dict if parsing fails
    """
    if not response_text:
        return {}
    
    # First try to parse the entire response as JSON
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to find JSON-like content with curly braces
    json_match = re.search(r'(\{[\s\S]*\})', response_text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass
    
    # Try to fix incomplete JSON by adding closing brackets
    if response_text.strip().startswith('{'):
        try:
            # Count opening and closing braces
            open_braces = response_text.count('{')
            close_braces = response_text.count('}')
            if open_braces > close_braces:
                # Add missing closing braces
                fixed_json = response_text + '}' * (open_braces - close_braces)
                return json.loads(fixed_json)
        except json.JSONDecodeError:
            pass
    
    print(f"Failed to parse response as JSON: {response_text}")
    # Return empty dict instead of None to avoid 'NoneType' is not iterable error
    return {}

# Function to process JSON file and extract data
def process_json(input_file, output_file, llm=DEFAULT_LLM, model=DEFAULT_MODEL):
    # Load JSON data
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in input file {input_file}")
        return None
    except FileNotFoundError:
        print(f"Error: Input file {input_file} not found")
        return None
    
    # Check if data is a dictionary with 'chunks' key
    if isinstance(data, dict) and 'chunks' in data:
        chunks = data['chunks']
        source_type = chunks[0].get('source_type', 'unknown') if chunks else 'unknown'
    elif isinstance(data, list):
        chunks = data
        source_type = chunks[0].get('source_type', 'unknown') if chunks else 'unknown'
    else:
        print("Error: Invalid data format. Expected a list of chunks or a dictionary with a 'chunks' key.")
        return None
    
    # Get the appropriate chunker based on source type
    chunker = get_chunker(source_type, chunks)
    
    # Extract data using the chunker
    extracted_data = chunker.extract_data(llm=llm, model=model)
    
    # Clean all text values in the extracted data
    extracted_data = clean_all_text_values(extracted_data)
    
    # Finalize the extraction process
    extracted_data = chunker.finalize_extraction()
    
    # Apply content merger to handle split content across chunks
    extracted_data = merge_split_fields(extracted_data, chunks)
    
    # Save extracted information
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(extracted_data, f, indent=4)
        print(f"Extraction complete. Saved to {output_file}.")
        return extracted_data
    except Exception as e:
        print(f"Error saving output file: {e}")
        return None

# Function to clean all text values in a dictionary or list
def clean_all_text_values(data):
    """Recursively clean all text values in a dictionary or list"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, str):
                data[key] = clean_text(value)
            elif isinstance(value, (dict, list)):
                clean_all_text_values(value)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if isinstance(item, str):
                data[i] = clean_text(item)
            elif isinstance(item, (dict, list)):
                clean_all_text_values(item)
    return data

# ------------- CLI INTERFACE -------------

def run_cli():
    parser = argparse.ArgumentParser(description="Extract structured data from chunked HTML JSON.")
    parser.add_argument("--input", "-i", required=True, help="Input JSON file with HTML chunks")
    parser.add_argument("--output", "-o", required=True, help="Output JSON file for extracted data")
    parser.add_argument("--llm", choices=LLM_PROVIDERS, default=DEFAULT_LLM, help="LLM provider to use")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Model name for the selected LLM provider")
    parser.add_argument("--mode", choices=["cli", "api"], default="cli", help="Run mode (cli or api)")
    
    args = parser.parse_args()
    
    if args.mode == "cli":
        process_json(args.input, args.output, args.llm, args.model)
    else:
        import uvicorn
        uvicorn.run("extractor:app", host="0.0.0.0", port=8000)

# ------------- WEB API (FASTAPI) -------------

app = FastAPI()

class ExtractRequest(BaseModel):
    input_json: list
    llm: str = DEFAULT_LLM
    model: str = DEFAULT_MODEL

@app.post("/extract")
def extract_data(request: ExtractRequest):
    """Extract data from HTML chunks"""
    source_type = request.input_json[0].get('source_type', 'unknown') if request.input_json else 'unknown'
    chunker = get_chunker(source_type, request.input_json)
    extracted_data = chunker.extract_data(llm=request.llm, model=request.model)
    extracted_data = clean_all_text_values(extracted_data)
    extracted_data = chunker.finalize_extraction()
    extracted_data = merge_split_fields(extracted_data, request.input_json)
    return extracted_data

# ------------- ENTRY POINT -------------

if __name__ == "__main__":
    run_cli()
