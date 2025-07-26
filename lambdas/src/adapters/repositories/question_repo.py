from sqlalchemy import Column, Integer, Text, JSON, DateTime, ForeignKey
from sqlalchemy.orm import Session
from infrastructure.db import Base
from domain.models import Question
from datetime import datetime

class Questions(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    body = Column(Text, nullable=False)
    explanation = Column(Text, nullable=False)
    choices = Column(JSON, nullable=False)
    correct_key = Column(JSON, nullable=False)
    exam_categories_id = Column(Integer, ForeignKey("exam_categories.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

class SQLQuestionRepo:
    def __init__(self, db: Session):
        self.db = db

    # QuestionRepoインターフェースの実装
    # 該当idのQuestionsデータを取得
    def get(self, qid: int) -> Question | None:
        print(f"Getting question with id: {qid}")
        row = self.db.query(Questions).filter(Questions.id == qid).first()
        if row is None:
            return None
        return Question(
            id=row.id,
            body=row.body
        )
