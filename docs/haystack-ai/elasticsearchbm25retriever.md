ElasticsearchBM25Retriever

A keyword-based Retriever that fetches Documents matching a query from the Elasticsearch Document Store.
Suggest Edits
	
Most common position in a pipeline	1. Before a PromptBuilder in a RAG pipeline 2. The last component in the semantic search pipeline 3. Before an ExtractiveReader in an extractive QA pipeline
Mandatory init variables	"document_store": An instance of ElasticsearchDocumentStore
Mandatory run variables	“query”: A string
Output variables	"documents": A list of documents (matching the query)
API reference	Elasticsearch
GitHub link	https://github.com/deepset-ai/haystack-core-integrations/tree/main/integrations/elasticsearch
Overview

ElasticsearchBM25Retriever is a keyword-based Retriever that fetches Documents matching a query from an ElasticsearchDocumentStore. It determines the similarity between Documents and the query based on the BM25 algorithm, which computes a weighted word overlap between the two strings.

Since the ElasticsearchBM25Retriever matches strings based on word overlap, it’s often used to find exact matches to names of persons or products, IDs, or well-defined error messages. The BM25 algorithm is very lightweight and simple. Nevertheless, it can be hard to beat with more complex embedding-based approaches on out-of-domain data.

In addition to the query, the ElasticsearchBM25Retriever accepts other optional parameters, including top_k (the maximum number of Documents to retrieve) and filters to narrow down the search space.
When initializing Retriever, you can also adjust how inexact fuzzy matching is performed, using the fuzziness parameter.

If you want a semantic match between a query and documents, you can use ElasticsearchEmbeddingRetriever, which uses vectors created by embedding models to retrieve relevant information.
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
On its own

from haystack import Document
from haystack_integrations.components.retrievers.elasticsearch import ElasticsearchBM25Retriever
from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore
from elasticsearch import Elasticsearch

document_store = ElasticsearchDocumentStore(hosts= "http://localhost:9200/")
documents = [Document(content="There are over 7,000 languages spoken around the world today."),
			       Document(content="Elephants have been observed to behave in a way that indicates a high level of self-awareness, such as recognizing themselves in mirrors."),
			       Document(content="In certain parts of the world, like the Maldives, Puerto Rico, and San Diego, you can witness the phenomenon of bioluminescent waves.")]
document_store.write_documents(documents=documents)

retriever = ElasticsearchBM25Retriever(document_store=document_store)
retriever.run(query="How many languages are spoken around the world today?")

In a RAG pipeline

Set your OPENAI_API_KEY as an environment variable and then run the following code:


from haystack_integrations.components.retrievers.elasticsearch import ElasticsearchBM25Retriever
from haystack_integrations.document_stores.elasticsearch import ElasticsearchDocumentStore

from elasticsearch import Elasticsearch

from haystack import Document
from haystack import Pipeline
from haystack.components.builders.answer_builder import AnswerBuilder
from haystack.components.builders.prompt_builder import PromptBuilder
from haystack.components.generators import OpenAIGenerator
from haystack.document_stores.types import DuplicatePolicy

import os
api_key = os.environ['OPENAI_API_KEY']

# Create a RAG query pipeline
prompt_template = """
    Given these documents, answer the question.\nDocuments:
    {% for doc in documents %}
        {{ doc.content }}
    {% endfor %}

    \nQuestion: {{question}}
    \nAnswer:
    """

document_store = ElasticsearchDocumentStore(hosts= "http://localhost:9200/")

# Add Documents

documents = [Document(content="There are over 7,000 languages spoken around the world today."),
			       Document(content="Elephants have been observed to behave in a way that indicates a high level of self-awareness, such as recognizing themselves in mirrors."),
			       Document(content="In certain parts of the world, like the Maldives, Puerto Rico, and San Diego, you can witness the phenomenon of bioluminescent waves.")]

# DuplicatePolicy.SKIP param is optional, but useful to run the script multiple times without throwing errors
document_store.write_documents(documents=documents, policy=DuplicatePolicy.SKIP)

retriever = ElasticsearchBM25Retriever(document_store=document_store)
rag_pipeline = Pipeline()
rag_pipeline.add_component(name="retriever", instance=retriever)
rag_pipeline.add_component(instance=PromptBuilder(template=prompt_template), name="prompt_builder")
rag_pipeline.add_component(instance=OpenAIGenerator(api_key=api_key), name="llm")
rag_pipeline.add_component(instance=AnswerBuilder(), name="answer_builder")
rag_pipeline.connect("retriever", "prompt_builder.documents")
rag_pipeline.connect("prompt_builder", "llm")
rag_pipeline.connect("llm.replies", "answer_builder.replies")
rag_pipeline.connect("llm.meta", "answer_builder.meta")
rag_pipeline.connect("retriever", "answer_builder.documents")

question = "How many languages are spoken around the world today?"
result = rag_pipeline.run(
            {
                "retriever": {"query": question},
                "prompt_builder": {"question": question},
                "answer_builder": {"query": question},
            }
        )
print(result['answer_builder']['answers'][0].data)

Here’s an example output you might get:

"Over 7,000 languages are spoken around the world today"
