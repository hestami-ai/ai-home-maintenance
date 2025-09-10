import pdb
import os
import json
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
from .custom_views import ClickElementByXpathAction, ClickIframeElementByXpathAction, CopyIframeHtmlAction, InputIframeTextByXpathAction, ClickNextPageButtonAction, SaveScrapedHtmlAction, ScrapeAllPagesAction
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
                
        @self.registry.action("Jump to bottom of page")
        async def jump_to_bottom_of_page(browser: BrowserContext):
            """
            Jumps to the bottom of the current page using JavaScript.
            Useful for loading lazy-loaded content or triggering events that happen on scroll.
            """
            try:
                page = await browser.get_current_page()
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
                return ActionResult(
                    extracted_content="Successfully jumped to the bottom of the page",
                    include_in_memory=True
                )
            except Exception as e:
                logger.warning(f"Error jumping to bottom of page: {str(e)}")
                return ActionResult(error=f"Failed to jump to bottom: {str(e)}")
                
        @self.registry.action("Click next page button", param_model=ClickNextPageButtonAction)
        async def click_next_page_button(params: ClickNextPageButtonAction, browser: BrowserContext):
            """
            Finds and clicks the next page button with id "link-NextPage".
            Useful for navigating through paginated content.
            Checks if the parent li element has a 'disabled' class and returns appropriate message.
            """
            try:
                page = await browser.get_current_page()
                # Try to find the next page button by its ID
                next_button = await page.query_selector('#link-NextPage')
                
                if not next_button:
                    logger.warning("Next page button not found with id 'link-NextPage'")
                    return ActionResult(
                        error="Next page button not found",
                        extracted_content="Could not find next page button with id 'link-NextPage'"
                    )
                
                # Check if the parent li element has the 'disabled' class
                is_disabled = await page.evaluate("""
                    () => {
                        const button = document.getElementById('link-NextPage');
                        if (!button) return true; // Consider not found as disabled
                        
                        // Check if the parent li has the 'disabled' class
                        const parentLi = button.closest('li');
                        return parentLi && parentLi.classList.contains('disabled');
                    }
                """)
                
                if is_disabled:
                    logger.info("Next page button is disabled (no more pages)")
                    return ActionResult(
                        extracted_content="Reached the last page - next button is disabled",
                        include_in_memory=True
                    )
                
                # First try to scroll it into view
                await next_button.scroll_into_view_if_needed()
                
                # Try to click the button
                try:
                    await next_button.click(timeout=2000)
                    logger.info("Successfully clicked next page button")
                except Exception as click_error:
                    # If direct click fails, try JavaScript click
                    logger.warning(f"Direct click failed, trying JavaScript click: {str(click_error)}")
                    await page.evaluate("document.getElementById('link-NextPage').click()")
                    
                # Wait a moment for page to load
                await page.wait_for_timeout(1000)
                
                return ActionResult(
                    extracted_content="Successfully clicked next page button",
                    include_in_memory=True
                )
            except Exception as e:
                logger.warning(f"Error clicking next page button: {str(e)}")
                return ActionResult(error=f"Failed to click next page button: {str(e)}")
                

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

        @self.registry.action("Scrape all pages until last page", param_model=ScrapeAllPagesAction)
        async def scrape_all_pages(params: ScrapeAllPagesAction, browser: BrowserContext):
            """
            Combined action that scrapes HTML from all pages by dispatching to the appropriate
            scraping implementation based on the state and source_name parameters.
            
            The function name is generated using the pattern: {STATE}_{COUNTY}_Scrape_All_Pages
            where spaces in county name are replaced with underscores.
            
            This eliminates the need for the LLM to coordinate multiple actions and allows for
            county/state-specific scraping implementations.
            """
            try:
                # Generate the scrape function name based on state and source_name
                # Replace spaces with underscores in the county name
                county_name = params.source_name.replace(' ', '_')
                scrape_function_name = f"{params.source_state}_{county_name}_Scrape_All_Pages"
                
                # Access the controller instance through the closure
                controller = self  # This captures self from the enclosing scope
                
                # Check if the function exists in this class
                if hasattr(controller, scrape_function_name) and callable(getattr(controller, scrape_function_name)):
                    # Call the appropriate implementation
                    scrape_function = getattr(controller, scrape_function_name)
                    return await scrape_function(params, browser)
                else:
                    # If the function doesn't exist, log an error and return a helpful message
                    logger.error(f"Scrape function '{scrape_function_name}' not found")
                    
                    # List available scrape functions for debugging
                    available_functions = [name for name in dir(controller) if name.endswith('_Scrape_All_Pages') and callable(getattr(controller, name))]
                    logger.info(f"Available scrape functions: {available_functions}")
                    
                    return ActionResult(
                        error=f"Scrape function '{scrape_function_name}' not found for {params.source_state}, {params.source_name}. Available functions: {available_functions}",
                        extracted_content=f"Failed to find scraping implementation for {params.source_state}, {params.source_name}"
                    )
                
            except Exception as e:
                logger.error(f"Error in scrape_all_pages dispatcher: {str(e)}")
                return ActionResult(
                    error=f"Failed to dispatch scrape function: {str(e)}",
                    extracted_content="Page scraping failed"
                )
            
        #@self.registry.action("Save scraped HTML to API endpoint", param_model=SaveScrapedHtmlAction)
        async def save_scraped_html(params: SaveScrapedHtmlAction, browser: BrowserContext):
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
                endpoint = f"{base_url}{params.property_id}/scraped-data/create"

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
                    "source_name": params.source_name,
                    "scrape_type": params.scrape_type,
                    # Include tracking_id if provided
                    **({
                        "tracking_id": params.tracking_id
                    } if params.tracking_id else {}),
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

    # County-specific scraping methods - these are proper class methods that can be found by the dispatcher
    
    async def VA_Prince_William_County_Scrape_All_Pages(self, params: ScrapeAllPagesAction, browser: BrowserContext):
        """
        Implementation for Prince William County, VA permit history scraping.
        Scrapes HTML from all pages by:
        1. Saving the HTML from the current page
        2. Clicking the next page button identified by id 'link-NextPage'
        3. Repeating until the last page is reached (button is disabled)
        """
        try:
            page = await browser.get_current_page()
            page_count = 0
            results = []
            last_page_reached = False
            
            while page_count < params.max_pages and not last_page_reached:
                # Save the current page's HTML
                try:
                    # Extract HTML content
                    url = page.url
                    html_content = await page.evaluate("() => document.documentElement.outerHTML")

                    # Determine endpoint
                    base_url = os.getenv("BROWSER_USE_SCRAPED_API_BASE_URL", "http://api:8050/api/properties/")
                    endpoint = f"{base_url}{params.property_id}/scraped-data/create"

                    # Prepare payload and headers
                    payload = {
                        "raw_html": html_content,
                        "source_url": url,
                        "source_name": params.source_name,
                        "scrape_type": params.scrape_type,
                        "tracking_id": params.tracking_id,
                        # 'scrape_status' will default to 'pending' in the model if not provided
                        # 'processed_data' will default to {} in the model if not provided
                    }
                    headers = {"Content-Type": "application/json"}
                    auth_token = os.getenv("BROWSER_USE_ACCOUNT_TOKEN")
                    if auth_token:
                        headers["Authorization"] = f"Token {auth_token}"

                    # Post to API
                    logger.info(f"Posting HTML from page {page_count + 1} to API endpoint: {endpoint}")
                    response = requests.post(endpoint, json=payload, headers=headers)
                    
                    if response.status_code >= 400:
                        logger.error(f"API error on page {page_count + 1}: {response.status_code} - {response.text}")
                        results.append(f"Error saving page {page_count + 1}: HTTP {response.status_code}")
                    else:
                        logger.info(f"HTML from page {page_count + 1} successfully posted to API: {response.status_code}")
                        results.append(f"Successfully saved page {page_count + 1}")
                
                except Exception as e:
                    logger.error(f"Error extracting and posting HTML from page {page_count + 1}: {str(e)}")
                    results.append(f"Error saving page {page_count + 1}: {str(e)}")
                
                # Increment page counter
                page_count += 1
                
                # Check if we've reached the last page
                try:
                    # Check if the next button is disabled
                    is_disabled = await page.evaluate("""
                        () => {
                            const button = document.getElementById('link-NextPage');
                            if (!button) return true;
                            
                            // Check if the parent li has class 'disabled'
                            const parentLi = button.closest('li');
                            if (parentLi && parentLi.classList.contains('disabled')) {
                                return true;
                            }
                            
                            // Check if the button itself has disabled attribute or class
                            if (button.hasAttribute('disabled') || button.classList.contains('disabled')) {
                                return true;
                            }
                            
                            return false;
                        }
                    """)
                    
                    if is_disabled:
                        logger.info("Next page button is disabled - reached the last page")
                        last_page_reached = True
                        results.append("Reached the last page - next button is disabled")
                        break
                    
                    # Find and click the next page button
                    next_button = await page.query_selector('#link-NextPage')
                    if next_button:
                        await next_button.click()
                        logger.info(f"Clicked next page button, moving to page {page_count + 1}")
                        
                        # Wait for page to load
                        await page.wait_for_timeout(params.wait_time * 1000)  # Convert to milliseconds
                        
                        results.append(f"Navigated to page {page_count + 1}")
                    else:
                        logger.info("Next page button not found - reached the last page")
                        last_page_reached = True
                        results.append("Reached the last page - next button not found")
                        break
                
                except Exception as e:
                    logger.error(f"Error navigating to next page: {str(e)}")
                    results.append(f"Error navigating to page {page_count + 1}: {str(e)}")
                    break
            
            # If we hit the max pages limit without reaching the last page
            if page_count >= params.max_pages and not last_page_reached:
                results.append(f"Reached maximum page limit of {params.max_pages} pages")
            
            return ActionResult(
                extracted_content=f"Scraped {page_count} pages. " + " | ".join(results),
                include_in_memory=True,
                metadata={
                    "pages_scraped": page_count,
                    "property_id": params.property_id,
                    "source_name": params.source_name,
                    "last_page_reached": last_page_reached
                }
            )
            
        except Exception as e:
            logger.error(f"Error in VA_Prince_William_County_Scrape_All_Pages action: {str(e)}")
            return ActionResult(
                error=f"Failed to scrape all pages: {str(e)}",
                extracted_content="Page scraping failed"
            )

    async def VA_Fairfax_County_Scrape_All_Pages(self, params: ScrapeAllPagesAction, browser: BrowserContext):
        """
        Implementation for Fairfax County, VA permit history scraping.
        Scrapes HTML from all pages by:
        1. Saving the HTML from the current page
        2. Clicking the next page button with '>' text that contains a page parameter
        3. Repeating until the last page is reached (no more next links)
        """
        try:
            page = await browser.get_current_page()
            page_count = 0
            results = []
            last_page_reached = False
            
            while page_count < params.max_pages and not last_page_reached:
                # Save the current page's HTML
                try:
                    # Extract HTML content
                    url = page.url
                    html_content = await page.evaluate("() => document.documentElement.outerHTML")

                    # Determine endpoint
                    base_url = os.getenv("BROWSER_USE_SCRAPED_API_BASE_URL", "http://api:8050/api/properties/")
                    endpoint = f"{base_url}{params.property_id}/scraped-data/create"

                    # Prepare payload and headers
                    payload = {
                        "raw_html": html_content,
                        "source_url": url,
                        "source_name": params.source_name,
                        "scrape_type": params.scrape_type,
                        "tracking_id": params.tracking_id,
                        # 'scrape_status' will default to 'pending' in the model if not provided
                        # 'processed_data' will default to {} in the model if not provided
                    }
                    
                    headers = {"Content-Type": "application/json"}
                    auth_token = os.getenv("BROWSER_USE_ACCOUNT_TOKEN")
                    if auth_token:
                        headers["Authorization"] = f"Token {auth_token}"

                    # Post to API
                    logger.info(f"Posting HTML from page {page_count + 1} to API endpoint: {endpoint}")
                    response = requests.post(endpoint, json=payload, headers=headers)
                    
                    if response.status_code >= 400:
                        logger.error(f"API error on page {page_count + 1}: {response.status_code} - {response.text}")
                        results.append(f"Error saving page {page_count + 1}: HTTP {response.status_code}")
                    else:
                        logger.info(f"HTML from page {page_count + 1} successfully posted to API: {response.status_code}")
                        results.append(f"Successfully saved page {page_count + 1}")
                
                except Exception as e:
                    logger.error(f"Error extracting and posting HTML from page {page_count + 1}: {str(e)}")
                    results.append(f"Error saving page {page_count + 1}: {str(e)}")
                
                # Increment page counter
                page_count += 1
                
                # Check if we've reached the last page
                try:
                    # For Fairfax County, look for an anchor with '>' text that contains a page parameter
                    # Example: <a href="/page/search?searchaddress=13511%20Granite%20Rock%20Dr&amp;src=%2Fpage%2Fsearch&amp;pg=2">&gt;</a>
                    has_next_page = await page.evaluate("""
                        () => {
                            // Find all anchor elements
                            const anchors = Array.from(document.querySelectorAll('a'));
                            
                            // Find the one with '>' text that contains 'pg=' in the href
                            const nextPageLink = anchors.find(a => {
                                return a.textContent === '>' && 
                                       a.href && 
                                       a.href.includes('pg=');
                            });
                            
                            return nextPageLink ? true : false;
                        }
                    """)
                    
                    if not has_next_page:
                        logger.info("No next page link found - reached the last page")
                        last_page_reached = True
                        results.append("Reached the last page - no next page link found")
                        break
                    
                    # Find and click the next page link
                    next_button = await page.evaluate("""
                        () => {
                            const anchors = Array.from(document.querySelectorAll('a'));
                            const nextPageLink = anchors.find(a => {
                                return a.textContent === '>' && 
                                       a.href && 
                                       a.href.includes('pg=');
                            });
                            
                            if (nextPageLink) {
                                nextPageLink.click();
                                return true;
                            }
                            return false;
                        }
                    """)
                    
                    if next_button:
                        logger.info(f"Clicked next page link, moving to page {page_count + 1}")
                        
                        # Wait for page to load
                        await page.wait_for_timeout(params.wait_time * 1000)  # Convert to milliseconds
                        
                        results.append(f"Navigated to page {page_count + 1}")
                    else:
                        logger.info("Failed to click next page link - reached the last page")
                        last_page_reached = True
                        results.append("Reached the last page - failed to click next page link")
                        break
                
                except Exception as e:
                    logger.error(f"Error navigating to next page: {str(e)}")
                    results.append(f"Error navigating to page {page_count + 1}: {str(e)}")
                    break
            
            # If we hit the max pages limit without reaching the last page
            if page_count >= params.max_pages and not last_page_reached:
                results.append(f"Reached maximum page limit of {params.max_pages} pages")
            
            return ActionResult(
                extracted_content=f"Scraped {page_count} pages. " + " | ".join(results),
                include_in_memory=True,
                metadata={
                    "pages_scraped": page_count,
                    "property_id": params.property_id,
                    "source_name": params.source_name,
                    "last_page_reached": last_page_reached
                }
            )
            
        except Exception as e:
            logger.error(f"Error in VA_Fairfax_County_Scrape_All_Pages action: {str(e)}")
            return ActionResult(
                error=f"Failed to scrape all pages: {str(e)}",
                extracted_content="Page scraping failed"
            )