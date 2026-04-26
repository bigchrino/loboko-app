from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Profiles(Base):
    __tablename__ = "profiles"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    username = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    metier = Column(String, nullable=True)
    avatar_key = Column(String, nullable=True)
    role = Column(String, nullable=False)
    theme = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)