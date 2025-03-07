from fastapi import FastAPI, UploadFile, Form
from chunker import process_html
import uvicorn
import tempfile
import os

app = FastAPI(title="HTML Chunker API", version="1.0")

@app.post("/process/")
async def process_html_endpoint(
    file: UploadFile = None, url: str = Form(None)
):
    """
    Process HTML from either an uploaded file or a URL.
    Returns JSON containing chunked text with metadata.
    """
    if file:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name
        chunks = process_html(temp_file_path, is_url=False)
        os.unlink(temp_file_path)  # Delete temp file
    elif url:
        chunks = process_html(url, is_url=True)
    else:
        return {"error": "Provide either a file or a URL"}

    return {"chunks": chunks}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
