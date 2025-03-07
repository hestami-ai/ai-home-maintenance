PreProcessors

Preprocess your Documents and texts. Clean, split, and more.

Module document_cleaner

DocumentCleaner

Cleans the text in the documents.

It removes extra whitespaces, empty lines, specified substrings, regexes, page headers and footers (in this order).
Usage example:

from haystack import Document
from haystack.components.preprocessors import DocumentCleaner

doc = Document(content="This   is  a  document  to  clean\n\n\nsubstring to remove")

cleaner = DocumentCleaner(remove_substrings = ["substring to remove"])
result = cleaner.run(documents=[doc])

assert result["documents"][0].content == "This is a document to clean "

DocumentCleaner.__init__

def __init__(remove_empty_lines: bool = True,
             remove_extra_whitespaces: bool = True,
             remove_repeated_substrings: bool = False,
             keep_id: bool = False,
             remove_substrings: Optional[List[str]] = None,
             remove_regex: Optional[str] = None,
             unicode_normalization: Optional[Literal["NFC", "NFKC", "NFD",
                                                     "NFKD"]] = None,
             ascii_only: bool = False)

Initialize DocumentCleaner.

Arguments:

    remove_empty_lines: If True, removes empty lines.
    remove_extra_whitespaces: If True, removes extra whitespaces.
    remove_repeated_substrings: If True, removes repeated substrings (headers and footers) from pages. Pages must be separated by a form feed character "\f", which is supported by TextFileToDocument and AzureOCRDocumentConverter.
    remove_substrings: List of substrings to remove from the text.
    remove_regex: Regex to match and replace substrings by "".
    keep_id: If True, keeps the IDs of the original documents.
    unicode_normalization: Unicode normalization form to apply to the text. Note: This will run before any other steps.
    ascii_only: Whether to convert the text to ASCII only. Will remove accents from characters and replace them with ASCII characters. Other non-ASCII characters will be removed. Note: This will run before any pattern matching or removal.

DocumentCleaner.run

@component.output_types(documents=List[Document])
def run(documents: List[Document])

Cleans up the documents.

Arguments:

    documents: List of Documents to clean.

Raises:

    TypeError: if documents is not a list of Documents.

Returns:

A dictionary with the following key:

    documents: List of cleaned Documents.

Module document_splitter

DocumentSplitter

Splits long documents into smaller chunks.

This is a common preprocessing step during indexing. It helps Embedders create meaningful semantic representations and prevents exceeding language model context limits.

The DocumentSplitter is compatible with the following DocumentStores:

    Astra
    Chroma limited support, overlapping information is not stored
    Elasticsearch
    OpenSearch
    Pgvector
    Pinecone limited support, overlapping information is not stored
    Qdrant
    Weaviate

Usage example

from haystack import Document
from haystack.components.preprocessors import DocumentSplitter

doc = Document(content="Moonlight shimmered softly, wolves howled nearby, night enveloped everything.")

splitter = DocumentSplitter(split_by="word", split_length=3, split_overlap=0)
result = splitter.run(documents=[doc])

DocumentSplitter.__init__

def __init__(split_by: Literal["function", "page", "passage", "sentence",
                               "word", "line"] = "word",
             split_length: int = 200,
             split_overlap: int = 0,
             split_threshold: int = 0,
             splitting_function: Optional[Callable[[str], List[str]]] = None)

Initialize DocumentSplitter.

Arguments:

    split_by: The unit for splitting your documents. Choose from word for splitting by spaces (" "), sentence for splitting by periods ("."), page for splitting by form feed ("\f"), passage for splitting by double line breaks ("\n\n") or line for splitting each line ("\n").
    split_length: The maximum number of units in each split.
    split_overlap: The number of overlapping units for each split.
    split_threshold: The minimum number of units per split. If a split has fewer units than the threshold, it's attached to the previous split.
    splitting_function: Necessary when split_by is set to "function". This is a function which must accept a single str as input and return a list of str as output, representing the chunks after splitting.

DocumentSplitter.run

@component.output_types(documents=List[Document])
def run(documents: List[Document])

Split documents into smaller parts.

Splits documents by the unit expressed in split_by, with a length of split_length and an overlap of split_overlap.

Arguments:

    documents: The documents to split.

Raises:

    TypeError: if the input is not a list of Documents.
    ValueError: if the content of a document is None.

