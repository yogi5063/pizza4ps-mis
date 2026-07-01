from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class UploadedMonth(Base):
    __tablename__ = "uploaded_months"

    id = Column(Integer, primary_key=True, index=True)
    module = Column(String, nullable=False, index=True)       # 'revenue' or 'cogs'
    month_key = Column(String, nullable=False, index=True)    # 'YYYY-MM'
    # Outlet this data belongs to (outlet.code, e.g. 'BGL-IDN'). NULL/'ALL' =
    # legacy/consolidated data that predates multi-store tagging.
    store_code = Column(String, nullable=True, index=True)
    data_json = Column(Text, nullable=True)                   # Serialized aggregated data
    status = Column(String, default="processing")             # 'processing', 'done', 'error'
    message = Column(String, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
