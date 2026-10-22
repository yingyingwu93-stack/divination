"""数据库模型与初始化"""

import sqlite3
import os
import hashlib

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db")

# 密码盐值（生产环境应从环境变量读取）
PASSWORD_SALT = os.environ.get("ZHANBU_PASSWORD_SALT", "zhanbu_salt_2024_graduation")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            input_data TEXT NOT NULL,
            result TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()


def hash_password(password):
    """SHA256 + 盐值哈希"""
    salted = password + PASSWORD_SALT
    return hashlib.sha256(salted.encode()).hexdigest()


# 用户相关操作
def create_user(username, password):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hash_password(password))
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def verify_user(username, password):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    conn.close()

    if user and user["password_hash"] == hash_password(password):
        return {"id": user["id"], "username": user["username"]}
    return None


def get_user_by_id(user_id):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, created_at FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()
    conn.close()
    return dict(user) if user else None


# 历史记录相关操作
def save_reading(user_id, reading_type, input_data, result):
    conn = get_db()
    conn.execute(
        "INSERT INTO readings (user_id, type, input_data, result) VALUES (?, ?, ?, ?)",
        (user_id, reading_type, input_data, result)
    )
    conn.commit()
    conn.close()


def get_readings(user_id, reading_type=None, limit=50):
    conn = get_db()
    if reading_type:
        rows = conn.execute(
            "SELECT id, type, input_data, result, created_at FROM readings WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, reading_type, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, type, input_data, result, created_at FROM readings WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_reading(user_id, reading_id):
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM readings WHERE id = ? AND user_id = ?",
        (reading_id, user_id)
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


# 启动时初始化
init_db()
