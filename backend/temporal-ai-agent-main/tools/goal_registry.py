from models.tool_definitions import AgentGoal
from tools.tool_registry import (
    find_events_tool,
    search_flights_tool,
    create_invoice_tool,
    find_contractors_tool,
)

goal_event_flight_invoice = AgentGoal(
    tools=[find_events_tool, search_flights_tool, create_invoice_tool],
    description="Help the user gather args for these tools in order: "
    "1. FindEvents: Find an event to travel to "
    "2. SearchFlights: search for a flight around the event dates "
    "3. CreateInvoice: Create a simple invoice for the cost of that flight ",
    example_conversation_history="\n ".join(
        [
            "user: I'd like to travel to an event",
            "agent: Sure! Let's start by finding an event you'd like to attend. I know about events in Australia and New Zealand cities. Could you tell me which city and month you're interested in?",
            "user: sydney in may please",
            "agent: Great! Let's find an events in Sydney in May.",
            "user_confirmed_tool_run: <user clicks confirm on FindEvents tool>",
            "tool_result: { 'event_name': 'Vivid Sydney', 'event_date': '2023-05-01' }",
            "agent: Found an event! There's Vivid Sydney on May 1 2025, ending on May 14 2025. Would you like to search for flights around these dates?",
            "user: Yes, please",
            "agent: Let's search for flights around these dates. Could you provide your departure city?",
            "user: San Francisco",
            "agent: Thanks, searching for flights from San Francisco to Sydney around 2023-02-25 to 2023-02-28.",
            "user_confirmed_tool_run: <user clicks confirm on SearchFlights tool>"
            'tool_result: results including {"flight_number": "CX101", "return_flight_number": "CX102", "price": 850.0}',
            "agent: Found some flights! The cheapest is CX101 for $850. Would you like to generate an invoice for this flight?",
            "user_confirmed_tool_run: <user clicks confirm on CreateInvoice tool>",
            'tool_result: { "status": "success", "invoice": { "flight_number": "CX101", "amount": 850.0 }, invoiceURL: "https://example.com/invoice" }',
            "agent: Invoice generated! Here's the link: https://example.com/invoice",
        ]
    ),
)

goal_find_contractors = AgentGoal(
    tools=[find_contractors_tool],
    description="Help the user find contractors based on their requirements using the FindContractors tool",
    example_conversation_history="\n ".join(
        [
            "user: I need to find a home repair person in my area",
            "agent: What kind of home repair person are you looking for?",
            "user: I need to find a plumber in my area",
            "agent: I'll help you find a plumber. Could you please provide your ZIP code?",
            "user: 94105",
            "agent: Great! I'll search for plumbers in the 94105 area.",
            "user_confirmed_tool_run: <user clicks confirm on FindContractors tool>",
            'tool_result: {"success": true, "contractors": [{"name": "ABC Plumbing", "description": "Professional plumbing services", "telephone": "(555) 123-4567"}]}',
            "agent: I found several plumbers in your area. ABC Plumbing is available and can be reached at (555) 123-4567. Would you like more details about other contractors?",
        ]
    ),
)
