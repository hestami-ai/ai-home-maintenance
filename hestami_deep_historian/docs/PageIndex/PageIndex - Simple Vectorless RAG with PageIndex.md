# Simple Vectorless RAG with PageIndex

## PageIndex Introduction

PageIndex is a new **reasoning-based**, **vectorless RAG** framework that performs retrieval in two steps:

1. Generate a tree structure index of documents  
2. Perform reasoning-based retrieval through tree search

![][image1]  
Compared to traditional vector-based RAG, PageIndex features:

* **No Vectors Needed**: Uses document structure and LLM reasoning for retrieval.  
* **No Chunking Needed**: Documents are organized into natural sections rather than artificial chunks.  
* **Human-like Retrieval**: Simulates how human experts navigate and extract knowledge from complex documents.  
* **Transparent Retrieval Process**: Retrieval based on reasoning — say goodbye to approximate semantic search ("vibe retrieval").

## 📝 Notebook Overview

This notebook demonstrates a simple, minimal example of **vectorless RAG** with PageIndex. You will learn how to:

* Build a PageIndex tree structure of a document  
* Perform reasoning-based retrieval with tree search  
* Generate answers based on the retrieved context

⚡ Note: This is a **minimal example** to illustrate PageIndex's core philosophy and idea, not its full capabilities. More advanced examples are coming soon.

---

## Step 0: Preparation

#### 0.1 Install PageIndex

**%pip** install \-q \--upgrade pageindex

#### 0.2 Setup PageIndex

**from** pageindex **import** PageIndexClient  
**import** pageindex.utils **as** utils

*\# Get your PageIndex API key from https://dash.pageindex.ai/api-keys*  
PAGEINDEX\_API\_KEY **\=** "YOUR\_PAGEINDEX\_API\_KEY"  
pi\_client **\=** PageIndexClient(api\_key**\=**PAGEINDEX\_API\_KEY)

#### 0.3 Setup LLM

Choose your preferred LLM for reasoning-based retrieval. In this example, we use OpenAI’s GPT-4.1.

**import** openai  
OPENAI\_API\_KEY **\=** "YOUR\_OPENAI\_API\_KEY"

**async** **def** call\_llm(prompt, model**\=**"gpt-4.1", temperature**\=**0):  
    client **\=** openai**.**AsyncOpenAI(api\_key**\=**OPENAI\_API\_KEY)  
    response **\=** **await** client**.**chat**.**completions**.**create(  
        model**\=**model,  
        messages**\=**\[{"role": "user", "content": prompt}\],  
        temperature**\=**temperature  
    )  
    **return** response**.**choices\[0\]**.**message**.**content**.**strip()

## Step 1: PageIndex Tree Generation

#### 1.1 Submit a document for generating PageIndex tree

**import** os**,** requests

*\# You can also use our GitHub repo to generate PageIndex tree*  
*\# https://github.com/VectifyAI/PageIndex*

pdf\_url **\=** "https://arxiv.org/pdf/2501.12948.pdf"  
pdf\_path **\=** os**.**path**.**join("../data", pdf\_url**.**split('/')\[**\-**1\])  
os**.**makedirs(os**.**path**.**dirname(pdf\_path), exist\_ok**\=True**)

response **\=** requests**.**get(pdf\_url)  
**with** open(pdf\_path, "wb") **as** f:  
    f**.**write(response**.**content)  
print(f"Downloaded {pdf\_url}")

doc\_id **\=** pi\_client**.**submit\_document(pdf\_path)\["doc\_id"\]  
print('Document Submitted:', doc\_id)

Downloaded https://arxiv.org/pdf/2501.12948.pdf  
Document Submitted: pi-cmeseq08w00vt0bo3u6tr244g

#### 1.2 Get the generated PageIndex tree structure

**if** pi\_client**.**is\_retrieval\_ready(doc\_id):  
    tree **\=** pi\_client**.**get\_tree(doc\_id, node\_summary**\=True**)\['result'\]  
    print('Simplified Tree Structure of the Document:')  
    utils**.**print\_tree(tree)  
**else**:  
    print("Processing document, please try again later...")

