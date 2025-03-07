Pipeline

Arranges components and integrations in flow.

Module pipeline

Pipeline

Synchronous version of the orchestration engine.

Orchestrates component execution according to the execution graph, one after the other.

Pipeline.run

def run(data: Dict[str, Any],
        include_outputs_from: Optional[Set[str]] = None) -> Dict[str, Any]

Runs the Pipeline with given input data.

Usage:

from haystack import Pipeline, Document
from haystack.utils import Secret
from haystack.document_stores.in_memory import InMemoryDocumentStore
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.components.generators import OpenAIGenerator
from haystack.components.builders.answer_builder import AnswerBuilder
from haystack.components.builders.prompt_builder import PromptBuilder

# Write documents to InMemoryDocumentStore
document_store = InMemoryDocumentStore()
document_store.write_documents([
    Document(content="My name is Jean and I live in Paris."),
    Document(content="My name is Mark and I live in Berlin."),
    Document(content="My name is Giorgio and I live in Rome.")
])

prompt_template = """
Given these documents, answer the question.
Documents:
{% for doc in documents %}
    {{ doc.content }}
{% endfor %}
Question: {{question}}
Answer:
"""

retriever = InMemoryBM25Retriever(document_store=document_store)
prompt_builder = PromptBuilder(template=prompt_template)
llm = OpenAIGenerator(api_key=Secret.from_token(api_key))

rag_pipeline = Pipeline()
rag_pipeline.add_component("retriever", retriever)
rag_pipeline.add_component("prompt_builder", prompt_builder)
rag_pipeline.add_component("llm", llm)
rag_pipeline.connect("retriever", "prompt_builder.documents")
rag_pipeline.connect("prompt_builder", "llm")

# Ask a question
question = "Who lives in Paris?"
results = rag_pipeline.run(
    {
        "retriever": {"query": question},
        "prompt_builder": {"question": question},
    }
)

print(results["llm"]["replies"])
# Jean lives in Paris

Arguments:

    data: A dictionary of inputs for the pipeline's components. Each key is a component name and its value is a dictionary of that component's input parameters:

data = {
    "comp1": {"input1": 1, "input2": 2},
}

For convenience, this format is also supported when input names are unique:

data = {
    "input1": 1, "input2": 2,
}

    include_outputs_from: Set of component names whose individual outputs are to be included in the pipeline's output. For components that are invoked multiple times (in a loop), only the last-produced output is included.

Raises:

    PipelineRuntimeError: If the Pipeline contains cycles with unsupported connections that would cause it to get stuck and fail running. Or if a Component fails or returns output in an unsupported type.
    PipelineMaxComponentRuns: If a Component reaches the maximum number of times it can be run in this Pipeline.

Returns:

A dictionary where each entry corresponds to a component name and its output. If include_outputs_from is None, this dictionary will only contain the outputs of leaf components, i.e., components without outgoing connections.

Pipeline.__init__

def __init__(metadata: Optional[Dict[str, Any]] = None,
             max_runs_per_component: int = 100)

Creates the Pipeline.

Arguments:

    metadata: Arbitrary dictionary to store metadata about this Pipeline. Make sure all the values contained in this dictionary can be serialized and deserialized if you wish to save this Pipeline to file.
    max_runs_per_component: How many times the Pipeline can run the same Component. If this limit is reached a PipelineMaxComponentRuns exception is raised. If not set defaults to 100 runs per Component.

Pipeline.__eq__

def __eq__(other) -> bool

Pipeline equality is defined by their type and the equality of their serialized form.

Pipelines of the same type share every metadata, node and edge, but they're not required to use the same node instances: this allows pipeline saved and then loaded back to be equal to themselves.

Pipeline.__repr__

def __repr__() -> str

Returns a text representation of the Pipeline.

Pipeline.to_dict

def to_dict() -> Dict[str, Any]

Serializes the pipeline to a dictionary.

This is meant to be an intermediate representation but it can be also used to save a pipeline to file.

Returns:

Dictionary with serialized data.

Pipeline.from_dict

@classmethod
def from_dict(cls: Type[T],
              data: Dict[str, Any],
              callbacks: Optional[DeserializationCallbacks] = None,
              **kwargs) -> T

Deserializes the pipeline from a dictionary.

Arguments:

    data: Dictionary to deserialize from.
    callbacks: Callbacks to invoke during deserialization.
    kwargs: components: a dictionary of {name: instance} to reuse instances of components instead of creating new ones.

Returns:

Deserialized component.

Pipeline.dumps

def dumps(marshaller: Marshaller = DEFAULT_MARSHALLER) -> str

Returns the string representation of this pipeline according to the format dictated by the Marshaller in use.

Arguments:

    marshaller: The Marshaller used to create the string representation. Defaults to YamlMarshaller.

Returns:

A string representing the pipeline.

Pipeline.dump

def dump(fp: TextIO, marshaller: Marshaller = DEFAULT_MARSHALLER)

Writes the string representation of this pipeline to the file-like object passed in the fp argument.

Arguments:

    fp: A file-like object ready to be written to.
    marshaller: The Marshaller used to create the string representation. Defaults to YamlMarshaller.

Pipeline.loads

