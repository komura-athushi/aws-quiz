from dataclasses import dataclass

# ドメインモデル

@dataclass
class Question:
    id: int | None
    body: str
