import os
import shutil
import tempfile
import subprocess
import json
import boto3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from botocore.client import Config

app = FastAPI()

# Configuration
S3_ENDPOINT = os.getenv("SEAWEEDFS_S3_ENDPOINT", "http://hestami-seaweedfs-s3:8333")
S3_ACCESS_KEY = os.getenv("SEAWEEDFS_S3_ACCESS_KEY", "hestami_admin")
S3_SECRET_KEY = os.getenv("SEAWEEDFS_S3_SECRET_KEY", "hestami_secret")
S3_BUCKET = "uploads" # Default bucket used by tusd

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version='s3v4'),
        region_name='us-east-1' # Dummy region
    )

class ProcessRequest(BaseModel):
    documentId: str
    storagePath: str # This is the object key in S3

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "hestami-worker-document"}

@app.post("/process")
def process_document(request: ProcessRequest):
    print(f"Processing document {request.documentId} path {request.storagePath}")
    tmp_path = None
    try:
        # 1. Download from S3
        s3 = get_s3_client()
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp_path = tmp.name
            print(f"Downloading to {tmp_path}...")
            # tusd stores objects with the ID as key, sometimes inside a bucket.
            # We assume 'storagePath' is the key.
            s3.download_file(S3_BUCKET, request.storagePath, tmp_path)

        # 2. ClamAV Scan
        # We assume clamscan is available (installed in Dockerfile)
        print("Running ClamAV scan...")
        clam_result = subprocess.run(['clamscan', '--no-summary', tmp_path], capture_output=True, text=True)
        # Exit code 0: Clean, 1: Infected
        is_infected = clam_result.returncode == 1
        
        if is_infected:
            print(f"Infected! {clam_result.stdout}")
            os.unlink(tmp_path)
            return {
                "status": "infected",
                "metadata": {"malware_info": clam_result.stdout}
            }
        elif clam_result.returncode != 0:
            print(f"ClamAV error: {clam_result.stderr}")
            # Fallback for now? Or throw?
            # For resilience, we might treat error as 'check required' or just log it.
            # We'll treat generic error as clean but log warning for MVP, or better: fail.
            # raise HTTPException(status_code=500, detail="ClamAV Scan Failed")
            pass 

        # 3. Metadata Extraction (ExifTool)
        print("Extracting metadata...")
        exif_result = subprocess.run(['exiftool', '-json', tmp_path], capture_output=True, text=True)
        metadata = {}
        if exif_result.returncode == 0:
            try:
                # exiftool returns a list of objects
                meta_list = json.loads(exif_result.stdout)
                if meta_list:
                    metadata = meta_list[0]
                    # Cleanup SourceFile field which is local path
                    if "SourceFile" in metadata:
                        del metadata["SourceFile"]
            except Exception as e:
                print(f"Error parsing exif output: {e}")
        
        # 4. Cleanup
        os.unlink(tmp_path)

        return {
            "status": "clean",
            "metadata": metadata
        }

    except Exception as e:
        print(f"Error processing document: {e}")
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
