from typing import Optional

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
