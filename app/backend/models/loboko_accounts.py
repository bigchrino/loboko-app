from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Loboko_accounts(Base):
    __tablename__ = "loboko_accounts"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    email = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    atoms_user_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)