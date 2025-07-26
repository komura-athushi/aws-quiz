import os
import boto3
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_aurora_data_api import register_dialects
from sqlalchemy.orm import sessionmaker

# ダイアレクトを登録
register_dialects()

# SQLAlchemyのベースクラスを定義
Base = declarative_base()

# 環境変数の取得
AURORA_CLUSTER_ARN = os.environ.get("AURORA_DB_ARN")
AURORA_SECRET_ARN = os.environ.get("AURORA_SECRET_ARN")
DB_NAME = os.environ.get("AURORA_DB_NAME")
AWS_REGION = os.environ.get("AWS_REGION")
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")

# boto3 RDS Data APIクライアントを明示的に作成してリージョンを設定
rds_data_client = boto3.client('rds-data', region_name=AWS_REGION)

# グローバルエンジン（Lambda環境での再利用のため）
_engine = None

def get_engine():
    """Aurora Serverless V2 Data API接続を取得"""
    global _engine
    if _engine is not None:
        return _engine

    # AWS認証情報を環境変数に設定
    os.environ['AWS_ACCESS_KEY_ID'] = AWS_ACCESS_KEY_ID
    os.environ['AWS_SECRET_ACCESS_KEY'] = AWS_SECRET_ACCESS_KEY
    # AWSリージョンを環境変数に設定
    os.environ['AWS_DEFAULT_REGION'] = AWS_REGION

    if _engine is not None:
        return _engine
    # Data APIでAuroraに接続
    _engine = create_engine(f'mysql+auroradataapi://:@/{DB_NAME}',
        echo=True,
        connect_args=dict(
        aurora_cluster_arn=AURORA_CLUSTER_ARN,
        secret_arn=AURORA_SECRET_ARN,
        rds_data_client=rds_data_client
    ))

    return _engine

def get_db_session():
    """データベースセッション（Data API接続）を取得"""
    engine = get_engine()
    SessionClass = sessionmaker(bind=engine)
    return SessionClass()

# FastAPI依存関数
def get_db():
    """FastAPI用のデータベース依存関数"""
    db = get_db_session()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    get_db_session()