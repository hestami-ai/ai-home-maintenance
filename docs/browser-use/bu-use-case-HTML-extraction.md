I'm using browser-use web-ui (the AI agent web browser navigation tool) https://github.com/browser-use/web-ui. However, we need to make modifications such that it can use tool calls to process data in various stages of a workflow for data extraction. E.g., when I instruct browser-use web-ui to go to a website, enter in search parameters and retrieve the results, I need it to save the extracted HTML so that it can be post processed for cleaner post processing instead of what it currently does, write output to browser-use related log files. Or at least that is what appears to happen. How does browser-use and its web-ui support adding tools / function calling?

More specifically, in the specific case, we need the controlled browser to save the DOM html that is returned in the search query results.

Here is where they describe certain tool use: https://github.com/browser-use/browser-use/tree/main/examples/custom-functions

However, it's not clear how to instruct browser use to get the browser DOM information.

Do you have any questions before you provide  a response?


ChatGPT said:
​To modify the browser-use web-ui to save the extracted HTML of search query results for post-processing, you can utilize the custom function capabilities provided by the browser-use framework. Here's a step-by-step guide to achieve this:​

Understand Custom Functions in browser-use:

The browser-use framework allows you to extend its default agent by writing custom functions. These functions can be synchronous or asynchronous and are designed to perform specific tasks.​
Browser Use

You can register a custom function using the @controller.action decorator.​
Browser Use

For example:

from browser_use import Controller, ActionResult

# Initialize the controller
controller = Controller()

@controller.action('Ask user for information')
def ask_human(question: str) -> str:
    answer = input(f'\n{question}\nInput: ')
    return ActionResult(extracted_content=answer)
This example demonstrates how to prompt the user for input and return the response as extracted content.

Accessing the DOM HTML:

To retrieve the current state of the DOM, you can execute JavaScript within the controlled browser environment to extract the outerHTML of the document.documentElement, which represents the entire HTML document.​

Here's how you can implement this:

from browser_use import Controller, ActionResult

controller = Controller()

@controller.action('Save DOM HTML')
def save_dom_html() -> str:
    # JavaScript to get the entire HTML content
    script = "return document.documentElement.outerHTML;"
    dom_html = controller.browser.execute_script(script)
    return ActionResult(extracted_content=dom_html)
In this function, execute_script runs the provided JavaScript code in the context of the current page, returning the full HTML content.

Saving the Extracted HTML:

Once you have the HTML content, you can save it to a file or process it as needed.​

For instance, to save the HTML to a file:


@controller.action('Save DOM HTML to File')
def save_dom_html_to_file(file_path: str) -> str:
    script = "return document.documentElement.outerHTML;"
    dom_html = controller.browser.execute_script(script)
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(dom_html)
    return ActionResult(extracted_content=f"HTML saved to {file_path}")
This function retrieves the DOM HTML and writes it to the specified file path.

Integrating the Custom Function into Your Workflow:

After defining the custom function, you can call it at the appropriate stage in your data extraction workflow.​

Ensure that the browser has completed loading the page and that any dynamic content has been rendered before executing the function to capture the fully populated DOM.​

By implementing these steps, you can modify the browser-use web-ui to save the extracted HTML of search query results, facilitating cleaner post-processing and analysis.