from fastapi import APIRouter, Depends, HTTPException
from domain.schemas import QuestionRead
from adapters.repositories.question_repo import SQLQuestionRepo
from infrastructure.db import get_db

router = APIRouter(prefix="/questions")

def get_question_repo(db=Depends(get_db)) -> SQLQuestionRepo:
    """QuestionRepoの依存関数"""
    return SQLQuestionRepo(db)

@router.get("/{question_id}", response_model=QuestionRead, status_code=200)
def get_question(question_id: int, repo: SQLQuestionRepo = Depends(get_question_repo)):
    question = repo.get(question_id)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    return question
