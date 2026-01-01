import os
import sys
import shutil
import tempfile
import subprocess
import json
import boto3
import hashlib
import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from botocore.client import Config
from pythonjsonlogger import jsonlogger
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Configuration
SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "hestami-worker-document")
OTEL_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://signoz-otel-collector:4318")
S3_ENDPOINT = os.getenv("SEAWEEDFS_S3_ENDPOINT", "http://hestami-seaweedfs-s3:8333")
S3_ACCESS_KEY = os.getenv("SEAWEEDFS_S3_ACCESS_KEY", "hestami_admin")
S3_SECRET_KEY = os.getenv("SEAWEEDFS_S3_SECRET_KEY", "hestami_secret")
S3_BUCKET = "uploads"
MAX_CONCURRENT_TASKS = int(os.getenv("MAX_CONCURRENT_TASKS", "3"))

# Setup structured JSON logging
class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['service.name'] = SERVICE_NAME
        log_record['level'] = record.levelname.lower()
        log_record['module'] = record.name
        # Add trace context if available
        span = trace.get_current_span()
        if span and span.is_recording():
            ctx = span.get_span_context()
            log_record['trace_id'] = format(ctx.trace_id, '032x')
            log_record['span_id'] = format(ctx.span_id, '016x')

def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(CustomJsonFormatter(
        '%(timestamp)s %(level)s %(name)s %(message)s',
        timestamp=True
    ))
    root_logger = logging.getLogger()
    root_logger.handlers = []
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO)
    # Reduce noise from boto3/urllib3
    logging.getLogger('boto3').setLevel(logging.WARNING)
    logging.getLogger('botocore').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)

setup_logging()
logger = logging.getLogger('DocumentWorker')

