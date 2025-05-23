ElasticsearchEmbeddingRetriever

An embedding-based Retriever compatible with the Elasticsearch Document Store.
Suggest Edits
	
Most common position in a pipeline	1. After a Text Embedder and before a PromptBuilder in a RAG pipeline 2. The last component in the semantic search pipeline 3. After a Text Embedder and before an ExtractiveReader in an extractive QA pipeline
Mandatory init variables	"document_store": An instance of ElasticsearchDocumentStore
Mandatory run variables	“query_embedding”: A list of floats
Output variables	"documents": A list of documents
API reference	Elasticsearch
GitHub link	https://github.com/deepset-ai/haystack-core-integrations/tree/main/integrations/elasticsearch
Overview

The ElasticsearchEmbeddingRetriever is an embedding-based Retriever compatible with the ElasticsearchDocumentStore. It compares the query and Document embeddings and fetches the Documents most relevant to the query from the ElasticsearchDocumentStore based on the outcome.

When using the ElasticsearchEmbeddingRetriever in your NLP system, ensure it has the query and Document embeddings available. You can do so by adding a Document Embedder to your indexing pipeline and a Text Embedder to your query pipeline.

In addition to the query_embedding, the ElasticsearchEmbeddingRetriever accepts other optional parameters, including top_k (the maximum number of Documents to retrieve) and filters to narrow down the search space.

When initializing Retriever, you can also set num_candidates: the number of approximate nearest neighbor candidates on each shard. It's an advanced setting you can read more about in the Elasticsearch documentation.

The embedding_similarity_function to use for embedding retrieval must be defined when the corresponding ElasticsearchDocumentStore is initialized.
Installation

Install Elasticsearch and then start an instance. Haystack 2.0 supports Elasticsearch 8.

If you have Docker set up, we recommend pulling the Docker image and running it.

docker pull docker.elastic.co/elasticsearch/elasticsearch:8.11.1
docker run -p 9200:9200 -e "discovery.type=single-node" -e "ES_JAVA_OPTS=-Xms1024m -Xmx1024m" -e "xpack.security.enabled=false" elasticsearch:8.11.1

As an alternative, you can go to Elasticsearch integration GitHub and start a Docker container running Elasticsearch using the provided docker-compose.yml:

docker compose up

Once you have a running Elasticsearch instance, install the elasticsearch-haystack integration:

pip install elasticsearch-haystack

Usage
In a pipeline

Use this Retriever in a query Pipeline like this:

from haystack_integrations.components.retrievers.elasticsearch import ElasticsearchEmbeddingRetriever
from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore

from haystack.document_stores.types import DuplicatePolicy
from haystack import Document, Pipeline
from haystack.components.embedders import SentenceTransformersTextEmbedder, SentenceTransformersDocumentEmbedder

document_store = ElasticsearchDocumentStore(hosts= "http://localhost:9200/")

model = "BAAI/bge-large-en-v1.5"

documents = [Document(content="There are over 7,000 languages spoken around the world today."),
						Document(content="Elephants have been observed to behave in a way that indicates a high level of self-awareness, such as recognizing themselves in mirrors."),
						Document(content="In certain parts of the world, like the Maldives, Puerto Rico, and San Diego, you can witness the phenomenon of bioluminescent waves.")]

document_embedder = SentenceTransformersDocumentEmbedder(model=model)  
document_embedder.warm_up()
documents_with_embeddings = document_embedder.run(documents)

document_store.write_documents(documents_with_embeddings.get("documents"), policy=DuplicatePolicy.SKIP)

query_pipeline = Pipeline()
query_pipeline.add_component("text_embedder", SentenceTransformersTextEmbedder(model=model))
query_pipeline.add_component("retriever", ElasticsearchEmbeddingRetriever(document_store=document_store))
query_pipeline.connect("text_embedder.embedding", "retriever.query_embedding")

query = "How many languages are there?"

result = query_pipeline.run({"text_embedder": {"text": query}})

print(result['retriever']['documents'][0])

The example output would be:

Document(id=cfe93bc1c274908801e6670440bf2bbba54fad792770d57421f85ffa2a4fcc94, content: 'There are over 7,000 languages spoken around the world today.', score: 0.87717235, embedding: vector of size 1024)

