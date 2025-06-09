import pdb
import os
import pyperclip
from typing import Optional, Type
from pydantic import BaseModel
from browser_use.agent.views import ActionResult
from browser_use.browser.context import BrowserContext
from browser_use.controller.service import Controller, DoneAction
from main_content_extractor import MainContentExtractor
from browser_use.controller.views import (
    ClickElementAction,
    DoneAction,
    ExtractPageContentAction,
    GoToUrlAction,
    InputTextAction,
    OpenTabAction,
    ScrollAction,
    SearchGoogleAction,
    SendKeysAction,
    SwitchTabAction,
)
from .custom_views import ClickElementByXpathAction, ClickIframeElementByXpathAction, CopyIframeHtmlAction, InputIframeTextByXpathAction
import logging
import requests

logger = logging.getLogger(__name__)


class CustomController(Controller):
    def __init__(self, exclude_actions: list[str] = [],
                 output_model: Optional[Type[BaseModel]] = None
                 ):
        super().__init__(exclude_actions=exclude_actions, output_model=output_model)
        self._register_custom_actions()

    def _register_custom_actions(self):
        """Register all custom browser actions"""

        @self.registry.action("Copy text to clipboard")
        def copy_to_clipboard(text: str):
            pyperclip.copy(text)
            return ActionResult(extracted_content=text)

        @self.registry.action("Paste text from clipboard")
        async def paste_from_clipboard(browser: BrowserContext):
            text = pyperclip.paste()
            # send text to browser
            page = await browser.get_current_page()
            await page.keyboard.type(text)

            return ActionResult(extracted_content=text)
            
        @self.registry.action("Post HTML to API endpoint")
        async def post_html_to_api(browser: BrowserContext, api_endpoint: Optional[str] = None):
            """
            Post HTML from the current page and post it to the specified API endpoint.
            If no endpoint is provided, uses the default endpoint from environment variables.
            """
            try:
                # Extract HTML content
                page = await browser.get_current_page()
                url = page.url
                html_content = await page.evaluate("() => document.documentElement.outerHTML")

                # Determine endpoint
                endpoint = api_endpoint or os.getenv("HTML_EXTRACTION_API_ENDPOINT", "")
                if not endpoint:
                    logger.warning("No API endpoint provided for HTML extraction")
                    return ActionResult(
                        extracted_content="HTML extraction completed but no API endpoint was provided for posting",
                        error="No API endpoint configured"
                    )

                # Prepare payload and headers
                payload = {"html": html_content, "source_url": url, "timestamp": None}
                headers = {"Content-Type": "application/json"}
                auth_token = os.getenv("HTML_EXTRACTION_API_TOKEN")
                if auth_token:
                    headers["Authorization"] = f"Bearer {auth_token}"

                # Post to API
                logger.info(f"Posting HTML to API endpoint: {endpoint}")
                response = requests.post(endpoint, json=payload, headers=headers)
                if response.status_code >= 400:
                    logger.error(f"API error: {response.status_code} - {response.text}")
                else:
                    logger.info(f"HTML successfully posted to API: {response.status_code}")

                # Return result
                return ActionResult(
                    extracted_content=f"HTML successfully extracted from {url} and posted to {endpoint}",
                    metadata={
                        "url": url,
                        "api_endpoint": endpoint,
                        "response_status": response.status_code,
                        "response_text": response.text[:100] + "..." if len(response.text) > 100 else response.text
                    }
                )
            except Exception as e:
                logger.error(f"Error extracting and posting HTML: {str(e)}")
                return ActionResult(
                    error=f"Failed to extract and post HTML: {str(e)}",
                    extracted_content="HTML extraction failed"
                )

        """
        Implementation for the click_element_by_xpath method.

        This file contains the implementation of the method to click on an element by xpath.
        Copy this implementation into the _register_custom_actions method of your CustomController class.
        """

        #@self.registry.action('Click on element by XPath (that is NOT within an IFRAME)', param_model=ClickElementByXpathAction)
        async def click_element_by_xpath(params: ClickElementByXpathAction, browser: BrowserContext):
            try:
                element_node = await browser.get_locate_element_by_xpath(params.xpath)
                if element_node:
                    try:
                        await element_node.scroll_into_view_if_needed()
                        await element_node.click(timeout=1500, force=True)
                    except Exception:
                        try:
                            # Handle with js evaluate if fails to click using playwright
                            await element_node.evaluate('el => el.click()')
                        except Exception as e:
                            logger.warning(f"Element not clickable with xpath '{params.xpath}' - {e}")
                            return ActionResult(error=str(e))
                    msg = f'🖱️  Clicked on element with text "{params.xpath}"'
                    return ActionResult(extracted_content=msg, include_in_memory=True)
            except Exception as e:
                logger.warning(f'Element not clickable with XPath {params.xpath} - most likely the page changed')
                return ActionResult(error=str(e))
                
        #@self.registry.action('Click on element that is within an IFRAME', param_model=ClickIframeElementByXpathAction)
        async def click_iframe_element_by_xpath(params: ClickIframeElementByXpathAction, browser: BrowserContext):
            try:
                # Get the current page
                page = await browser.get_current_page()
                
                # First locate the iframe using the provided XPath
                iframe_element = page.locator(f"xpath={params.iframe_xpath}")
                if await iframe_element.count() == 0:
                    logger.warning(f"Iframe not found with xpath '{params.iframe_xpath}'")
                    return ActionResult(error=f"Iframe not found with xpath '{params.iframe_xpath}'")
                
                # Create a frame locator for the iframe
                frame_locator = page.frame_locator(f"xpath={params.iframe_xpath}")
                
                # Now locate the element inside the iframe
                element_inside_iframe = frame_locator.locator(f"xpath={params.element_xpath}")
                
                # Check if the element exists
                if await element_inside_iframe.count() == 0:
                    logger.warning(f"Element not found inside iframe with xpath '{params.element_xpath}'")
                    return ActionResult(error=f"Element not found inside iframe with xpath '{params.element_xpath}'")
                
                # Try to scroll the element into view (if possible)
                try:
                    await element_inside_iframe.scroll_into_view_if_needed()
                except Exception:
                    # Ignore scroll errors, we'll still try to click
                    pass
                
                # Try to click the element
                try:
                    await element_inside_iframe.click(timeout=1500, force=True)
                except Exception as e:
                    try:
                        # Try with JavaScript if regular click fails
                        await element_inside_iframe.evaluate('el => el.click()')
                    except Exception as js_error:
                        logger.warning(f"Element inside iframe not clickable - {js_error}")
                        return ActionResult(error=f"Failed to click element inside iframe: {str(js_error)}")
                
                msg = f'🖱️  Clicked on element inside iframe (iframe: "{params.iframe_xpath}", element: "{params.element_xpath}")'  
                return ActionResult(extracted_content=msg, include_in_memory=True)
            except Exception as e:
                logger.warning(f"Error clicking element inside iframe: {e}")
                return ActionResult(error=str(e))
            
        #@self.registry.action('Copy HTML from IFRAME', param_model=CopyIframeHtmlAction)
        async def copy_iframe_html(params: CopyIframeHtmlAction, browser: BrowserContext):
            try:
                # Get the current page
                page = await browser.get_current_page()
                
                # First locate the iframe using the provided XPath
                iframe_element = page.locator(f"xpath={params.iframe_xpath}")
                if await iframe_element.count() == 0:
                    logger.warning(f"Iframe not found with xpath '{params.iframe_xpath}'")
                    return ActionResult(error=f"Iframe not found with xpath '{params.iframe_xpath}'")
                
                # Try to get the content frame directly from the iframe element
                try:
                    # Wait for the iframe to be visible
                    await page.wait_for_selector(f"xpath={params.iframe_xpath}", state="visible", timeout=5000)
                    
                    # Get the content frame from the iframe element
                    target_frame = await iframe_element.content_frame()
                    
                    if target_frame:
                        # Extract the HTML content from the iframe
                        html_content = await target_frame.evaluate("() => document.documentElement.innerHTML")
                        logger.info(f"copy_iframe_html - Extracted HTML content from iframe (direct method)")
                        logger.info(f"{html_content}")
                        return ActionResult(
                            extracted_content=html_content,
                            include_in_memory=True,
                            metadata={
                                "iframe_xpath": params.iframe_xpath,
                                "content_type": "html",
                                "method": "content_frame"
                            }
                        )
                except Exception as e:
                    logger.warning(f"Error getting iframe content frame: {e}")
                    # Continue to try other methods
                
                # Try to find the frame by name or id
                try:
                    frame_name = await iframe_element.get_attribute("name") or ""
                    frame_id = await iframe_element.get_attribute("id") or ""
                    
                    if frame_name or frame_id:
                        for frame in page.frames:
                            if (frame_name and frame.name == frame_name) or (frame_id and frame_id in frame.url):
                                # Extract the HTML content from the iframe
                                html_content = await frame.evaluate("() => document.documentElement.innerHTML")
                                logger.info(f"copy_iframe_html - Extracted HTML content from iframe (name or id method)")
                                logger.info(f"{html_content}")
                                return ActionResult(
                                    extracted_content=html_content,
                                    include_in_memory=True,
                                    metadata={
                                        "iframe_xpath": params.iframe_xpath,
                                        "content_type": "html",
                                        "method": "frame_by_name_or_id"
                                    }
                                )
                except Exception as e:
                    logger.warning(f"Error finding frame by name or id: {e}")
                    # Continue to try other methods
                
                # As a last resort, try to use JavaScript to get the iframe content
                try:
                    # Use JavaScript to access the iframe content
                    js_script = f"""
                    (function() {{
                        const iframe = document.evaluate('{params.iframe_xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                        if (!iframe) return null;
                        try {{
                            return iframe.contentDocument.documentElement.innerHTML;
                        }} catch (e) {{
                            return null;
                        }}
                    }})();
                    """
                    
                    html_content = await page.evaluate(js_script)
                    logger.info(f"copy_iframe_html - Extracted HTML content from iframe (javascript method)")
                    logger.info(f"{html_content}")
                    if html_content:
                        return ActionResult(
                            extracted_content=html_content,
                            include_in_memory=True,
                            metadata={
                                "iframe_xpath": params.iframe_xpath,
                                "content_type": "html",
                                "method": "javascript"
                            }
                        )
                except Exception as e:
                    logger.warning(f"Error extracting HTML using JavaScript: {e}")
                    # Continue to last method
                
                # If we've tried all methods and none worked, return an error
                return ActionResult(error="Could not extract HTML from iframe: All methods failed")
                    
            except Exception as e:
                logger.warning(f"Error extracting HTML from iframe: {e}")
                return ActionResult(error=str(e))

        """
        Implementation for the input_iframe_text_by_xpath method.

        This file contains the implementation of the method to input text in an element inside an iframe.
        Copy this implementation into the _register_custom_actions method of your CustomController class.
        """

        #@self.registry.action('Input text in element that is within an IFRAME', param_model=InputIframeTextByXpathAction)
        async def input_iframe_text_by_xpath(params: InputIframeTextByXpathAction, browser: BrowserContext):
            try:
                # Get the current page
                page = await browser.get_current_page()
                
                # First locate the iframe using the provided XPath
                iframe_element = page.locator(f"xpath={params.iframe_xpath}")
                if await iframe_element.count() == 0:
                    logger.warning(f"Iframe not found with xpath '{params.iframe_xpath}'")
                    return ActionResult(error=f"Iframe not found with xpath '{params.iframe_xpath}'")
                
                # Create a frame locator for the iframe
                frame_locator = page.frame_locator(f"xpath={params.iframe_xpath}")
                
                # Now locate the input element inside the iframe
                element_inside_iframe = frame_locator.locator(f"xpath={params.element_xpath}")
                
                # Check if the element exists
                if await element_inside_iframe.count() == 0:
                    logger.warning(f"Input element not found inside iframe with xpath '{params.element_xpath}'")
                    return ActionResult(error=f"Input element not found inside iframe with xpath '{params.element_xpath}'")
                
                # Try to scroll the element into view (if possible)
                try:
                    await element_inside_iframe.scroll_into_view_if_needed()
                except Exception:
                    # Ignore scroll errors, we'll still try to input text
                    pass
                
                # Clear the input field first (if it's an input or textarea)
                try:
                    await element_inside_iframe.fill('')
                except Exception:
                    # If fill fails, try to clear using other methods
                    try:
                        # Try triple-click to select all text and then delete
                        await element_inside_iframe.click(click_count=3)
                        await page.keyboard.press('Backspace')
                    except Exception:
                        # Ignore clearing errors, we'll still try to input text
                        pass
                
                # Input the text
                try:
                    await element_inside_iframe.fill(params.text)
                except Exception as e:
                    try:
                        # Try with type method if fill fails
                        await element_inside_iframe.type(params.text)
                    except Exception as type_error:
                        try:
                            # Try with JavaScript as last resort
                            await element_inside_iframe.evaluate(f'el => el.value = "{params.text}"')
                        except Exception as js_error:
                            logger.warning(f"Failed to input text using all methods: {js_error}")
                            return ActionResult(error=f"Failed to input text in element inside iframe: {str(js_error)}")
                
                msg = f'⌨️  Input text in element inside iframe (iframe: "{params.iframe_xpath}", element: "{params.element_xpath}", text: "{params.text}")'  
                return ActionResult(extracted_content=msg, include_in_memory=True)
            except Exception as e:
                logger.warning(f"Error inputting text in element inside iframe: {e}")
                return ActionResult(error=str(e))

            
        @self.registry.action("Save scraped HTML to API endpoint")
        async def save_scraped_html(browser: BrowserContext, property_id: str, source_name: str, scrape_type: str = "RAW_CONTENT"):
            """
            Save HTML from the current page to the specified API endpoint.
            """
            try:
                # Extract HTML content
                page = await browser.get_current_page()
                url = page.url
                html_content = await page.evaluate("() => document.documentElement.outerHTML")

                # Determine endpoint
                base_url = os.getenv("BROWSER_USE_SCRAPED_API_BASE_URL", "http://api:8050/api/properties/")
                endpoint = f"{base_url}{property_id}/scraped-data/"

                if not endpoint:
                    logger.warning("No API endpoint provided for HTML extraction")
                    return ActionResult(
                        extracted_content="HTML extraction completed but no API endpoint was provided for posting",
                        error="No API endpoint configured"
                    )

                # Prepare payload and headers
                payload = {
                    "raw_html": html_content,
                    "source_url": url,
                    "source_name": source_name,
                    "scrape_type": scrape_type,
                    # 'scrape_status' will default to 'pending' in the model if not provided
                    # 'processed_data' will default to {} in the model if not provided
                }
                headers = {"Content-Type": "application/json"}
                auth_token = os.getenv("BROWSER_USE_ACCOUNT_TOKEN")
                if auth_token:
                    headers["Authorization"] = f"Token {auth_token}"

                # Post to API
                logger.info(f"Posting HTML to API endpoint: {endpoint}")
                response = requests.post(endpoint, json=payload, headers=headers)
                if response.status_code >= 400:
                    logger.error(f"API error: {response.status_code} - {response.text}")
                else:
                    logger.info(f"HTML successfully posted to API: {response.status_code}")

                # Return result
                return ActionResult(
                    extracted_content=f"HTML successfully extracted from {url} and posted to {endpoint}",
                    metadata={
                        "url": url,
                        "api_endpoint": endpoint,
                        "response_status": response.status_code,
                        "response_text": response.text[:100] + "..." if len(response.text) > 100 else response.text
                    }
                )
            except Exception as e:
                logger.error(f"Error extracting and posting HTML: {str(e)}")
                return ActionResult(
                    error=f"Failed to extract and post HTML: {str(e)}",
                    extracted_content="HTML extraction failed"
                )