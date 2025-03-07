FROM python:3.12-slim

RUN apt-get update && apt-get install -y 

RUN pip install --upgrade pip

RUN pip install -U "huggingface_hub[cli]"


# Download the model directly using the Hugging Face CLI
RUN huggingface-cli download microsoft/phi-4-onnx --include gpu/* --local-dir .

RUN huggingface-cli login --token $HF_TOKEN --add-to-git-credential

# Install the CUDA package of ONNX Runtime GenAI
RUN pip install --pre onnxruntime-genai-cuda

# Please adjust the model directory (-m) accordingly 
RUN curl https://raw.githubusercontent.com/microsoft/onnxruntime-genai/main/examples/python/phi3-qa.py -o phi3-qa.py
RUN python phi3-qa.py -m gpu/gpu-int4-rtn-block-32 -e cuda

