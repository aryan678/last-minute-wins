"""Request models. Responses are plain dicts built by the services, so the shapes stay in one place."""
from typing import Literal

from pydantic import BaseModel, Field

ClaimStatus = Literal[
    "FNOL received", "Awaiting documents", "Documents received", "Under review",
    "Additional evidence required", "Escalated for human review", "Ready for adjuster decision", "Closed",
]
TaskStatus = Literal["Not started", "In progress", "Completed"]
NoteKind = Literal["note", "evidence_requested", "evidence_received", "review_completed"]


class NoteIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    kind: NoteKind = "note"
    document_type: str | None = Field(default=None, max_length=60)
    author: str = Field(default="adjuster", max_length=80)


class ClaimPatchIn(BaseModel):
    status: ClaimStatus | None = None
    adjuster_id: str | None = Field(default=None, max_length=20)


class DocumentPatchIn(BaseModel):
    review_status: Literal["unreviewed", "reviewed"] | None = None


class ReadinessPlanIn(BaseModel):
    event_id: str = Field(min_length=1, max_length=60)


class TaskPatchIn(BaseModel):
    status: TaskStatus | None = None
    note: str | None = Field(default=None, max_length=1000)
