import openai
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, Text, JSON, DateTime, ForeignKey, String, Enum, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()

# 環境変数から設定値を読み込み
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL")
NUM_QUESTIONS = int(os.getenv("NUM_QUESTIONS"))
EXAM_CATEGORIES_ID = int(os.getenv("EXAM_CATEGORIES_ID"))
SYSTEM_PROMPT = os.getenv("SYSTEM_PROMPT")

# SQLAlchemyのベースクラス
Base = declarative_base()

class Exam(Base):
    """
    試験テーブルのORMクラス
    """
    __tablename__ = 'exams'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_name = Column(String(255), nullable=False, comment='試験名')
    exam_code = Column(String(20), nullable=False, comment='AWS 公認のコード例：SAA-C03')
    level = Column(Enum('Foundational', 'Associate', 'Professional', 'Specialty'), nullable=True, comment='難易度')
    description = Column(Text, nullable=True, comment='試験概要')
    is_active = Column(Boolean, nullable=False, default=True, comment='0なら非アクティブ')
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)

class Category(Base):
    """
    カテゴリテーブルのORMクラス
    """
    __tablename__ = 'categories'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    category_name = Column(String(100), nullable=False, comment='カテゴリー名')
    description = Column(Text, nullable=True, comment='概要')
    created_at = Column(DateTime, nullable=False, default=datetime.now)

class ExamCategory(Base):
    """
    試験カテゴリテーブルのORMクラス
    """
    __tablename__ = 'exam_categories'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    exam_id = Column(Integer, ForeignKey('exams.id'), nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False)
    
    # リレーションシップ
    exam = relationship("Exam")
    category = relationship("Category")

class Question(Base):
    """
    問題テーブルのORMクラス
    """
    __tablename__ = 'questions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    body = Column(Text, nullable=False, comment='問題文')
    explanation = Column(Text, nullable=False, comment='解説')
    choices = Column(JSON, nullable=False, comment='選択肢')
    correct_key = Column(JSON, nullable=False, comment='答えの選択肢ID')
    exam_categories_id = Column(Integer, ForeignKey('exam_categories.id'), nullable=False, comment='試験・カテゴリー')
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.now)
    deleted_at = Column(DateTime, nullable=True)

# データベース接続設定
DB_HOST = os.getenv("DB_HOST")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# Aurora Serverless V2 接続設定
USE_AURORA_SERVERLESS = os.getenv("USE_AURORA_SERVERLESS", "false").lower() == "true"
AURORA_CLUSTER_ARN = os.getenv("AURORA_CLUSTER_ARN")
AURORA_SECRET_ARN = os.getenv("AURORA_SECRET_ARN")
AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_SESSION_TOKEN = os.getenv("AWS_SESSION_TOKEN")  # 一時的な認証情報を使用する場合

# データベース操作設定
AUTO_INSERT_DB = os.getenv("AUTO_INSERT_DB", "true").lower() == "true"

def get_database_connection():
    """
    データベース接続を取得します。
    環境変数 USE_AURORA_SERVERLESS に基づいて通常のRDSまたはAurora Serverlessに接続します。
    
    Returns:
        tuple: (connection_type, connection_object)
        - connection_type: "rds" または "aurora_serverless"
        - connection_object: SQLAlchemyのセッションメーカー（RDS）またはaurora_data_api接続（Aurora）
    """
    try:
        if USE_AURORA_SERVERLESS:
            connection = get_aurora_serverless_connection()
            return ("aurora_serverless", connection) if connection else (None, None)
        else:
            connection = get_standard_rds_connection()
            return ("rds", connection) if connection else (None, None)
    except Exception as e:
        print(f"データベース接続エラー: {e}")
        return (None, None)

def get_standard_rds_connection():
    """
    通常のRDSデータベース接続を取得します。
    
    Returns:
        sessionmaker: SQLAlchemyのセッションメーカー
    """
    try:
        # データベース接続文字列を作成
        database_url = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
        
        # エンジンを作成
        engine = create_engine(database_url, echo=False)
        
        # セッションメーカーを作成
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        print("✅ 標準RDSデータベースに接続しました")
        return SessionLocal
    except Exception as e:
        print(f"❌ 標準RDSデータベース接続エラー: {e}")
        return None