@classmethod
def loads(cls: Type[T],
          data: Union[str, bytes, bytearray],
          marshaller: Marshaller = DEFAULT_MARSHALLER,
          callbacks: Optional[DeserializationCallbacks] = None) -> T

Creates a Pipeline object from the string representation passed in the data argument.

Arguments:

    data: The string representation of the pipeline, can be str, bytes or bytearray.
    marshaller: The Marshaller used to create the string representation. Defaults to YamlMarshaller.
    callbacks: Callbacks to invoke during deserialization.

Raises:

    DeserializationError: If an error occurs during deserialization.

Returns:

A Pipeline object.

Pipeline.load

@classmethod
def load(cls: Type[T],
         fp: TextIO,
         marshaller: Marshaller = DEFAULT_MARSHALLER,
         callbacks: Optional[DeserializationCallbacks] = None) -> T

Creates a Pipeline object a string representation.

The string representation is read from the file-like object passed in the fp argument.

Arguments:

    fp: A file-like object ready to be read from.
    marshaller: The Marshaller used to create the string representation. Defaults to YamlMarshaller.
    callbacks: Callbacks to invoke during deserialization.

Raises:

    DeserializationError: If an error occurs during deserialization.

Returns:

A Pipeline object.

Pipeline.add_component

def add_component(name: str, instance: Component) -> None

Add the given component to the pipeline.

Components are not connected to anything by default: use Pipeline.connect() to connect components together. Component names must be unique, but component instances can be reused if needed.

Arguments:

    name: The name of the component to add.
    instance: The component instance to add.

Raises:

    ValueError: If a component with the same name already exists.
    PipelineValidationError: If the given instance is not a Canals component.

Pipeline.remove_component

def remove_component(name: str) -> Component

Remove and returns component from the pipeline.

Remove an existing component from the pipeline by providing its name. All edges that connect to the component will also be deleted.

Arguments:

    name: The name of the component to remove.

Raises:

    ValueError: If there is no component with that name already in the Pipeline.

Returns:

The removed Component instance.

Pipeline.connect

def connect(sender: str, receiver: str) -> "PipelineBase"

Connects two components together.

All components to connect must exist in the pipeline. If connecting to a component that has several output connections, specify the inputs and output names as 'component_name.connections_name'.

Arguments:

    sender: The component that delivers the value. This can be either just a component name or can be in the format component_name.connection_name if the component has multiple outputs.
    receiver: The component that receives the value. This can be either just a component name or can be in the format component_name.connection_name if the component has multiple inputs.

Raises:

    PipelineConnectError: If the two components cannot be connected (for example if one of the components is not present in the pipeline, or the connections don't match by type, and so on).

Returns:

The Pipeline instance.

Pipeline.get_component

def get_component(name: str) -> Component

Get the component with the specified name from the pipeline.

Arguments:

    name: The name of the component.

Raises:

    ValueError: If a component with that name is not present in the pipeline.

Returns:

The instance of that component.

Pipeline.get_component_name

def get_component_name(instance: Component) -> str

Returns the name of the Component instance if it has been added to this Pipeline or an empty string otherwise.

Arguments:

    instance: The Component instance to look for.

Returns:

The name of the Component instance.

Pipeline.inputs

def inputs(
    include_components_with_connected_inputs: bool = False
) -> Dict[str, Dict[str, Any]]

Returns a dictionary containing the inputs of a pipeline.

Each key in the dictionary corresponds to a component name, and its value is another dictionary that describes the input sockets of that component, including their types and whether they are optional.

Arguments:

    include_components_with_connected_inputs: If False, only components that have disconnected input edges are included in the output.

Returns:

A dictionary where each key is a pipeline component name and each value is a dictionary of inputs sockets of that component.

Pipeline.outputs

def outputs(
    include_components_with_connected_outputs: bool = False
) -> Dict[str, Dict[str, Any]]

Returns a dictionary containing the outputs of a pipeline.

Each key in the dictionary corresponds to a component name, and its value is another dictionary that describes the output sockets of that component.

Arguments:

    include_components_with_connected_outputs: If False, only components that have disconnected output edges are included in the output.

Returns:

A dictionary where each key is a pipeline component name and each value is a dictionary of output sockets of that component.

Pipeline.show

def show() -> None

If running in a Jupyter notebook, display an image representing this Pipeline.

Pipeline.draw

def draw(path: Path) -> None

Save an image representing this Pipeline to path.

Arguments:

    path: The path to save the image to.

Pipeline.walk

def walk() -> Iterator[Tuple[str, Component]]

Visits each component in the pipeline exactly once and yields its name and instance.

No guarantees are provided on the visiting order.

Returns:

An iterator of tuples of component name and component instance.

Pipeline.warm_up

def warm_up()

Make sure all nodes are warm.

It's the node's responsibility to make sure this method can be called at every Pipeline.run() without re-initializing everything.

Pipeline.from_template

@classmethod
def from_template(
        cls,
        predefined_pipeline: PredefinedPipeline,
        template_params: Optional[Dict[str, Any]] = None) -> "PipelineBase"

Create a Pipeline from a predefined template. See PredefinedPipeline for available options.

Arguments:

    predefined_pipeline: The predefined pipeline to use.
    template_params: An optional dictionary of parameters to use when rendering the pipeline template.

Returns:

An instance of Pipeline.