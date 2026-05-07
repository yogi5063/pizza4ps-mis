from sqlalchemy import Column, Integer, String, Text
from database import Base


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value_json = Column(Text, nullable=True)
