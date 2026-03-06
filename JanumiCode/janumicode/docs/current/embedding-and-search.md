# Embedding and Semantic Search

To enhance its "Narrative Memory," JanumiCode integrates a powerful semantic search capability. This allows the system (and potentially users in the future) to find relevant information from the project's entire history not just by keyword, but by conceptual meaning.

This is achieved by generating "vector embeddings" for dialogue artifacts and using a specialized database extension to find the most similar items to a given query.

## The Embedding Pipeline (`embedAndStore`)

When a new piece of meaningful content is created in the system, it goes through the embedding pipeline:

1.  **Content Hashing**: The service first computes a SHA-256 hash of the content. This is used for de-duplication, ensuring that the exact same text is not embedded multiple times.
2.  **Provider Selection**: The service uses a factory to create an instance of the currently configured embedding provider (e.g., `Voyage-API` or `Voyage-Local`).
3.  **Vector Generation**: It calls the provider's `embed()` method, which converts the text into a high-dimensional vector (an array of floating-point numbers). The input is marked as a `document` to use the appropriate embedding strategy.
4.  **Database Storage**: The original text, the generated vector, and metadata about the source of the text (e.g., which dialogue it came from, whether it was a `claim` or a `narrative_memory`) are all stored in the `embeddings` table in the SQLite database.

## The Search Pipeline (`searchSimilar`)

When a search is performed, the process works in reverse:

1.  **Query Embedding**: The user's search query (a short piece of text) is sent to the configured embedding provider to be converted into a vector. The input is marked as a `query` to use the appropriate embedding strategy.
2.  **K-Nearest Neighbor (KNN) Search**: The core of the search functionality is the `sqlite-vector` extension. This extension adds vector search capabilities directly to SQLite. The service uses a `vector_distance` function in a SQL query to find the vectors in the `embeddings` table that have the smallest "cosine distance" to the query vector.
3.  **Scoring and Filtering**: The cosine distance (where 0 is identical and 2 is opposite) is converted into a more intuitive similarity `score` (where 1 is identical and -1 is opposite). The results are then filtered to only include those above a certain similarity threshold.
4.  **Returning Results**: The service returns a list of the most semantically similar pieces of content from the database.

## Pluggable Provider Model

The embedding system is designed to be extensible. It uses a generic `EmbeddingProvider` interface that defines a standard contract for any embedding backend. JanumiCode comes with two built-in providers for Voyage AI:

*   **`voyageAPI`**: Uses the official Voyage AI cloud API.
*   **`voyageRPC`**: Uses a local `voyage-embed` CLI tool for running an ONNX embedding model on the user's own machine.

## What Gets Embedded?

The system is configured to generate embeddings for the most important artifacts that contribute to its narrative memory, including:

*   **`dialogue_turn`**: The content of a turn in the conversation.
*   **`claim`**: The statement of an assumption made by the Executor.
*   **`verdict`**: The rationale for a verdict issued by the Verifier.
*   **`narrative_memory`**: The "lessons learned" from a completed dialogue, as synthesized by the Narrative Curator.
*   **`decision_trace`**: The key decisions made during a dialogue.
*   **`open_loop`**: Unresolved issues or follow-up actions identified by the Narrative Curator.

By embedding this rich set of artifacts, the system can draw upon a deep and conceptually-indexed well of historical knowledge to inform its future actions.
