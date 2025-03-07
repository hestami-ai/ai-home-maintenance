from typing import List, Optional, Type
import os

from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from langchain_community.utilities import BingSearchAPIWrapper


class BingSearchToolInput(BaseModel):
    """Input schema for BingSearchTool."""
    
    query: str = Field(
        ...,
        description="The search query to send to Bing Search."
    )
    location: Optional[str] = Field(
        None,
        description="Optional location to focus the search results."
    )
    result_count: int = Field(
        default=5,
        description="Number of search results to return. Default is 5."
    )


class BingSearchTool(BaseTool):
    name: str = "bing_search"
    description: str = (
        "Search for information using Bing Search API. "
        "Useful for finding service providers, business information, "
        "and general web content. Returns structured search results."
    )
    args_schema: Type[BaseModel] = BingSearchToolInput
    search_wrapper: BingSearchAPIWrapper = Field(default_factory=lambda: BingSearchAPIWrapper(
        bing_subscription_key=os.getenv("BING_SEARCH_API_KEY"),
        bing_search_url=os.getenv("BING_SEARCH_URL", "https://api.bing.microsoft.com/v7.0/search")
    ))

    def _run(
        self, 
        query: str,
        location: Optional[str] = None,
        result_count: int = 5
    ) -> List[dict]:
        """
        Execute the Bing search with the given parameters.

        Args:
            query: The search query
            location: Optional location to focus search
            result_count: Number of results to return

        Returns:
            List of dictionaries containing search results with structure:
            {
                'title': str,
                'link': str,
                'snippet': str
            }
        """
        # Append location to query if provided
        full_query = f"{query} location:{location}" if location else query

        try:
            # Perform the search
            results = self.search_wrapper.results(full_query, result_count)
            
            # Format the results
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'title': result.get('title', ''),
                    'link': result.get('link', ''),
                    'snippet': result.get('snippet', '')
                })

            return formatted_results

        except Exception as e:
            return [{"error": f"Search failed: {str(e)}"}]
