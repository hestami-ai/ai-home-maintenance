from typing import Any, Dict, List, Optional, Union
import requests  # Fallback in case the SDK is not used

from haystack import ComponentError, Document, component, default_from_dict, default_to_dict, logging
from haystack.utils import Secret, deserialize_secrets_inplace

logger = logging.getLogger(__name__)

# Base URL for Bing Search API (if SDK isn't used)
BING_SEARCH_BASE_URL = "https://api.bing.microsoft.com/v7.0/search"


class BingSearchError(ComponentError):
    pass


@component
class BingSearchWebSearch:
    """
    Uses Bing Search API to search the web for relevant documents.
    
    Mimics the SearchApiWebSearch component in behavior and structure.
    """

    def __init__(
        self,
        api_key: Secret = Secret.from_env_var("BING_SEARCH_API_KEY"),
        top_k: Optional[int] = 10,
        allowed_domains: Optional[List[str]] = None,
        search_params: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize the BingSearchWebSearch component.

        :param api_key: API key for the Bing Search API.
        :param top_k: Number of documents to return.
        :param allowed_domains: List of domains to limit the search to.
        :param search_params: Additional parameters passed to the Bing Search API.
        """
        self.api_key = api_key
        self.top_k = top_k
        self.allowed_domains = allowed_domains
        self.search_params = search_params or {}

        # Ensure that the API key is resolved.
        _ = self.api_key.resolve_value()

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializes the component to a dictionary.

        :returns:
              Dictionary with serialized data.
        """
        return default_to_dict(
            self,
            top_k=self.top_k,
            allowed_domains=self.allowed_domains,
            search_params=self.search_params,
            api_key=self.api_key.to_dict(),
        )

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BingSearchWebSearch":
        """
        Deserializes the component from a dictionary.

        :param data: The dictionary to deserialize from.
        :returns: The deserialized component.
        """
        deserialize_secrets_inplace(data["init_parameters"], keys=["api_key"])
        return default_from_dict(cls, data)

    @component.output_types(documents=List[Document], links=List[str])
    def run(self, query: str) -> Dict[str, Union[List[Document], List[str]]]:
        """
        Uses Bing Search API to search the web.

        :param query: Search query.
        :returns: A dictionary with the following keys:
            - "documents": List of documents returned by the search engine.
            - "links": List of links returned by the search engine.
        :raises TimeoutError: If the request to the Bing Search API times out.
        :raises BingSearchError: If an error occurs while querying the Bing Search API.
        """
        # Append allowed domains to the query if provided
        query_prepend = "OR ".join(f"site:{domain}" for domain in self.allowed_domains) if self.allowed_domains else ""
        payload = {"q": f"{query_prepend} {query}", "count": self.top_k, **self.search_params}
        headers = {
            "Ocp-Apim-Subscription-Key": self.api_key.resolve_value(),
        }

        try:
            response = requests.get(BING_SEARCH_BASE_URL, headers=headers, params=payload, timeout=90)
            response.raise_for_status()
        except requests.Timeout as error:
            raise TimeoutError(f"Request to {self.__class__.__name__} timed out.") from error

        except requests.RequestException as e:
            raise BingSearchError(f"An error occurred while querying {self.__class__.__name__}. Error: {e}") from e

        # Request succeeded
        json_result = response.json()

        # Process web pages from the JSON response
        web_pages = json_result.get("webPages", {}).get("value", [])

        documents = [
            Document.from_dict({"title": page["name"], "content": page["snippet"], "link": page["url"]})
            for page in web_pages
        ]
        links = [page["url"] for page in web_pages]

        logger.debug(
            "Bing Search API returned {number_documents} documents for the query '{query}'",
            number_documents=len(documents),
            query=query,
        )

        return {"documents": documents[: self.top_k], "links": links[: self.top_k]}
