"""Claim document uploads. Files are validated, renamed and stored server-side in local demo storage.

Extraction is not performed here. Document AI is not configured in this build, so uploads stay
`awaiting_extraction` and no fields are invented.
"""
import uuid
from datetime import datetime
from pathlib import Path

from app.config import get_settings
from app.store import store

ALLOWED_TYPES = {
    "pdf": (b"%PDF", "application/pdf"),
    "png": (b"\x89PNG", "image/png"),
    "jpg": (b"\xff\xd8\xff", "image/jpeg"),
    "jpeg": (b"\xff\xd8\xff", "image/jpeg"),
}
DOCUMENT_TYPES = {
    "claim_form", "invoice", "repair_estimate", "photos", "police_report", "fire_report",
    "vehicle_registration", "proof_of_ownership", "proof_of_payment", "income_statement",
    "medical_or_liability_documentation", "other",
}


class UploadError(ValueError):
    """Raised for files that fail validation. The message is safe to show to the user."""


def validate_upload(file_name: str, content: bytes, document_type: str) -> str:
    """Return the lower-case extension if the upload is valid, otherwise raise UploadError."""
    if document_type not in DOCUMENT_TYPES:
        raise UploadError(f"Unsupported document type '{document_type}'.")
    ext = Path(file_name or "").suffix.lower().lstrip(".")
    if ext not in ALLOWED_TYPES:
        raise UploadError("Only PDF, PNG, JPG and JPEG files are accepted.")
    max_bytes = int(get_settings().max_upload_mb * 1024 * 1024)
    if not content:
        raise UploadError("The file is empty.")
    if len(content) > max_bytes:
        raise UploadError(f"The file is larger than {get_settings().max_upload_mb:g} MB.")
    magic, _ = ALLOWED_TYPES[ext]
    if not content.startswith(magic):
        raise UploadError("The file content does not match its extension.")
    return ext


def store_upload(claim_id: str, file_name: str, content: bytes, document_type: str) -> dict:
    ext = validate_upload(file_name, content, document_type)
    object_name = f"{uuid.uuid4().hex}.{ext}"  # never trust the client file name as a path
    target_dir = get_settings().upload_dir / claim_id
    target_dir.mkdir(parents=True, exist_ok=True)
    (target_dir / object_name).write_bytes(content)

    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    record = {
        "document_id": doc_id,
        "claim_id": claim_id,
        "file_name": Path(file_name).name,
        "document_type": document_type,
        "uploaded_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "processing_status": "awaiting_extraction",
        "extraction_source": None,
        "extracted_fields": {},
        "extraction_confidence": None,
        "review_status": "unreviewed",
        "storage": "local_demo_storage",
        "object_name": object_name,
    }
    store.documents[doc_id] = record
    store.log(claim_id, "document", f"Uploaded {record['file_name']} as {document_type}.")
    return record
