Elasticsearch

Elasticsearch integration for Haystack

Module haystack_integrations.components.retrievers.elasticsearch.bm25_retriever

ElasticsearchBM25Retriever

ElasticsearchBM25Retriever retrieves documents from the ElasticsearchDocumentStore using BM25 algorithm to find the most similar documents to a user's query.

This retriever is only compatible with ElasticsearchDocumentStore.

Usage example:

from haystack import Document
from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore
from haystack_integrations.components.retrievers.elasticsearch import ElasticsearchBM25Retriever

document_store = ElasticsearchDocumentStore(hosts="http://localhost:9200")
retriever = ElasticsearchBM25Retriever(document_store=document_store)

# Add documents to DocumentStore
documents = [
    Document(text="My name is Carla and I live in Berlin"),
    Document(text="My name is Paul and I live in New York"),
    Document(text="My name is Silvano and I live in Matera"),
    Document(text="My name is Usagi Tsukino and I live in Tokyo"),
]
document_store.write_documents(documents)

result = retriever.run(query="Who lives in Berlin?")
for doc in result["documents"]:
    print(doc.content)

ElasticsearchBM25Retriever.__init__

def __init__(*,
             document_store: ElasticsearchDocumentStore,
             filters: Optional[Dict[str, Any]] = None,
             fuzziness: str = "AUTO",
             top_k: int = 10,
             scale_score: bool = False,
             filter_policy: Union[str, FilterPolicy] = FilterPolicy.REPLACE)

Initialize ElasticsearchBM25Retriever with an instance ElasticsearchDocumentStore.

