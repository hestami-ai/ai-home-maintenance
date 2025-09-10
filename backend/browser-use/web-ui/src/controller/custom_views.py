from typing import Optional, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

class ClickElementByXpathAction(BaseModel):
	xpath: str


class ClickIframeElementByXpathAction(BaseModel):
	"""Action to click an element inside an iframe.
	
	Parameters:
		iframe_xpath: XPath to locate the iframe element
		element_xpath: XPath to locate the element inside the iframe
	"""
	iframe_xpath: str = Field(..., description="XPath to locate the iframe element")
	element_xpath: str = Field(..., description="XPath to locate the element inside the iframe")


class CopyIframeHtmlAction(BaseModel):
	"""Action to extract HTML content from an iframe.
	
	Parameters:
		iframe_xpath: XPath to locate the iframe element
	"""
	iframe_xpath: str = Field(..., description="XPath to locate the iframe element")


class InputIframeTextByXpathAction(BaseModel):
	"""Action to input text in an element inside an iframe using XPath.
	
	Parameters:
		iframe_xpath: XPath to locate the iframe element
		element_xpath: XPath to locate the input element inside the iframe
		text: Text to input into the element
	"""
	iframe_xpath: str = Field(..., description="XPath to locate the iframe element")
	element_xpath: str = Field(..., description="XPath to locate the input element inside the iframe")
	text: str = Field(..., description="Text to input into the element")


class ClickNextPageButtonAction(BaseModel):
	"""Action to click the next page button identified by id 'link-NextPage'.
	
	This action finds and clicks the next page button, checking if it's disabled first.
	If the button is disabled (parent li has class 'disabled'), it will return a message
	indicating that the last page has been reached.
	"""
	model_config = ConfigDict(extra="forbid")
	
	# No parameters needed as the button is identified by a fixed ID


class SaveScrapedHtmlAction(BaseModel):
	"""Action to save scraped HTML from the current page to the API endpoint.
	
	Parameters:
		property_id: UUID of the property to associate the scraped data with
		source_name: Name of the source website (e.g., 'county_permits', 'zillow')
		scrape_type: Type of scrape (default: 'RAW_CONTENT')
		tracking_id: Optional tracking ID to link related scrapes (default: None)
	"""
	property_id: str = Field(..., description="UUID of the property to associate the scraped data with")
	source_name: str = Field(..., description="Name of the source website (e.g., 'county_permits', 'zillow')")
	scrape_type: str = Field(default="RAW_CONTENT", description="Type of scrape (RAW_CONTENT, PROCESSED_DATA, etc.)")
	tracking_id: Optional[str] = Field(default=None, description="Optional tracking ID to link related scrapes")
	
	@model_validator(mode='after')
	def validate_property_id(self):
		"""Validate that property_id is a valid UUID format"""
		# Simple validation to ensure it looks like a UUID
		if not self.property_id or len(self.property_id) < 32:
			raise ValueError("property_id must be a valid UUID")
		return self


class ScrapeAllPagesAction(BaseModel):
	"""Action to scrape all pages by saving the HTML from each page and clicking next until the last page.
	
	This combined action will:
	1. Save the HTML from the current page
	2. Click the next page button
	3. Repeat until the last page is reached (next button is disabled)
	
	Parameters:
		property_id: UUID of the property to associate the scraped data with
		source_name: Name of the source website (e.g., 'county_permits', 'zillow')
		scrape_type: Type of scrape (default: 'RAW_CONTENT')
		tracking_id: Optional tracking ID to link related scrapes (default: None)
		max_pages: Maximum number of pages to scrape (default: 20)
		wait_time: Time to wait between pages in seconds (default: 2)
	"""
	property_id: str = Field(..., description="UUID of the property to associate the scraped data with")
	source_name: str = Field(..., description="Name of the source website (e.g., 'county_permits', 'zillow')")
	source_state: str = Field(..., description="Name of the state (e.g., 'VA')")
	scrape_type: str = Field(default="RAW_CONTENT", description="Type of scrape (RAW_CONTENT, PROCESSED_DATA, etc.)")
	tracking_id: Optional[str] = Field(default=None, description="Optional tracking ID to link related scrapes")
	max_pages: int = Field(default=20, description="Maximum number of pages to scrape")
	wait_time: int = Field(default=2, description="Time to wait between pages in seconds")
	
	@model_validator(mode='after')
	def validate_property_id(self):
		"""Validate that property_id is a valid UUID format"""
		# Simple validation to ensure it looks like a UUID
		if not self.property_id or len(self.property_id) < 32:
			raise ValueError("property_id must be a valid UUID")
		return self
