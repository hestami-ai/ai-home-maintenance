## **🗂️ Document Search Examples**

PageIndex currently enables reasoning-based RAG within a single document by default. For users who need to search across multiple documents, we provide three best-practice workflows for different scenarios below.

* [Search by Metadata:](https://docs.pageindex.ai/tutorials/doc-search/metadata) for documents that can be distinguished by metadata.  
* [Search by Semantics:](https://docs.pageindex.ai/tutorials/doc-search/semantics) for documents with different semantic content or cover diverse topics.  
* [Search by Description:](https://docs.pageindex.ai/tutorials/doc-search/description) a lightweight strategy for a small number of documents.

## **Document Search by Metadata**

PageIndex with metadata support is in closed beta. Fill out [this form](https://ii2abc2jejf.typeform.com/to/tK3AXl8T) to request early access to this feature.

For documents that can be easily distinguished by metadata, we recommend using metadata to search the documents. This method is ideal for the following document types:

* Financial reports categorized by company and time period  
* Legal documents categorized by case type  
* Medical records categorized by patient or condition  
* And many others

In such cases, you can search documents by leveraging their metadata. A popular method is to use “Query to SQL” for document retrieval.

### **Example Pipeline**

#### **PageIndex Tree Generation**

Upload all documents into PageIndex to get their doc\_id.

#### **Set up SQL tables**

Store documents along with their metadata and the PageIndex doc\_id in a database table.

#### **Query to SQL**

Use an LLM to transform a user’s retrieval request into a SQL query to fetch relevant documents.

#### **Retrieve with PageIndex**

Use the PageIndex doc\_id of the retrieved documents to perform further retrieval via the PageIndex retrieval API.

## **Document Search by Semantics**

For documents that cover diverse topics, one can also use vector-based semantic search to find relevant documents. The procedure is slightly different from the classic vector-search-based method.

### **Example Pipeline**

#### **Chunking and Embedding**

Divide the documents into chunks, choose an embedding model to convert the chunks into vectors and store each vector with its corresponding doc\_id in a vector database.

#### **Vector Search**

For each query, conduct a vector-based search to get top-K chunks with their corresponding documents.

#### **Compute Document Score**

For each document, calculate a relevance score. Let N be the number of content chunks associated with each document, and let ChunkScore(n) be the relevance score of chunk n. The document score is computed as:

DocScore=1N+1∑n=1NChunkScore(n)

DocScore=

*N*\+1

​

1

​

*n*\=1

∑

*N*

​

ChunkScore(*n*)

* The sum aggregates relevance from all related chunks.  
* The \+1 inside the square root ensures the formula handles nodes with zero chunks.  
* Using the square root in the denominator allows the score to increase with the number of relevant chunks, but with diminishing returns. This rewards documents with more relevant chunks, while preventing large nodes from dominating due to quantity alone.  
* This scoring favors documents with fewer, highly relevant chunks over those with many weakly relevant ones.

#### **Retrieve with PageIndex**

Select the documents with the highest DocScore, then use their doc\_id to perform further retrieval via the PageIndex retrieval API.

## **Document Search by Description**

For documents that don’t have metadata, you can use LLM-generated descriptions to help with document selection. This is a lightweight approach that works best with a small number of documents.

### **Example Pipeline**

#### **PageIndex Tree Generation**

Upload all documents into PageIndex to get their doc\_id and tree structure.

#### **Description Generation**

Generate a description for each document based on its PageIndex tree structure and node summaries.

prompt \= f"""You are given a table of contents structure of a document. Your task is to generate a one-sentence description for the document that makes it easy to distinguish from other documents.    Document tree structure: {PageIndex\_Tree} Directly return the description, do not include any other text."""

#### **Search with LLM**

Use an LLM to select relevant documents by comparing the user query against the generated descriptions.

Below is a sample prompt for document selection based on their descriptions:

prompt \= f""" You are given a list of documents with their IDs, file names, and descriptions. Your task is to select documents that may contain information relevant to answering the user query. Query: {query} Documents: \[    {        "doc\_id": "xxx",        "doc\_name": "xxx",        "doc\_description": "xxx"    }\] Response Format:{{    "thinking": "\<Your reasoning for document selection\>",    "answer": \<Python list of relevant doc\_ids\>, e.g. \['doc\_id1', 'doc\_id2'\]. Return \[\] if no documents are relevant.}} Return only the JSON structure, with no additional output."""

#### **Retrieve with PageIndex**

Use the PageIndex doc\_id of the retrieved documents to perform further retrieval via the PageIndex retrieval API.

