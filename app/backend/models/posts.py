from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Posts(Base):
    __tablename__ = "posts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    content = Column(String, nullable=False)
    image_key = Column(String, nullable=True)
    likes_count = Column(Integer, nullable=True)
    comments_count = Column(Integer, nullable=True)
    shares_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)