def get_aurora_serverless_connection():
    """
    Aurora Serverless V2データベース接続をData APIとARNとSecretsManagerを使用して取得します。
    Data APIを使用することでVPCの外からでも安全に接続できます。
    
    Returns:
        aurora_data_api connection: Data API の直接接続オブジェクト
    """
    try:
        # aurora-data-api パッケージをインポート
        import aurora_data_api
        
        # AWS認証情報とリージョンを設定
        if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            print("明示的なAWS認証情報を使用します")
            os.environ['AWS_ACCESS_KEY_ID'] = AWS_ACCESS_KEY_ID
            os.environ['AWS_SECRET_ACCESS_KEY'] = AWS_SECRET_ACCESS_KEY
            if AWS_SESSION_TOKEN:
                os.environ['AWS_SESSION_TOKEN'] = AWS_SESSION_TOKEN
        else:
            print("デフォルトの認証情報（環境変数、プロファイル、またはEC2インスタンスロール）を使用します")
        
        # リージョンを環境変数に設定（必須）
        if AWS_REGION:
            os.environ['AWS_DEFAULT_REGION'] = AWS_REGION
        elif not os.getenv('AWS_DEFAULT_REGION'):
            print("警告: AWS_REGIONまたはAWS_DEFAULT_REGIONが設定されていません。ap-northeast-1を使用します。")
            os.environ['AWS_DEFAULT_REGION'] = 'ap-northeast-1'
        
        # Data APIでAuroraに接続
        print("Aurora Data API接続を作成中...")
        connection = aurora_data_api.connect(
            aurora_cluster_arn=AURORA_CLUSTER_ARN,
            secret_arn=AURORA_SECRET_ARN,
            database=DB_NAME
        )
        
        # 接続テスト
        print("データベース接続テスト実行中...")
        cursor = connection.cursor()
        cursor.execute("SELECT 1 as test_value")
        test_result = cursor.fetchone()
        cursor.close()
        print(f"データベース接続テスト成功: {test_result}")
        
        print("✅ Aurora Serverless V2データベースにData APIで接続しました")
        return connection
        
    except ImportError as ie:
        print(f"❌ 必要なライブラリがインストールされていません: {ie}")
        print("以下のコマンドを実行してください: pip install aurora-data-api")
        return None
    except Exception as e:
        print(f"❌ Aurora Serverless Data API接続エラー: {str(e)}")
        import traceback
        print(f"エラー詳細: {traceback.format_exc()}")
        return None

def insert_questions_to_db(quiz_list, exam_categories_id=None):
    """
    生成されたクイズをデータベースに挿入します。
    
    Args:
        quiz_list (list): 生成されたクイズのリスト
        exam_categories_id (int): 試験カテゴリID
    
    Returns:
        bool: 成功した場合True、失敗した場合False
    """
    if exam_categories_id is None:
        exam_categories_id = EXAM_CATEGORIES_ID
    
    connection_type, connection_obj = get_database_connection()
    if not connection_obj:
        return False
    
    if connection_type == "rds":
        # SQLAlchemy セッションを使用
        session = connection_obj()
        try:
            for quiz in quiz_list:
                # Questionオブジェクトを作成
                question = Question(
                    body=quiz.get('body', ''),
                    explanation=quiz.get('explanation', ''),
                    choices=quiz.get('choices', []),  # JSONとして直接保存
                    correct_key=quiz.get('correct_choices', []),  # JSONとして直接保存
                    exam_categories_id=exam_categories_id
                )
                
                # セッションに追加
                session.add(question)
            
            # コミット
            session.commit()
            print(f"✅ {len(quiz_list)}問の問題をデータベースに挿入しました（RDS）。")
            return True
            
        except SQLAlchemyError as e:
            session.rollback()
            print(f"❌ データベース挿入エラー（RDS）: {e}")
            return False
        except Exception as e:
            session.rollback()
            print(f"❌ 予期せぬエラー（RDS）: {e}")
            return False
        finally:
            session.close()
    
    elif connection_type == "aurora_serverless":
        # Aurora Data API 接続を使用
        cursor = connection_obj.cursor()
        try:
            for quiz in quiz_list:
                # JSONデータを文字列に変換
                choices_json = json.dumps(quiz.get('choices', []))
                correct_key_json = json.dumps(quiz.get('correct_choices', []))
                
                # INSERT文を実行
                insert_sql = """
                INSERT INTO questions (body, explanation, choices, correct_key, exam_categories_id, created_at)
                VALUES (:body, :explanation, :choices, :correct_key, :exam_categories_id, :created_at)
                """
                
                cursor.execute(insert_sql, {
                    'body': quiz.get('body', ''),
                    'explanation': quiz.get('explanation', ''),
                    'choices': choices_json,
                    'correct_key': correct_key_json,
                    'exam_categories_id': exam_categories_id,
                    'created_at': datetime.now()
                })
            connection_obj.commit()  # Aurora Data APIは自動コミットではないため、明示的にコミット
            # Aurora Data APIは自動コミット
            print(f"✅ {len(quiz_list)}問の問題をデータベースに挿入しました（Aurora Serverless）。")
            return True
            
        except Exception as e:
            print(f"❌ データベース挿入エラー（Aurora Serverless）: {e}")
            return False
        finally:
            cursor.close()
    
    else:
        print(f"❌ 未対応の接続タイプ: {connection_type}")
        return False