# Setup OpenTelemetry tracing
def setup_tracing():
    resource = Resource.create({"service.name": SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    if OTEL_ENDPOINT:
        exporter = OTLPSpanExporter(endpoint=f"{OTEL_ENDPOINT}/v1/traces")
        provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return trace.get_tracer(SERVICE_NAME)

tracer = setup_tracing()

# Semaphore and Executor to limit CPU-intensive tasks
process_semaphore = asyncio.Semaphore(MAX_CONCURRENT_TASKS)
executor = ThreadPoolExecutor(max_workers=20)

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
    storagePath: str  # This is the object key in S3

app = FastAPI(title="Hestami Document Worker", version="1.0.0")

# Instrument FastAPI with OpenTelemetry
FastAPIInstrumentor.instrument_app(app)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": SERVICE_NAME}

@app.post("/process")
async def process_document(request: ProcessRequest):
    async with process_semaphore:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(executor, sync_process_document, request)

def sync_process_document(request: ProcessRequest):
    """Process a document: download, scan, extract metadata, generate derivatives."""
    with tracer.start_as_current_span("process_document") as span:
        span.set_attribute("document.id", request.documentId)
        span.set_attribute("document.storage_path", request.storagePath)
        
        logger.info("Starting document processing", extra={
            "documentId": request.documentId,
            "storagePath": request.storagePath
        })
        
        tmp_path = None
        try:
            # 1. Download from S3
            with tracer.start_as_current_span("download_from_s3"):
                s3 = get_s3_client()
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    tmp_path = tmp.name
                    logger.debug("Downloading file from S3", extra={
                        "documentId": request.documentId,
                        "bucket": S3_BUCKET,
                        "key": request.storagePath,
                        "tmpPath": tmp_path
                    })
                    s3.download_file(S3_BUCKET, request.storagePath, tmp_path)

            # 1b. Calculate Hash
            with tracer.start_as_current_span("calculate_hash"):
                sha256_hash = hashlib.sha256()
                with open(tmp_path, "rb") as f:
                    for byte_block in iter(lambda: f.read(65536), b""):
                        sha256_hash.update(byte_block)
                file_hash = sha256_hash.hexdigest()
                span.set_attribute("document.checksum", file_hash)
                logger.info("Calculated file hash", extra={
                    "documentId": request.documentId,
                    "checksum": file_hash
                })

            # 2. ClamAV Scan
            with tracer.start_as_current_span("clamav_scan") as scan_span:
                logger.info("Running ClamAV scan", extra={"documentId": request.documentId})
                clam_result = subprocess.run(
                    ['clamscan', '--no-summary', tmp_path],
                    capture_output=True, text=True
                )
                is_infected = clam_result.returncode == 1
                scan_span.set_attribute("scan.infected", is_infected)
                scan_span.set_attribute("scan.return_code", clam_result.returncode)
                
                if is_infected:
                    logger.warning("Malware detected in document", extra={
                        "documentId": request.documentId,
                        "malwareInfo": clam_result.stdout.strip()
                    })
                    span.set_attribute("document.status", "infected")
                    os.unlink(tmp_path)
                    return {
                        "status": "infected",
                        "metadata": {"malware_info": clam_result.stdout}
                    }
                elif clam_result.returncode != 0:
                    logger.error("ClamAV scan error", extra={
                        "documentId": request.documentId,
                        "returnCode": clam_result.returncode,
                        "stderr": clam_result.stderr
                    })
                else:
                    logger.info("ClamAV scan clean", extra={"documentId": request.documentId})

            # 3. Metadata Extraction (ExifTool)
            metadata = {}
            with tracer.start_as_current_span("extract_metadata"):
                logger.debug("Extracting metadata with ExifTool", extra={
                    "documentId": request.documentId
                })
                exif_result = subprocess.run(
                    ['exiftool', '-json', tmp_path],
                    capture_output=True, text=True
                )
                if exif_result.returncode == 0:
                    try:
                        meta_list = json.loads(exif_result.stdout)
                        if meta_list:
                            metadata = meta_list[0]
                            if "SourceFile" in metadata:
                                del metadata["SourceFile"]
                            logger.info("Metadata extracted", extra={
                                "documentId": request.documentId,
                                "mimeType": metadata.get("MIMEType"),
                                "fileSize": metadata.get("FileSize")
                            })
                    except Exception as e:
                        logger.error("Error parsing ExifTool output", extra={
                            "documentId": request.documentId,
                            "error": str(e)
                        })

            # 4. Derivative Generation (Thumbnails/Poster Frames)
            derivatives = {}
            with tracer.start_as_current_span("generate_derivatives"):
                try:
                    derivatives = generate_derivatives(request.documentId, tmp_path, metadata, s3)
                    if derivatives:
                        logger.info("Derivatives generated", extra={
                            "documentId": request.documentId,
                            "derivatives": list(derivatives.keys())
                        })
                except Exception as e:
                    logger.warning("Derivative generation failed", extra={
                        "documentId": request.documentId,
                        "error": str(e)
                    })
            
            # 5. Cleanup
            os.unlink(tmp_path)
            
            span.set_attribute("document.status", "clean")
            logger.info("Document processing completed", extra={
                "documentId": request.documentId,
                "status": "clean",
                "checksum": file_hash,
                "hasDerivatives": bool(derivatives)
            })

            return {
                "status": "clean",
                "metadata": metadata,
                "checksum": file_hash,
                "derivatives": derivatives
            }

        except Exception as e:
            logger.exception("Error processing document", extra={
                "documentId": request.documentId,
                "error": str(e)
            })
            span.set_attribute("error", True)
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise HTTPException(status_code=500, detail=str(e))

def generate_derivatives(doc_id: str, local_path: str, metadata: dict, s3):
    """Generate thumbnails and poster frames for documents."""
    mime_type = metadata.get("MIMEType", "")
    derivatives = {}
    
    # Image Thumbnails
    if mime_type.startswith("image/"):
        thumb_path = local_path + ".thumb.webp"
        try:
            import pyvips
            logger.debug("Generating image thumbnail", extra={
                "documentId": doc_id,
                "mimeType": mime_type
            })
            image = pyvips.Image.new_from_file(local_path, access='sequential')
            thumb = image.thumbnail_image(250)
            thumb.write_to_file(thumb_path)
            
            s3_key = f"derivatives/{doc_id}/thumb.webp"
            s3.upload_file(thumb_path, S3_BUCKET, s3_key)
            derivatives["thumbnail"] = s3_key
            os.unlink(thumb_path)
            logger.info("Image thumbnail generated", extra={
                "documentId": doc_id,
                "s3Key": s3_key
            })
        except Exception as e:
            logger.error("VIPS thumbnail generation failed", extra={
                "documentId": doc_id,
                "error": str(e)
            })
    
    # Video Poster Frames
    elif mime_type.startswith("video/"):
        poster_path = local_path + ".poster.jpg"
        try:
            logger.debug("Generating video poster frame", extra={
                "documentId": doc_id,
                "mimeType": mime_type
            })
            subprocess.run([
                'ffmpeg', '-i', local_path, '-ss', '00:00:01', 
                '-vframes', '1', '-y', poster_path
            ], capture_output=True, check=True)
            
            s3_key = f"derivatives/{doc_id}/poster.jpg"
            s3.upload_file(poster_path, S3_BUCKET, s3_key)
            derivatives["poster"] = s3_key
            os.unlink(poster_path)
            logger.info("Video poster frame generated", extra={
                "documentId": doc_id,
                "s3Key": s3_key
            })
        except Exception as e:
            logger.error("FFmpeg poster generation failed", extra={
                "documentId": doc_id,
                "error": str(e)
            })

    return derivatives

@app.on_event("startup")
async def startup_event():
    logger.info("Document worker starting", extra={
        "s3Endpoint": S3_ENDPOINT,
        "maxConcurrentTasks": MAX_CONCURRENT_TASKS,
        "otelEndpoint": OTEL_ENDPOINT
    })

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Document worker shutting down")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
