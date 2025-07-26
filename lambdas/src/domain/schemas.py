from pydantic import BaseModel

# DTO、APIのリクエストやレスポンスで使用するスキーマを定義
 
class QuestionRead(BaseModel):
    id: int
    body: str
