Ollama

Ollama integration for Haystack

Module haystack_integrations.components.generators.ollama.generator

OllamaGenerator

Provides an interface to generate text using an LLM running on Ollama.

Usage example:

from haystack_integrations.components.generators.ollama import OllamaGenerator

generator = OllamaGenerator(model="zephyr",
                            url = "http://localhost:11434",
                            generation_kwargs={
                            "num_predict": 100,
                            "temperature": 0.9,
                            })

print(generator.run("Who is the best American actor?"))

OllamaGenerator.__init__

def __init__(model: str = "orca-mini",
             url: str = "http://localhost:11434",
             generation_kwargs: Optional[Dict[str, Any]] = None,
             system_prompt: Optional[str] = None,
             template: Optional[str] = None,
             raw: bool = False,
             timeout: int = 120,
             keep_alive: Optional[Union[float, str]] = None,
             streaming_callback: Optional[Callable[[StreamingChunk],
                                                   None]] = None)

Arguments:

    model: The name of the model to use. The model should be available in the running Ollama instance.
    url: The URL of a running Ollama instance.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, and others. See the available arguments in Ollama docs.
    system_prompt: Optional system message (overrides what is defined in the Ollama Modelfile).
    template: The full prompt template (overrides what is defined in the Ollama Modelfile).
    raw: If True, no formatting will be applied to the prompt. You may choose to use the raw parameter if you are specifying a full templated prompt in your API request.
    timeout: The number of seconds before throwing a timeout error from the Ollama API.
    streaming_callback: A callback function that is called when a new token is received from the stream. The callback function accepts StreamingChunk as an argument.
    keep_alive: The option that controls how long the model will stay loaded into memory following the request. If not set, it will use the default value from the Ollama (5 minutes). The value can be set to:
    a duration string (such as "10m" or "24h")
    a number in seconds (such as 3600)
    any negative number which will keep the model loaded in memory (e.g. -1 or "-1m")
    '0' which will unload the model immediately after generating a response.

OllamaGenerator.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

Returns:

Dictionary with serialized data.

OllamaGenerator.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "OllamaGenerator"

Deserializes the component from a dictionary.

Arguments:

    data: Dictionary to deserialize from.

Returns:

Deserialized component.

OllamaGenerator.run

@component.output_types(replies=List[str], meta=List[Dict[str, Any]])
def run(prompt: str, generation_kwargs: Optional[Dict[str, Any]] = None)

Runs an Ollama Model on the given prompt.

Arguments:

    prompt: The prompt to generate a response for.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, and others. See the available arguments in Ollama docs.

Returns:

A dictionary with the following keys:

    replies: The responses from the model
    meta: The metadata collected during the run

Module haystack_integrations.components.generators.ollama.chat.chat_generator

OllamaChatGenerator

Supports models running on Ollama, such as llama2 and mixtral. Find the full list of supported models here.

Usage example:
```python
from haystack_integrations.components.generators.ollama import OllamaChatGenerator
from haystack.dataclasses import ChatMessage

generator = OllamaChatGenerator(model="zephyr",
                            url = "http://localhost:11434",
                            generation_kwargs={
                            "num_predict": 100,
                            "temperature": 0.9,
                            })

messages = [ChatMessage.from_system("

You are a helpful, respectful and honest assistant"), ChatMessage.from_user("What's Natural Language Processing?")]

print(generator.run(messages=messages))
```

OllamaChatGenerator.__init__

def __init__(model: str = "orca-mini",
             url: str = "http://localhost:11434",
             generation_kwargs: Optional[Dict[str, Any]] = None,
             timeout: int = 120,
             keep_alive: Optional[Union[float, str]] = None,
             streaming_callback: Optional[Callable[[StreamingChunk],
                                                   None]] = None)

Arguments:

    model: The name of the model to use. The model should be available in the running Ollama instance.
    url: The URL of a running Ollama instance.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, and others. See the available arguments in Ollama docs.
    timeout: The number of seconds before throwing a timeout error from the Ollama API.
    streaming_callback: A callback function that is called when a new token is received from the stream. The callback function accepts StreamingChunk as an argument.
    keep_alive: The option that controls how long the model will stay loaded into memory following the request. If not set, it will use the default value from the Ollama (5 minutes). The value can be set to:
    a duration string (such as "10m" or "24h")
    a number in seconds (such as 3600)
    any negative number which will keep the model loaded in memory (e.g. -1 or "-1m")
    '0' which will unload the model immediately after generating a response.