Simplified Tree Structure of the Document:  
\[{'title': 'DeepSeek-R1: Incentivizing Reasoning Cap...',  
  'node\_id': '0000',  
  'prefix\_summary': '\# DeepSeek-R1: Incentivizing Reasoning C...',  
  'nodes': \[{'title': 'Abstract',  
             'node\_id': '0001',  
             'summary': 'The partial document introduces two reas...'},  
            {'title': 'Contents',  
             'node\_id': '0002',  
             'summary': 'This partial document provides a detaile...'},  
            {'title': '1. Introduction',  
             'node\_id': '0003',  
             'prefix\_summary': 'The partial document introduces recent a...',  
             'nodes': \[{'title': '1.1. Contributions',  
                        'node\_id': '0004',  
                        'summary': 'This partial document outlines the main ...'},  
                       {'title': '1.2. Summary of Evaluation Results',  
                        'node\_id': '0005',  
                        'summary': 'The partial document provides a summary ...'}\]},  
            {'title': '2. Approach',  
             'node\_id': '0006',  
             'prefix\_summary': '\#\# 2\. Approach\\n',  
             'nodes': \[{'title': '2.1. Overview',  
                        'node\_id': '0007',  
                        'summary': '\#\#\# 2.1. Overview\\n\\nPrevious work has hea...'},  
                       {'title': '2.2. DeepSeek-R1-Zero: Reinforcement Lea...',  
                        'node\_id': '0008',  
                        'prefix\_summary': '\#\#\# 2.2. DeepSeek-R1-Zero: Reinforcement...',  
                        'nodes': \[{'title': '2.2.1. Reinforcement Learning Algorithm',  
                                   'node\_id': '0009',  
                                   'summary': 'The partial document describes the Group...'},  
                                  {'title': '2.2.2. Reward Modeling',  
                                   'node\_id': '0010',  
                                   'summary': 'This partial document discusses the rewa...'},  
                                  {'title': '2.2.3. Training Template',  
                                   'node\_id': '0011',  
                                   'summary': '\#\#\#\# 2.2.3. Training Template\\n\\nTo train ...'},  
                                  {'title': '2.2.4. Performance, Self-evolution Proce...',  
                                   'node\_id': '0012',  
                                   'summary': 'This partial document discusses the perf...'}\]},  
                       {'title': '2.3. DeepSeek-R1: Reinforcement Learning...',  
                        'node\_id': '0013',  
                        'summary': 'This partial document describes the trai...'},  
                       {'title': '2.4. Distillation: Empower Small Models ...',  
                        'node\_id': '0014',  
                        'summary': 'This partial document discusses the proc...'}\]},  
            {'title': '3. Experiment',  
             'node\_id': '0015',  
             'prefix\_summary': 'The partial document describes the exper...',  
             'nodes': \[{'title': '3.1. DeepSeek-R1 Evaluation',  
                        'node\_id': '0016',  
                        'summary': 'This partial document presents a compreh...'},  
                       {'title': '3.2. Distilled Model Evaluation',  
                        'node\_id': '0017',  
                        'summary': 'This partial document presents an evalua...'}\]},  
            {'title': '4. Discussion',  
             'node\_id': '0018',  
             'summary': 'This partial document discusses the comp...'},  
            {'title': '5. Conclusion, Limitations, and Future W...',  
             'node\_id': '0019',  
             'summary': 'This partial document presents the concl...'},  
            {'title': 'References',  
             'node\_id': '0020',  
             'summary': 'This partial document consists of the re...'},  
            {'title': 'Appendix', 'node\_id': '0021', 'summary': '\#\# Appendix\\n'},  
            {'title': 'A. Contributions and Acknowledgments',  
             'node\_id': '0022',  
             'summary': 'This partial document section details th...'}\]}\]

## Step 2: Reasoning-Based Retrieval with Tree Search

#### 2.1 Use LLM for tree search and identify nodes that might contain relevant context

**import** json

query **\=** "What are the conclusions in this document?"

tree\_without\_text **\=** utils**.**remove\_fields(tree**.**copy(), fields**\=**\['text'\])

search\_prompt **\=** f"""  
You are given a question and a tree structure of a document.  
Each node contains a node id, node title, and a corresponding summary.  
Your task is to find all nodes that are likely to contain the answer to the question.

Question: {query}

Document tree structure:  
{json**.**dumps(tree\_without\_text, indent**\=**2)}

Please reply in the following JSON format:  
{{  
    "thinking": "\<Your thinking process on which nodes are relevant to the question\>",  
    "node\_list": \["node\_id\_1", "node\_id\_2", ..., "node\_id\_n"\]  
}}  
Directly return the final JSON structure. Do not output anything else.  
"""

tree\_search\_result **\=** **await** call\_llm(search\_prompt)

#### 2.2 Print retrieved nodes and reasoning process

node\_map **\=** utils**.**create\_node\_mapping(tree)  
tree\_search\_result\_json **\=** json**.**loads(tree\_search\_result)

print('Reasoning Process:')  
utils**.**print\_wrapped(tree\_search\_result\_json\['thinking'\])

