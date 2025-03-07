from models.tool_definitions import ToolDefinition, ToolArgument

find_events_tool = ToolDefinition(
    name="FindEvents",
    description="Find upcoming events to travel to a given city (e.g., 'Melbourne') and a date or month. "
    "It knows about events in Oceania only (e.g. major Australian and New Zealand cities).",
    arguments=[
        ToolArgument(
            name="city",
            type="string",
            description="Which  city to search for events",
        ),
        ToolArgument(
            name="month",
            type="string",
            description="The month or approximate date range to find events",
        ),
    ],
)

# 2) Define the SearchFlights tool
search_flights_tool = ToolDefinition(
    name="SearchFlights",
    description="Search for return flights from an origin to a destination within a date range (dateDepart, dateReturn).",
    arguments=[
        ToolArgument(
            name="origin",
            type="string",
            description="Airport or city (infer airport code from city and store)",
        ),
        ToolArgument(
            name="destination",
            type="string",
            description="Airport or city code for arrival (infer airport code from city and store)",
        ),
        ToolArgument(
            name="dateDepart",
            type="ISO8601",
            description="Start of date range in human readable format, when you want to depart",
        ),
        ToolArgument(
            name="dateReturn",
            type="ISO8601",
            description="End of date range in human readable format, when you want to return",
        ),
    ],
)

# 3) Define the CreateInvoice tool
create_invoice_tool = ToolDefinition(
    name="CreateInvoice",
    description="Generate an invoice for the items described for the amount provided",
    arguments=[
        ToolArgument(
            name="amount",
            type="float",
            description="The total cost to be invoiced",
        ),
        ToolArgument(
            name="flightDetails",
            type="string",
            description="A description of the item details to be invoiced",
        ),
    ],
)

# 4) Define the FindContracors tool
find_contractors_tool = ToolDefinition(
    name="FindContractors",
    description="Find contractors for the given query terms and location",
    arguments=[
        ToolArgument(
            name="query",
            type="string",
            description="The search terms to find relevant contractors",
        ),
        ToolArgument(
            name="zipCode",
            type="string",
            description="The location to search for contractors",
        ),
    ],
)