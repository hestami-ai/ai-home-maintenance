import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional, Type

from browser_use.agent.service import Agent
from browser_use.agent.views import (
    AgentOutput,
    AgentState,
    AgentStepInfo,
    AgentHistoryList,
    StepMetadata
)
from browser_use.browser.browser import Browser
from browser_use.browser.context import BrowserContext
from browser_use.controller.service import Controller
from langchain_core.language_models.chat_models import BaseChatModel

logger = logging.getLogger(__name__)


class BrowserUseAdapter:
    """
    Adapter class that uses the default browser-use Agent implementation
    while providing a consistent interface for the Gradio UI.
    """
    
    @staticmethod
    async def create_agent(
        task: str,
        llm: BaseChatModel,
        add_infos: str = "",
        browser: Browser = None,
        browser_context: BrowserContext = None,
        controller: Controller = None,
        sensitive_data: Optional[Dict[str, str]] = None,
        initial_actions: Optional[List[Dict[str, Dict[str, Any]]]] = None,
        register_new_step_callback: Callable[['BrowserState', 'AgentOutput', int], Awaitable[None]] = None,
        register_done_callback: Callable[['AgentHistoryList'], Awaitable[None]] = None,
        register_external_agent_status_raise_error_callback: Callable[[], Awaitable[bool]] = None,
        use_vision: bool = True,
        use_vision_for_planner: bool = False,
        save_conversation_path: Optional[str] = None,
        save_conversation_path_encoding: Optional[str] = 'utf-8',
        max_failures: int = 3,
        retry_delay: int = 10,
        override_system_message: Optional[str] = None,
        extend_system_message: Optional[str] = None,
        max_input_tokens: int = 128000,
        validate_output: bool = False,
        message_context: Optional[str] = None,
        generate_gif: bool | str = False,
        available_file_paths: Optional[list[str]] = None,
        include_attributes: list[str] = None,
        max_actions_per_step: int = 10,
        tool_calling_method: Optional[str] = 'auto',
        page_extraction_llm: Optional[BaseChatModel] = None,
        planner_llm: Optional[BaseChatModel] = None,
        planner_interval: int = 1,
        injected_agent_state: Optional[AgentState] = None,
        context: Any = None,
        minimum_wait_page_load_time: float = 0.5,
        wait_for_network_idle_page_load_time: float = 1.0,
        maximum_wait_page_load_time: float = 5.0,
        viewport_expansion: int = 500
    ) -> Agent:
        """
        Create a browser-use Agent instance with the provided parameters.
        This method wraps the default Agent constructor with our custom parameters.
        """
        # Set default include_attributes if not provided
        if include_attributes is None:
            include_attributes = [
                'title', 'type', 'name', 'role', 'aria-label',
                'placeholder', 'value', 'alt', 'aria-expanded',
                'data-date-format',
            ]
        
        # In browser-use 0.1.41, the Agent constructor doesn't accept add_infos parameter
        # We need to modify the task to include the additional information
        modified_task = task
        if add_infos:
            modified_task = f"{task}\n\nAdditional Information: {add_infos}"
        
        # Create the default browser-use Agent with parameters compatible with 0.1.41
        agent = Agent(
            task=modified_task,  # Include add_infos in the task
            llm=llm,
            browser=browser,
            browser_context=browser_context,
            controller=controller,
            sensitive_data=sensitive_data,
            initial_actions=initial_actions,
            register_new_step_callback=register_new_step_callback,
            register_done_callback=register_done_callback,
            register_external_agent_status_raise_error_callback=register_external_agent_status_raise_error_callback,
            use_vision=use_vision,
            use_vision_for_planner=use_vision_for_planner,  # This parameter is supported in 0.1.41
            save_conversation_path=save_conversation_path,
            save_conversation_path_encoding=save_conversation_path_encoding,
            max_failures=max_failures,
            retry_delay=retry_delay,
            override_system_message=override_system_message,
            extend_system_message=extend_system_message,
            max_input_tokens=max_input_tokens,
            validate_output=validate_output,
            message_context=message_context,
            generate_gif=generate_gif,
            available_file_paths=available_file_paths,
            include_attributes=include_attributes,
            max_actions_per_step=max_actions_per_step,
            tool_calling_method=tool_calling_method,
            page_extraction_llm=page_extraction_llm,
            planner_llm=planner_llm,
            planner_interval=planner_interval
        )
        
        # Configure browser context settings if provided
        if browser_context:
            browser_context.minimum_wait_page_load_time = minimum_wait_page_load_time
            browser_context.wait_for_network_idle_page_load_time = wait_for_network_idle_page_load_time
            browser_context.maximum_wait_page_load_time = maximum_wait_page_load_time
            browser_context.viewport_expansion = viewport_expansion
        
        return agent
