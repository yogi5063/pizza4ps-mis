from sqlalchemy import Column, Integer, String, Boolean, Text
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    # Access control. role: 'super_admin' sees everything and manages users;
    # 'user' is limited to the granted pages/outlets.
    role = Column(String, nullable=False, default="user")
    # JSON list of page keys the user may open. NULL/empty = no restriction
    # (used for super_admin). e.g. '["overview","pnl"]'
    allowed_pages = Column(Text, nullable=True)
    # JSON list of outlet codes whose data the user may see. NULL/empty = all.
    allowed_outlets = Column(Text, nullable=True)
    # Force the user to set a new password on next login (after admin reset).
    must_change_password = Column(Boolean, default=False, nullable=False)