def get_quiz_from_openai(num_questions=None, exam_categories_id=None, auto_insert_db=None):
    """
    OpenAI APIを使用してクイズの問題と選択肢を生成します。

    Args:
        num_questions (int): 生成する問題の数。デフォルトは環境変数から取得。
        exam_categories_id (int): 試験カテゴリID。デフォルトは環境変数から取得。
        auto_insert_db (bool): 自動でデータベースに挿入するかどうか。デフォルトは環境変数から取得。

    Returns:
        list: 生成されたクイズのリスト。各要素は問題と選択肢を含む辞書。
              エラーが発生した場合はNoneを返します。
    """
    # デフォルト値を環境変数から設定
    if num_questions is None:
        num_questions = NUM_QUESTIONS
    if exam_categories_id is None:
        exam_categories_id = EXAM_CATEGORIES_ID
    if auto_insert_db is None:
        auto_insert_db = AUTO_INSERT_DB
    
    # データベースから試験名とカテゴリ名を取得
    exam_name, category_name, exam_code, category_description = get_exam_category_info(exam_categories_id)
    if not exam_name or not category_name:
        print("❌ 試験名またはカテゴリ名の取得に失敗しました。")
        return None
        
    try:
        # 環境変数からAPIキーを読み込む
        api_key = OPENAI_API_KEY
        if not api_key:
            print("エラー: 環境変数 OPENAI_API_KEY が設定されていません。")
            return None

        client = openai.OpenAI(api_key=api_key)

        # ユーザーからのリクエスト
        user_prompt = f"""
        クイズをJSON形式で生成してください。
        - 試験名: {exam_name}
        - 試験コード: {exam_code}
        - カテゴリ: {category_name}
        - カテゴリ概要: {category_description}
        - 問題数: {num_questions}
        """

        print(f"OpenAI APIにリクエストを送信中 ({num_questions}問、試験名: {exam_name}、カテゴリ: {category_name})...")
        
        response = client.responses.create(
          model=OPENAI_MODEL,
          input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
          ],
          text={          
            "format": {
              "type": "json_object"   
            },
          }
        )
        response_text = response.output_text
        print("生データ")
        print(response_text )
        
        # strをJSON形式に変換        
        quiz_list = json.loads(response_text)
        print("json.loads後のデータ")
        print(quiz_list)



        # レスポンスからコンテンツ部分（JSON文字列）を取得
        if quiz_list['questions']:
            # JSON文字列をパース
            try:
                # もし、トップレベルが "questions" のようなキーを持つオブジェクトだったら、その中の配列を取り出す
                if isinstance(quiz_list, dict) and len(quiz_list.keys()) == 1:
                    potential_key = list(quiz_list.keys())[0]
                    if isinstance(quiz_list[potential_key], list):
                        quiz_list = quiz_list[potential_key]

                # num_questionsが1の場合でも配列でラップされていることを期待
                if not isinstance(quiz_list, list):
                    # 単一のオブジェクトが返ってきた場合、リストに変換
                    if isinstance(quiz_list, dict) and "body" in quiz_list:
                         quiz_list = [quiz_list]
                    else:
                        print("エラー: 予期しないJSON形式です。期待する配列ではありません。")
                        return None

                print("\nパース後のクイズデータ:")
                for i, quiz in enumerate(quiz_list):
                    print(f"  問題 {i+1}: {quiz.get('body')}")
                    choices = quiz.get('choices', [])
                    correct_choices = quiz.get('correct_choices', [])
                    
                    for choice in choices:
                        choice_id = choice.get('choice_id')
                        choice_text = choice.get('choice_text')
                        is_correct = choice_id in correct_choices
                        print(f"    選択肢 {choice_id}: {choice_text} (正解: {is_correct})")
                    print(f"    正解番号: {correct_choices}")
                    print(f"    解説: {quiz.get('explanation')}\n")
                
                # データベースに自動挿入
                if auto_insert_db:
                    print("📝 データベースへの挿入を開始します...")
                    insert_success = insert_questions_to_db(quiz_list, exam_categories_id)
                    if not insert_success:
                        print("⚠️  データベースへの挿入に失敗しましたが、クイズデータは正常に生成されました。")
                else:
                    print("💾 データベースへの挿入はスキップされました（AUTO_INSERT_DB=false）。")
                
                return quiz_list
            except Exception as e:
                print(f"エラー: エラーが発生しました。 - {e}")
                return None
        else:
            print("エラー: APIから有効なレスポンスが得られませんでした。")
            print("レスポンスの内容:", response_text)
            return None

    except openai.APIConnectionError as e:
        print(f"OpenAI APIへの接続に失敗しました: {e}")
    except openai.RateLimitError as e:
        print(f"OpenAI APIのレート制限に達しました: {e}")
    except openai.APIStatusError as e:
        print(e)
        print(f"OpenAI APIエラーが発生しました (ステータスコード: {e.status_code}): {e.response}")
    except Exception as e:
        print(f"予期せぬエラーが発生しました: {e}")
    return None

