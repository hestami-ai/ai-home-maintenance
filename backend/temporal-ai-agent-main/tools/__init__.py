from .find_events import find_events
from .search_flights import search_flights
from .create_invoice import create_invoice
from .find_contractors import find_contractors


def get_handler(tool_name: str):
    if tool_name == "FindEvents":
        return find_events
    if tool_name == "SearchFlights":
        return search_flights
    if tool_name == "CreateInvoice":
        return create_invoice
    if tool_name == "FindContractors":
        return find_contractors

    raise ValueError(f"Unknown tool: {tool_name}")
