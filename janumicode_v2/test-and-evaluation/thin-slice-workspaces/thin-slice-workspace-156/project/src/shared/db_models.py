"""
Core ORM models and utility functions for the TinyURL service.
Includes encrypted mappings table and related entities.
"""

from typing import Optional
from datetime import datetime
from uuid import UUID
from sqlalchemy import Column, String, DateTime, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

Base = declarative_base()


class LinkMapping(Base):
    """
    Represents a mapping between a short URL slug and the original URL.
    """
    
    __tablename__ = "link_mappings"
    
    id: UUID = Column(PG_UUID(as_uuid=True), primary_key=True)
    slug: str = Column(String(6), unique=True, nullable=False)
    encrypted_destination_url: str = Column(String, nullable=False)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False)


class RedirectionEvent(Base):
    """
    Represents a redirection event for a link.
    """
    
    __tablename__ = "redirection_events"
    
    id: UUID = Column(PG_UUID(as_uuid=True), primary_key=True)
    slug: str = Column(String, nullable=False)  # Foreign key to LinkMapping.slug
    timestamp: datetime = Column(DateTime(timezone=True), nullable=False)
    encrypted_client_metadata: str = Column(String, nullable=False)


class ClickAggregate(Base):
    """
    Aggregated click data for a link.
    """
    
    __tablename__ = "click_aggregates"
    
    slug: str = Column(String, primary_key=True)  # Foreign key to LinkMapping.slug
    total_clicks: int = Column(BigInteger, nullable=False, default=0)
    last_click_at: Optional[datetime] = Column(DateTime(timezone=True), nullable=True)


class MetricDataPointDTO:
    """
    Data transfer object for metrics data point.
    """
    
    def __init__(self, slug: str, total_clicks: int, last_click_at: Optional[datetime]):
        self.slug = slug
        self.total_clicks = total_clicks
        self.last_click_at = last_click_at


class ErasureAuditRecord:
    """
    Audit record for data erasure operations.
    """
    
    def __init__(self, audit_id: UUID, erased_slug: str, timestamp: datetime):
        self.audit_id = audit_id
        self.erased_slug = erased_slug
        self.timestamp = timestamp