def get_exam_category_info(exam_categories_id):
    """
    EXAM_CATEGORIES_IDから試験名とカテゴリ名を取得します。
    
    Args:
        exam_categories_id (int): 試験カテゴリID
    
    Returns:
        tuple: (exam_name, category_name, exam_code, category_description) または (None, None, None, None)
    """
    connection_type, connection_obj = get_database_connection()
    if not connection_obj:
        return None, None, None, None
    
    if connection_type == "rds":
        # SQLAlchemy セッションを使用
        session = connection_obj()
        try:
            # exam_categoriesテーブルから関連情報を取得
            result = session.query(ExamCategory).filter(
                ExamCategory.id == exam_categories_id
            ).first()
            
            if result:
                exam_name = result.exam.exam_name
                category_name = result.category.category_name
                exam_code = result.exam.exam_code
                category_description = result.category.description
                return exam_name, category_name, exam_code, category_description
            else:
                print(f"❌ EXAM_CATEGORIES_ID {exam_categories_id} が見つかりません。")
                return None, None, None, None
                
        except SQLAlchemyError as e:
            print(f"❌ データベース取得エラー（RDS）: {e}")
            return None, None, None, None
        except Exception as e:
            print(f"❌ 予期せぬエラー（RDS）: {e}")
            return None, None, None, None
        finally:
            session.close()
    
    elif connection_type == "aurora_serverless":
        # Aurora Data API 接続を使用
        cursor = connection_obj.cursor()
        try:
            # JOINクエリで関連情報を取得
            query_sql = """
            SELECT e.exam_name, c.category_name, e.exam_code, c.description
            FROM exam_categories ec
            JOIN exams e ON ec.exam_id = e.id
            JOIN categories c ON ec.category_id = c.id
            WHERE ec.id = :exam_categories_id
            """
            
            cursor.execute(query_sql, {'exam_categories_id': exam_categories_id})
            result = cursor.fetchone()
            
            if result:
                exam_name, category_name, exam_code, category_description = result
                return exam_name, category_name, exam_code, category_description
            else:
                print(f"❌ EXAM_CATEGORIES_ID {exam_categories_id} が見つかりません。")
                return None, None, None, None
                
        except Exception as e:
            print(f"❌ データベース取得エラー（Aurora Serverless）: {e}")
            return None, None, None, None
        finally:
            cursor.close()
    
    else:
        print(f"❌ 未対応の接続タイプ: {connection_type}")
        return None, None, None, None

if __name__ == "__main__":
    # --- OpenAI APIのサンプル実行 ---
    print("--- OpenAI API サンプル ---")

    get_quiz_from_openai()
