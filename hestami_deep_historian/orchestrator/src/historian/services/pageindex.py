"""
PageIndex document retrieval client.

Provides an interface to the self-hosted PageIndex service for
hierarchical, TOC-based document retrieval.
"""

import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from historian.config import PageIndexConfig, get_settings
from historian.models.artifacts import EvidencePacket

logger = structlog.get_logger()


class PageIndexClient:
    """
    Client for PageIndex document retrieval service.

    PageIndex uses hierarchical TOC-based retrieval rather than
    vector search, providing more stable and citable results.
    """

    def __init__(self, config: PageIndexConfig | None = None):
        self.config = config or get_settings().pageindex
        self._client = httpx.AsyncClient(
            base_url=self.config.url,
            timeout=self.config.timeout,
        )

    async def close(self) -> None:
        """Close the HTTP client."""
        await self._client.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
    )
    async def query(
        self,
        query_text: str,
        *,
        doc_filter: str | None = None,
        max_results: int = 5,
    ) -> list[EvidencePacket]:
        """
        Query PageIndex for relevant document sections.

        Args:
            query_text: The search query
            doc_filter: Optional document ID filter
            max_results: Maximum number of results

        Returns:
            List of EvidencePacket objects with retrieved content
        """
        logger.debug(
            "pageindex_query",
            query=query_text[:100],
            doc_filter=doc_filter,
            max_results=max_results,
        )

        # TODO: Implement actual PageIndex API call once service is running
        # For now, return empty list as scaffold
        response = await self._client.post(
            "/query",
            json={
                "query": query_text,
                "doc_filter": doc_filter,
                "max_results": max_results,
            },
        )
        response.raise_for_status()
        data = response.json()

        packets = []
        for i, result in enumerate(data.get("results", [])):
            packet = EvidencePacket(
                packet_id=f"E{i+1:03d}",
                doc_id=result.get("doc_id", "unknown"),
                section_id=result.get("section_id", ""),
                pages=result.get("pages", []),
                content=result.get("content", ""),
                retrieval_trace=result.get("toc_path", ""),
            )
            packets.append(packet)

        logger.debug("pageindex_response", num_results=len(packets))
        return packets

    async def get_index_version(self) -> str:
        """Get the current index version/hash."""
        response = await self._client.get("/version")
        response.raise_for_status()
        return response.json().get("version", "unknown")

    async def health_check(self) -> bool:
        """Check if PageIndex server is responsive."""
        try:
            response = await self._client.get("/health")
            return response.status_code == 200
        except Exception as e:
            logger.error("pageindex_health_check_failed", error=str(e))
            return False