Returns:

A dictionary with the following key:

    documents: List of documents with the split texts. Each document includes:
    A metadata field source_id to track the original document.
    A metadata field page_number to track the original page number.
    All other metadata copied from the original document.

DocumentSplitter.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

DocumentSplitter.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "DocumentSplitter"

Deserializes the component from a dictionary.

Module text_cleaner

TextCleaner

Cleans text strings.

It can remove substrings matching a list of regular expressions, convert text to lowercase, remove punctuation, and remove numbers. Use it to clean up text data before evaluation.
Usage example

from haystack.components.preprocessors import TextCleaner

text_to_clean = "1Moonlight shimmered softly, 300 Wolves howled nearby, Night enveloped everything."

cleaner = TextCleaner(convert_to_lowercase=True, remove_punctuation=False, remove_numbers=True)
result = cleaner.run(texts=[text_to_clean])

TextCleaner.__init__

def __init__(remove_regexps: Optional[List[str]] = None,
             convert_to_lowercase: bool = False,
             remove_punctuation: bool = False,
             remove_numbers: bool = False)

Initializes the TextCleaner component.

Arguments:

    remove_regexps: A list of regex patterns to remove matching substrings from the text.
    convert_to_lowercase: If True, converts all characters to lowercase.
    remove_punctuation: If True, removes punctuation from the text.
    remove_numbers: If True, removes numerical digits from the text.

TextCleaner.run

@component.output_types(texts=List[str])
def run(texts: List[str]) -> Dict[str, Any]

Cleans up the given list of strings.

Arguments:

    texts: List of strings to clean.

Returns:

A dictionary with the following key:

    texts: the cleaned list of strings.

Module nltk_document_splitter

NLTKDocumentSplitter

NLTKDocumentSplitter.__init__

def __init__(split_by: Literal["word", "sentence", "page", "passage",
                               "function"] = "word",
             split_length: int = 200,
             split_overlap: int = 0,
             split_threshold: int = 0,
             respect_sentence_boundary: bool = False,
             language: Language = "en",
             use_split_rules: bool = True,
             extend_abbreviations: bool = True,
             splitting_function: Optional[Callable[[str], List[str]]] = None)

Splits your documents using NLTK to respect sentence boundaries.

Initialize the NLTKDocumentSplitter.

Arguments:

    split_by: Select the unit for splitting your documents. Choose from word for splitting by spaces (" "), sentence for splitting by NLTK sentence tokenizer, page for splitting by the form feed ("\f") or passage for splitting by double line breaks ("\n\n").
    split_length: The maximum number of units in each split.
    split_overlap: The number of overlapping units for each split.
    split_threshold: The minimum number of units per split. If a split has fewer units than the threshold, it's attached to the previous split.
    respect_sentence_boundary: Choose whether to respect sentence boundaries when splitting by "word". If True, uses NLTK to detect sentence boundaries, ensuring splits occur only between sentences.
    language: Choose the language for the NLTK tokenizer. The default is English ("en").
    use_split_rules: Choose whether to use additional split rules when splitting by sentence.
    extend_abbreviations: Choose whether to extend NLTK's PunktTokenizer abbreviations with a list of curated abbreviations, if available. This is currently supported for English ("en") and German ("de").
    splitting_function: Necessary when split_by is set to "function". This is a function which must accept a single str as input and return a list of str as output, representing the chunks after splitting.

NLTKDocumentSplitter.run

@component.output_types(documents=List[Document])
def run(documents: List[Document]) -> Dict[str, List[Document]]

Split documents into smaller parts.

Splits documents by the unit expressed in split_by, with a length of split_length and an overlap of split_overlap.

Arguments:

    documents: The documents to split.

Raises:

    TypeError: if the input is not a list of Documents.
    ValueError: if the content of a document is None.

Returns:

A dictionary with the following key:

    documents: List of documents with the split texts. Each document includes:
    A metadata field source_id to track the original document.
    A metadata field page_number to track the original page number.
    All other metadata copied from the original document.

NLTKDocumentSplitter.to_dict

def to_dict() -> Dict[str, Any]

Serializes the component to a dictionary.

NLTKDocumentSplitter.from_dict

@classmethod
def from_dict(cls, data: Dict[str, Any]) -> "DocumentSplitter"

Deserializes the component from a dictionary.

Updated 28 days ago 