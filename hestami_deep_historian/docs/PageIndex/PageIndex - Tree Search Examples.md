## **🌳 Tree Search Examples**

This tutorial provides two examples of how to perform PageIndex tree search.

* [LLM Tree Search](https://docs.pageindex.ai/tutorials/tree-search/llm): Tree search powered by an LLM for reasoning-based retrieval.  
* [Hybrid Tree Search](https://docs.pageindex.ai/tutorials/tree-search/hybrid): Combines LLM reasoning with Vector DB for hybrid retrieval.

# **LLM Tree Search**

A simple strategy is to use an LLM agent to perform tree search. Here is a basic tree search prompt.

prompt \= f"""You are given a query and the tree structure of a document.You need to find all nodes that are likely to contain the answer. Query: {query} Document tree structure: {PageIndex\_Tree} Reply in the following JSON format:{{  "thinking": \<your reasoning about which nodes are relevant\>,  "node\_list": \[node\_id1, node\_id2, ...\]}}"""

In our dashboard and retrieval API, we use a combination of LLM tree search and value function-based Monte Carlo Tree Search ([MCTS ](https://en.wikipedia.org/wiki/Monte_Carlo_tree_search)). More details will be released soon.

### **Integrating User Preference or Expert Knowledge**

Unlike vector-based RAG where integrating expert knowledge or user preference requires fine-tuning the embedding model, in PageIndex, you can incorporate user preferences or expert knowledge by simply adding knowledge to the LLM tree search prompt. Here is an example pipeline.

#### **1\. Preference Retrieval**

When a query is received, the system selects the most relevant user preference or expert knowledge snippets from a database or a set of domain-specific rules. This can be done using keyword matching, semantic similarity, or LLM-based relevance search.

#### **2\. Tree Search with Preference**

Integrating preference into the tree search prompt.

Enhanced Tree Search with Expert Preference Example

prompt \= f"""You are given a question and a tree structure of a document.You need to find all nodes that are likely to contain the answer. Query: {query} Document tree structure:  {PageIndex\_Tree} Expert Knowledge of relevant sections: {Preference} Reply in the following JSON format:{{  "thinking": \<reasoning about which nodes are relevant\>,  "node\_list": \[node\_id1, node\_id2, ...\]}}"""

Example Expert Preference

*If the query mentions EBITDA adjustments, prioritize Item 7 (MD\&A) and footnotes in Item 8 (Financial Statements) in 10-K reports.*

By integrating user or expert preferences, node search becomes more targeted and effective, leveraging both the document structure and domain-specific insights.

# **Hybrid Tree Search**

In [this cookbook ](https://docs.pageindex.ai/cookbook/vectorless-rag-pageindex), we provided a simple example of how to perform tree search with LLMs. However, this approach comes with the following limitations:

* Retrieval Speed: LLM-based tree search can be slower due to the need for LLM reasoning.  
* Summary-based Node Selection: Relying solely on summaries may result in the loss of important details present in the original content.

To address these limitations, we introduce another tree search algorithm for retrieval, which is inspired by [AlphaGo ](https://deepmind.google/research/projects/alphago/).

## **Value-based Tree Search**

For each node in a tree, we can use an AI model to predict a value that represents how likely this node is to contain relevant information for a given query. A simple value function can be constructed with the following procedure using a pre-trained embedding model:

* Chunking: Each node is divided into several smaller chunks.  
* Vector Search: The query is used to search for the top-K most relevant chunks.  
* Node Scoring: For each retrieved chunk, we identify its parent node. The relevance score for a node is calculated by aggregating the similarity scores of its associated chunks.

### **Example Node Scoring Rule**

Let N be the number of content chunks associated with a node, and let ChunkScore(n) be the relevance score of chunk n. The Node Score is computed as:  
NodeScore=1N+1∑n=1NChunkScore(n)  
NodeScore=  
*N*\+1  
​  
1  
​  
∑  
*n*\=1  
*N*  
​  
ChunkScore(*n*)

* The sum aggregates relevance from all related chunks.  
* The \+1 inside the square root ensures the formula handles nodes with zero chunks.  
* Dividing by N (the mean) would normalize the score, but would ignore the number of relevant chunks, treating nodes with many and few relevant chunks equally.  
* Using the square root in the denominator allows the score to increase with the number of relevant chunks, but with diminishing returns. This rewards nodes with more relevant chunks, while preventing large nodes from dominating due to quantity alone.  
* This scoring favors nodes with fewer, highly relevant chunks over those with many weakly relevant ones.

Unlike classic vector-based RAG, in this framework, we retrieve nodes based on their associated chunks, but do not return the chunks themselves.

If the value prediction is accurate, this approach can improve the speed of the LLM-based tree search method. However, if we use a pre-trained embedding model to initialize the value function, it may still miss relevant nodes or struggle to integrate expert knowledge.

## **Hybrid Tree Search with LLM and Value Prediction**

To overcome the limitations of both approaches, we can use the following procedure to combine and leverage the strengths of both methods:  
![Hybrid Tree Search Pipeline][image1]

* Parallel Retrieval: Perform value-based tree search and LLM-based tree search simultaneously.  
* Queue System: Maintain a queue of unique node elements. As nodes are returned from either search, add them to the queue only if they are not already present.  
* Node Consumer: A consumer processes nodes from the queue, extracting or summarizing relevant information from each node.  
* LLM Agent: The agent continually evaluates whether enough information has been gathered. If so, the process can terminate early.

This hybrid approach offers the following advantages:

* Combines the speed of value-based methods with the depth of LLM-based methods.  
* Achieves higher recall than either approach alone by leveraging their complementary strengths.  
* Delivers relevant results quickly, without sacrificing accuracy or completeness.  
* Scales efficiently for large document collections and complex queries.

This hybrid approach is the default search method used in our retrieval API. Experience the power of PageIndex today\!  


