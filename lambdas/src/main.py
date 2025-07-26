from fastapi import FastAPI
from mangum import Mangum
from adapters.api.questions_router import router

app = FastAPI(title="Quiz API")
app.include_router(router)

# Lambda entry
handler = Mangum(app)
