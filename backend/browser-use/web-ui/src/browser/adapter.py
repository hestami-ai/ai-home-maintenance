import logging
from typing import Optional

from browser_use.browser.browser import Browser, BrowserConfig
from browser_use.browser.context import BrowserContext, BrowserContextConfig, BrowserContextWindowSize
from playwright.async_api import async_playwright, Playwright

logger = logging.getLogger(__name__)


class BrowserAdapter:
    """
    Adapter class that uses the default browser-use Browser implementation
    while providing a consistent interface for the Gradio UI.
    """
    
    @staticmethod
    async def create_browser(
        headless: bool = True,
        disable_security: bool = False,
        chrome_cdp: Optional[str] = None,
        window_width: int = 1280,
        window_height: int = 720
    ) -> Browser:
        """
        Create a browser-use Browser instance with the provided parameters.
        This method wraps the default Browser constructor with our custom parameters.
        """
        # Create the browser config
        browser_config = BrowserConfig(
            headless=headless,
            disable_security=disable_security,
            chrome_cdp=chrome_cdp
        )
        
        # Create the browser instance with the config
        # In browser-use 0.1.41, Browser is initialized with just the config
        browser = Browser(config=browser_config)
        
        return browser
    
    @staticmethod
    async def create_browser_context(
        browser: Browser,
        window_width: int = 1280,
        window_height: int = 720,
        minimum_wait_page_load_time: float = 3.0, #0.5,
        wait_for_network_idle_page_load_time: float = 5.0, #1.0,
        maximum_wait_page_load_time: float = 7.0, #5.0,
        viewport_expansion: int = 500
    ) -> BrowserContext:
        """
        Create a browser-use BrowserContext instance with the provided parameters.
        This method wraps the default BrowserContext constructor with our custom parameters.
        """
        window_size = BrowserContextWindowSize(
            width=window_width,
            height=window_height
        )
        
        context_config = BrowserContextConfig(
            window_size=window_size
        )
        
        browser_context = await browser.new_context(config=context_config)
        
        # Configure additional settings
        browser_context.minimum_wait_page_load_time = minimum_wait_page_load_time
        browser_context.wait_for_network_idle_page_load_time = wait_for_network_idle_page_load_time
        browser_context.maximum_wait_page_load_time = maximum_wait_page_load_time
        browser_context.viewport_expansion = viewport_expansion
        
        return browser_context
