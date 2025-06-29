#!/usr/bin/env python3
"""
データベーススキーマ取得・保存スクリプト

このスクリプトは指定されたMySQLデータベースの全テーブルのスキーマ情報を取得し、
JSON形式とSQL DDL形式で保存します。
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any
from sqlalchemy import create_engine, MetaData, Table, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.sql.schema import ForeignKey
from dotenv import load_dotenv


class DatabaseSchemaExporter:
    """データベーススキーマを取得・エクスポートするクラス"""
    
    def __init__(self, connection_string: str):
        """
        初期化
        
        Args:
            connection_string: データベース接続文字列
        """
        self.engine = create_engine(connection_string)
        self.metadata = MetaData()
        self.inspector = inspect(self.engine)
    
    def get_table_schema(self, table_name: str) -> Dict[str, Any]:
        """
        指定テーブルのスキーマ情報を取得
        
        Args:
            table_name: テーブル名
            
        Returns:
            テーブルスキーマ情報の辞書
        """
        schema_info = {
            'table_name': table_name,
            'columns': [],
            'primary_keys': [],
            'foreign_keys': [],
            'indexes': [],
            'constraints': []
        }
        
        # カラム情報取得
        columns = self.inspector.get_columns(table_name)
        for column in columns:
            column_info = {
                'name': column['name'],
                'type': str(column['type']),
                'nullable': column['nullable'],
                'default': str(column['default']) if column['default'] is not None else None,
                'autoincrement': column.get('autoincrement', False),
                'comment': column.get('comment', '')
            }
            schema_info['columns'].append(column_info)
        
        # 主キー情報取得
        pk_constraint = self.inspector.get_pk_constraint(table_name)
        if pk_constraint and pk_constraint['constrained_columns']:
            schema_info['primary_keys'] = pk_constraint['constrained_columns']
        
        # 外部キー情報取得
        foreign_keys = self.inspector.get_foreign_keys(table_name)
        for fk in foreign_keys:
            fk_info = {
                'name': fk['name'],
                'constrained_columns': fk['constrained_columns'],
                'referred_table': fk['referred_table'],
                'referred_columns': fk['referred_columns'],
                'options': fk.get('options', {})
            }
            schema_info['foreign_keys'].append(fk_info)
        
        # インデックス情報取得
        indexes = self.inspector.get_indexes(table_name)
        for index in indexes:
            index_info = {
                'name': index['name'],
                'column_names': index['column_names'],
                'unique': index['unique']
            }
            schema_info['indexes'].append(index_info)
        
        # CHECK制約情報取得（MySQLの場合は限定的）
        try:
            check_constraints = self.inspector.get_check_constraints(table_name)
            for constraint in check_constraints:
                constraint_info = {
                    'name': constraint['name'],
                    'sqltext': constraint['sqltext']
                }
                schema_info['constraints'].append(constraint_info)
        except NotImplementedError:
            # MySQLでサポートされていない場合はスキップ
            pass
        
        return schema_info
    
    def get_all_tables_schema(self) -> Dict[str, Any]:
        """
        全テーブルのスキーマ情報を取得
        
        Returns:
            全テーブルのスキーマ情報
        """
        table_names = self.inspector.get_table_names()
        
        database_schema = {
            'database_name': self.get_database_name(),
            'export_timestamp': datetime.now().isoformat(),
            'tables_count': len(table_names),
            'tables': {}
        }
        
        for table_name in table_names:
            print(f"Processing table: {table_name}")
            database_schema['tables'][table_name] = self.get_table_schema(table_name)
        
        return database_schema
    
    def get_database_name(self) -> str:
        """
        データベース名を取得
        
        Returns:
            データベース名
        """
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT DATABASE()"))
            return result.scalar()
    
    def generate_ddl(self, schema_info: Dict[str, Any]) -> str:
        """
        スキーマ情報からDDL文を生成
        
        Args:
            schema_info: スキーマ情報
            
        Returns:
            DDL文字列
        """
        ddl_statements = []
        
        # データベース作成文
        db_name = schema_info['database_name']
        ddl_statements.append(f"-- Database: {db_name}")
        ddl_statements.append(f"-- Exported at: {schema_info['export_timestamp']}")
        ddl_statements.append("")
        ddl_statements.append(f"CREATE DATABASE IF NOT EXISTS `{db_name}`;")
        ddl_statements.append(f"USE `{db_name}`;")
        ddl_statements.append("")
        
        # テーブル作成文
        for table_name, table_info in schema_info['tables'].items():
            ddl_statements.append(f"-- Table: {table_name}")
            ddl_statements.append(f"CREATE TABLE `{table_name}` (")
            
            # カラム定義
            column_definitions = []
            for column in table_info['columns']:
                col_def = f"  `{column['name']}` {column['type']}"
                
                if not column['nullable']:
                    col_def += " NOT NULL"
                
                if column['default'] is not None and column['default'] != 'None':
                    col_def += f" DEFAULT {column['default']}"
                
                if column['autoincrement']:
                    col_def += " AUTO_INCREMENT"
                
                if column['comment']:
                    col_def += f" COMMENT '{column['comment']}'"
                
                column_definitions.append(col_def)
            
            ddl_statements.append(",\n".join(column_definitions))
            
            # 主キー制約
            if table_info['primary_keys']:
                pk_cols = "`, `".join(table_info['primary_keys'])
                ddl_statements.append(f",\n  PRIMARY KEY (`{pk_cols}`)")
            
            # 外部キー制約
            for fk in table_info['foreign_keys']:
                constrained_cols = "`, `".join(fk['constrained_columns'])
                referred_cols = "`, `".join(fk['referred_columns'])
                fk_def = f",\n  CONSTRAINT `{fk['name']}` FOREIGN KEY (`{constrained_cols}`) REFERENCES `{fk['referred_table']}` (`{referred_cols}`)"
                ddl_statements.append(fk_def)
            
            ddl_statements.append("\n);")
            ddl_statements.append("")
            
            # インデックス作成
            for index in table_info['indexes']:
                if index['name'] != 'PRIMARY':  # 主キーインデックスは除外
                    index_cols = "`, `".join(index['column_names'])
                    index_type = "UNIQUE INDEX" if index['unique'] else "INDEX"
                    ddl_statements.append(f"CREATE {index_type} `{index['name']}` ON `{table_name}` (`{index_cols}`);")
            
            ddl_statements.append("")
        
        return "\n".join(ddl_statements)
    
    def export_to_json(self, output_file: str):
        """
        スキーマ情報をJSON形式で出力
        
        Args:
            output_file: 出力ファイルパス
        """
        schema_info = self.get_all_tables_schema()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(schema_info, f, indent=2, ensure_ascii=False)
        
        print(f"Schema exported to JSON: {output_file}")
        return schema_info
    
    def export_to_sql(self, output_file: str, schema_info: Dict[str, Any] = None):
        """
        スキーマ情報をSQL DDL形式で出力
        
        Args:
            output_file: 出力ファイルパス
            schema_info: スキーマ情報（Noneの場合は新規取得）
        """
        if schema_info is None:
            schema_info = self.get_all_tables_schema()
        
        ddl_content = self.generate_ddl(schema_info)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(ddl_content)
        
        print(f"Schema exported to SQL: {output_file}")


def main():
    """メイン処理"""
    # 環境変数読み込み
    load_dotenv()
    
    # データベース接続情報取得
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '3306')
    db_name = os.getenv('DB_NAME', 'aws_quiz')
    db_user = os.getenv('DB_USER', 'root')
    db_password = os.getenv('DB_PASSWORD', 'password')
    
    # 接続文字列作成
    connection_string = f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    try:
        # エクスポーター初期化
        exporter = DatabaseSchemaExporter(connection_string)
        
        # 出力ファイル名（タイムスタンプ付き）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_output = f"database_schema_{timestamp}.json"
        sql_output = f"database_schema_{timestamp}.sql"
        
        print(f"Connecting to database: {db_name} at {db_host}:{db_port}")
        print("Exporting database schema...")
        
        # JSON形式でエクスポート
        schema_info = exporter.export_to_json(json_output)
        
        # SQL DDL形式でエクスポート
        exporter.export_to_sql(sql_output, schema_info)
        
        print(f"\nExport completed successfully!")
        print(f"Tables exported: {schema_info['tables_count']}")
        print(f"Output files:")
        print(f"  - JSON: {json_output}")
        print(f"  - SQL DDL: {sql_output}")
        
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        raise


if __name__ == "__main__":
    main()