Arguments:

    document_store: An instance of ElasticsearchDocumentStore.
    filters: Filters applied to the retrieved Documents, for more info see ElasticsearchDocumentStore.filter_documents.
    fuzziness: Fuzziness parameter passed to Elasticsearch. See the official documentation for more details.
    top_k: Maximum number of Documents to return.
    scale_score: If True scales the Document`s scores between 0 and 1.
    filter_policy: Policy to determine how filters are applied.

Raises:

    ValueError: If document_store is not an instance of ElasticsearchDocumentStore.

ElasticsearchBM25Retriever.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

Returns:

Dictionary with serialized data.

ElasticsearchBM25Retriever.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "ElasticsearchBM25Retriever"

Deserializes the component from a dictionary.

Arguments:

    data: Dictionary to deserialize from.

Returns:

Deserialized component.

ElasticsearchBM25Retriever.run

@component.output_types(documents=List[Document])
def run(query: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: Optional[int] = None)

Retrieve documents using the BM25 keyword-based algorithm.

Arguments:

    query: String to search in Documents' text.
    filters: Filters applied to the retrieved Documents. The way runtime filters are applied depends on the filter_policy chosen at retriever initialization. See init method docstring for more details.
    top_k: Maximum number of Document to return.

Returns:

A dictionary with the following keys:

    documents: List of Documents that match the query.

Module haystack_integrations.components.retrievers.elasticsearch.embedding_retriever

ElasticsearchEmbeddingRetriever

ElasticsearchEmbeddingRetriever retrieves documents from the ElasticsearchDocumentStore using vector similarity.

Usage example:

from haystack import Document
from haystack.components.embedders import SentenceTransformersTextEmbedder
from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore
from haystack_integrations.components.retrievers.elasticsearch import ElasticsearchEmbeddingRetriever

document_store = ElasticsearchDocumentStore(hosts="http://localhost:9200")
retriever = ElasticsearchEmbeddingRetriever(document_store=document_store)

# Add documents to DocumentStore
documents = [
    Document(text="My name is Carla and I live in Berlin"),
    Document(text="My name is Paul and I live in New York"),
    Document(text="My name is Silvano and I live in Matera"),
    Document(text="My name is Usagi Tsukino and I live in Tokyo"),
]
document_store.write_documents(documents)

te = SentenceTransformersTextEmbedder()
te.warm_up()
query_embeddings = te.run("Who lives in Berlin?")["embedding"]

result = retriever.run(query=query_embeddings)
for doc in result["documents"]:
    print(doc.content)

ElasticsearchEmbeddingRetriever.__init__

def __init__(*,
             document_store: ElasticsearchDocumentStore,
             filters: Optional[Dict[str, Any]] = None,
             top_k: int = 10,
             num_candidates: Optional[int] = None,
             filter_policy: Union[str, FilterPolicy] = FilterPolicy.REPLACE)

Create the ElasticsearchEmbeddingRetriever component.

Arguments:

    document_store: An instance of ElasticsearchDocumentStore.
    filters: Filters applied to the retrieved Documents. Filters are applied during the approximate KNN search to ensure that top_k matching documents are returned.
    top_k: Maximum number of Documents to return.
    num_candidates: Number of approximate nearest neighbor candidates on each shard. Defaults to top_k * 10. Increasing this value will improve search accuracy at the cost of slower search speeds. You can read more about it in the Elasticsearch documentation
    filter_policy: Policy to determine how filters are applied.

Raises:

    ValueError: If document_store is not an instance of ElasticsearchDocumentStore.

ElasticsearchEmbeddingRetriever.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

Returns:

Dictionary with serialized data.

ElasticsearchEmbeddingRetriever.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "ElasticsearchEmbeddingRetriever"

Deserializes the component from a dictionary.

Arguments:

    data: Dictionary to deserialize from.

Returns:

Deserialized component.

ElasticsearchEmbeddingRetriever.run

@component.output_types(documents=List[Document])
def run(query_embedding: List[float],
        filters: Optional[Dict[str, Any]] = None,
        top_k: Optional[int] = None)

Retrieve documents using a vector similarity metric.

Arguments:

    query_embedding: Embedding of the query.
    filters: Filters applied to the retrieved Documents. The way runtime filters are applied depends on the filter_policy chosen at retriever initialization. See init method docstring for more details.
    top_k: Maximum number of Documents to return.

Returns:

A dictionary with the following keys:

    documents: List of Documents most similar to the given query_embedding

Module haystack_integrations.document_stores.elasticsearch.document_store

ElasticsearchDocumentStore

ElasticsearchDocumentStore is a Document Store for Elasticsearch. It can be used with Elastic Cloud or your own Elasticsearch cluster.

Usage example (Elastic Cloud):

from haystack.document_store.elasticsearch import ElasticsearchDocumentStore
document_store = ElasticsearchDocumentStore(cloud_id="YOUR_CLOUD_ID", api_key="YOUR_API_KEY")

Usage example (self-hosted Elasticsearch instance):

from haystack.document_store.elasticsearch import ElasticsearchDocumentStore
document_store = ElasticsearchDocumentStore(hosts="http://localhost:9200")

In the above example we connect with security disabled just to show the basic usage. We strongly recommend to enable security so that only authorized users can access your data.

For more details on how to connect to Elasticsearch and configure security, see the official Elasticsearch documentation

All extra keyword arguments will be passed to the Elasticsearch client.

ElasticsearchDocumentStore.__init__

def __init__(
        *,
        hosts: Optional[Hosts] = None,
        custom_mapping: Optional[Dict[str, Any]] = None,
        index: str = "default",
        embedding_similarity_function: Literal["cosine", "dot_product",
                                               "l2_norm",
                                               "max_inner_product"] = "cosine",
        **kwargs)

Creates a new ElasticsearchDocumentStore instance.

It will also try to create that index if it doesn't exist yet. Otherwise, it will use the existing one.

One can also set the similarity function used to compare Documents embeddings. This is mostly useful when using the ElasticsearchDocumentStore in a Pipeline with an ElasticsearchEmbeddingRetriever.

For more information on connection parameters, see the official Elasticsearch documentation

For the full list of supported kwargs, see the official Elasticsearch reference

Arguments:

    hosts: List of hosts running the Elasticsearch client.
    custom_mapping: Custom mapping for the index. If not provided, a default mapping will be used.
    index: Name of index in Elasticsearch.
    embedding_similarity_function: The similarity function used to compare Documents embeddings. This parameter only takes effect if the index does not yet exist and is created. To choose the most appropriate function, look for information about your embedding model. To understand how document scores are computed, see the Elasticsearch documentation
    **kwargs: Optional arguments that Elasticsearch takes.

ElasticsearchDocumentStore.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

Returns:

Dictionary with serialized data.

ElasticsearchDocumentStore.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "ElasticsearchDocumentStore"

Deserializes the component from a dictionary.

Arguments:

    data: Dictionary to deserialize from.

Returns:

Deserialized component.

ElasticsearchDocumentStore.count_documents

def count_documents() -> int

Returns how many documents are present in the document store.

Returns:

Number of documents in the document store.

ElasticsearchDocumentStore.filter_documents

def filter_documents(
        filters: Optional[Dict[str, Any]] = None) -> List[Document]

The main query method for the document store. It retrieves all documents that match the filters.

Arguments:

    filters: A dictionary of filters to apply. For more information on the structure of the filters, see the official Elasticsearch documentation

Returns:

List of Documents that match the filters.

ElasticsearchDocumentStore.write_documents

def write_documents(documents: List[Document],
                    policy: DuplicatePolicy = DuplicatePolicy.NONE) -> int

Writes Documents to Elasticsearch.

Arguments:

    documents: List of Documents to write to the document store.
    policy: DuplicatePolicy to apply when a document with the same ID already exists in the document store.

Raises:

    ValueError: If documents is not a list of Documents.
    DuplicateDocumentError: If a document with the same ID already exists in the document store and policy is set to DuplicatePolicy.FAIL or DuplicatePolicy.NONE.
    DocumentStoreError: If an error occurs while writing the documents to the document store.

Returns:

Number of documents written to the document store.

ElasticsearchDocumentStore.delete_documents

def delete_documents(document_ids: List[str]) -> None

Deletes all Documents with a matching document_ids from the document store.

Arguments:

    document_ids: the object IDs to delete