print('\\nRetrieved Nodes:')  
**for** node\_id **in** tree\_search\_result\_json\["node\_list"\]:  
    node **\=** node\_map\[node\_id\]  
    print(f"Node ID: {node\['node\_id'\]}\\t Page: {node\['page\_index'\]}\\t Title: {node\['title'\]}")

Reasoning Process:  
The question asks for the conclusions in the document. Typically, conclusions are found in sections  
explicitly titled 'Conclusion' or in sections summarizing the findings and implications of the work.  
In this document tree, node 0019 ('5. Conclusion, Limitations, and Future Work') is the most  
directly relevant, as it is dedicated to the conclusion and related topics. Additionally, the  
'Abstract' (node 0001\) may contain a high-level summary that sometimes includes concluding remarks,  
but it is less likely to contain the full conclusions. Other sections like 'Discussion' (node 0018\)  
may discuss implications but are not explicitly conclusions. Therefore, the primary node is 0019\.

Retrieved Nodes:  
Node ID: 0019	 Page: 16	 Title: 5\. Conclusion, Limitations, and Future Work

## Step 3: Answer Generation

#### 3.1 Extract relevant context from retrieved nodes

node\_list **\=** json**.**loads(tree\_search\_result)\["node\_list"\]  
relevant\_content **\=** "\\n\\n"**.**join(node\_map\[node\_id\]\["text"\] **for** node\_id **in** node\_list)

print('Retrieved Context:\\n')  
utils**.**print\_wrapped(relevant\_content\[:1000\] **\+** '...')

Retrieved Context:

\#\# 5\. Conclusion, Limitations, and Future Work

In this work, we share our journey in enhancing model reasoning abilities through reinforcement  
learning. DeepSeek-R1-Zero represents a pure RL approach without relying on cold-start data,  
achieving strong performance across various tasks. DeepSeek-R1 is more powerful, leveraging cold-  
start data alongside iterative RL fine-tuning. Ultimately, DeepSeek-R1 achieves performance  
comparable to OpenAI-o1-1217 on a range of tasks.

We further explore distillation the reasoning capability to small dense models. We use DeepSeek-R1  
as the teacher model to generate 800K training samples, and fine-tune several small dense models.  
The results are promising: DeepSeek-R1-Distill-Qwen-1.5B outperforms GPT-4o and Claude-3.5-Sonnet on  
math benchmarks with $28.9 \\%$ on AIME and $83.9 \\%$ on MATH. Other dense models also achieve  
impressive results, significantly outperforming other instructiontuned models based on the same  
underlying checkpoints.

In the fut...

#### 3.2 Generate answer based on retrieved context

answer\_prompt **\=** f"""  
Answer the question based on the context:

Question: {query}  
Context: {relevant\_content}

Provide a clear, concise answer based only on the context provided.  
"""

print('Generated Answer:\\n')  
answer **\=** **await** call\_llm(answer\_prompt)  
utils**.**print\_wrapped(answer)

Generated Answer:

The conclusions in this document are:

\- DeepSeek-R1-Zero, a pure reinforcement learning (RL) approach without cold-start data, achieves  
strong performance across various tasks.  
\- DeepSeek-R1, which combines cold-start data with iterative RL fine-tuning, is more powerful and  
achieves performance comparable to OpenAI-o1-1217 on a range of tasks.  
\- Distilling DeepSeek-R1’s reasoning capabilities into smaller dense models is promising; for  
example, DeepSeek-R1-Distill-Qwen-1.5B outperforms GPT-4o and Claude-3.5-Sonnet on math benchmarks,  
and other dense models also show significant improvements over similar instruction-tuned models.

These results demonstrate the effectiveness of the RL-based approach and the potential for  
distilling reasoning abilities into smaller models.

---

## 🎯 What's Next

This notebook has demonstrated a **basic**, **minimal** example of **reasoning-based**, **vectorless** RAG with PageIndex. The workflow illustrates the core idea:

*Generating a hierarchical tree structure from a document, reasoning over that tree structure, and extracting relevant context, without relying on a vector database or top-k similarity search*.

While this notebook highlights a minimal workflow, the PageIndex framework is built to support **far more advanced** use cases. In upcoming tutorials, we will introduce:

* **Multi-Node Reasoning with Content Extraction** — Scale tree search to extract and select relevant content from multiple nodes.  
* **Multi-Document Search** — Enable reasoning-based navigation across large document collections, extending beyond a single file.  
* **Efficient Tree Search** — Improve tree search efficiency for long documents with a large number of nodes.  
* **Expert Knowledge Integration and Preference Alignment** — Incorporate user preferences or expert insights by adding knowledge directly into the LLM tree search, without the need for fine-tuning.