OllamaChatGenerator.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

Returns:

Dictionary with serialized data.

OllamaChatGenerator.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "OllamaChatGenerator"

Deserializes the component from a dictionary.

Arguments:

    data: Dictionary to deserialize from.

Returns:

Deserialized component.

OllamaChatGenerator.run

@component.output_types(replies=List[ChatMessage])
def run(messages: List[ChatMessage],
        generation_kwargs: Optional[Dict[str, Any]] = None)

Runs an Ollama Model on a given chat history.

Arguments:

    messages: A list of ChatMessage instances representing the input messages.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, etc. See the Ollama docs.
    streaming_callback: A callback function that will be called with each response chunk in streaming mode.

Returns:

A dictionary with the following keys:

    replies: The responses from the model

Module haystack_integrations.components.embedders.ollama.document_embedder

OllamaDocumentEmbedder

Computes the embeddings of a list of Documents and stores the obtained vectors in the embedding field of each Document. It uses embedding models compatible with the Ollama Library.

Usage example:

from haystack import Document
from haystack_integrations.components.embedders.ollama import OllamaDocumentEmbedder

doc = Document(content="What do llamas say once you have thanked them? No probllama!")
document_embedder = OllamaDocumentEmbedder()

result = document_embedder.run([doc])
print(result['documents'][0].embedding)

OllamaDocumentEmbedder.__init__

def __init__(model: str = "nomic-embed-text",
             url: str = "http://localhost:11434",
             generation_kwargs: Optional[Dict[str, Any]] = None,
             timeout: int = 120,
             prefix: str = "",
             suffix: str = "",
             progress_bar: bool = True,
             meta_fields_to_embed: Optional[List[str]] = None,
             embedding_separator: str = "\n",
             batch_size: int = 32)

Arguments:

    model: The name of the model to use. The model should be available in the running Ollama instance.
    url: The URL of a running Ollama instance.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, and others. See the available arguments in Ollama docs.
    timeout: The number of seconds before throwing a timeout error from the Ollama API.
    prefix: A string to add at the beginning of each text.
    suffix: A string to add at the end of each text.
    progress_bar: If True, shows a progress bar when running.
    meta_fields_to_embed: List of metadata fields to embed along with the document text.
    embedding_separator: Separator used to concatenate the metadata fields to the document text.
    batch_size: Number of documents to process at once.

OllamaDocumentEmbedder.run

@component.output_types(documents=List[Document], meta=Dict[str, Any])
def run(documents: List[Document],
        generation_kwargs: Optional[Dict[str, Any]] = None)

Runs an Ollama Model to compute embeddings of the provided documents.

Arguments:

    documents: Documents to be converted to an embedding.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, etc. See the Ollama docs.

Returns:

A dictionary with the following keys:

    documents: Documents with embedding information attached
    meta: The metadata collected during the embedding process

Module haystack_integrations.components.embedders.ollama.text_embedder

OllamaTextEmbedder

Computes the embeddings of a list of Documents and stores the obtained vectors in the embedding field of each Document. It uses embedding models compatible with the Ollama Library.

Usage example:

from haystack_integrations.components.embedders.ollama import OllamaTextEmbedder

embedder = OllamaTextEmbedder()
result = embedder.run(text="What do llamas say once you have thanked them? No probllama!")
print(result['embedding'])

OllamaTextEmbedder.__init__

def __init__(model: str = "nomic-embed-text",
             url: str = "http://localhost:11434",
             generation_kwargs: Optional[Dict[str, Any]] = None,
             timeout: int = 120)

Arguments:

    model: The name of the model to use. The model should be available in the running Ollama instance.
    url: The URL of a running Ollama instance.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, and others. See the available arguments in Ollama docs.
    timeout: The number of seconds before throwing a timeout error from the Ollama API.

OllamaTextEmbedder.run

@component.output_types(embedding=List[float], meta=Dict[str, Any])
def run(text: str, generation_kwargs: Optional[Dict[str, Any]] = None)

Runs an Ollama Model to compute embeddings of the provided text.

Arguments:

    text: Text to be converted to an embedding.
    generation_kwargs: Optional arguments to pass to the Ollama generation endpoint, such as temperature, top_p, etc. See the Ollama docs.

Returns:

A dictionary with the following keys:

    embedding: The computed embeddings
    meta: The metadata collected during the embedding process
