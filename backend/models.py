"""数据库模型、迁移与数据访问"""

import hashlib
import os
import sqlite3

DB_PATH = os.environ.get(
    "ZHANBU_DB_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db"),
)

# 密码盐值（生产环境应从环境变量读取）
PASSWORD_SALT = os.environ.get("ZHANBU_PASSWORD_SALT", "zhanbu_salt_2024_graduation")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # 多 worker / 并发写入时减少 database is locked
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def _columns(conn, table):
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _add_column(conn, table, name, ddl):
    """幂等加列：老数据库升级时不丢数据"""
    if name not in _columns(conn, table):
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            status TEXT NOT NULL DEFAULT 'active',
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
            is_favorite INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # 老版本数据库升级
    _add_column(conn, "users", "role", "TEXT NOT NULL DEFAULT 'user'")
    _add_column(conn, "users", "status", "TEXT NOT NULL DEFAULT 'active'")
    _add_column(conn, "users", "birth_date", "TEXT")
    _add_column(conn, "readings", "is_favorite", "INTEGER NOT NULL DEFAULT 0")
    _add_column(conn, "readings", "tags", "TEXT NOT NULL DEFAULT ''")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL DEFAULT '新的对话',
            context_type TEXT NOT NULL DEFAULT '',
            context_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS fortune_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sign TEXT NOT NULL,
            date TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (sign, date)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ai_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            endpoint TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_readings_user ON readings(user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ai_usage_time ON ai_usage(created_at)")

    conn.commit()
    conn.close()


def hash_password(password):
    """SHA256 + 盐值哈希"""
    salted = password + PASSWORD_SALT
    return hashlib.sha256(salted.encode()).hexdigest()


# ==================== 用户 ====================
def create_user(username, password, role="user"):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, hash_password(password), role),
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
        "SELECT id, username, password_hash, role, status, birth_date FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    conn.close()

    if user and user["status"] == "active" and user["password_hash"] == hash_password(password):
        return {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "birth_date": user["birth_date"],
        }
    return None


def get_user_by_id(user_id):
    conn = get_db()
    user = conn.execute(
        "SELECT id, username, role, status, birth_date, created_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    conn.close()
    return dict(user) if user else None


def set_user_birth_date(user_id, birth_date):
    conn = get_db()
    cursor = conn.execute(
        "UPDATE users SET birth_date = ? WHERE id = ?", (birth_date, user_id)
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def set_user_status(user_id, status):
    conn = get_db()
    cursor = conn.execute("UPDATE users SET status = ? WHERE id = ?", (status, user_id))
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def set_user_role(user_id, role):
    conn = get_db()
    cursor = conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def reset_user_password(user_id, new_password):
    conn = get_db()
    cursor = conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (hash_password(new_password), user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def list_users(keyword="", page=1, page_size=20):
    conn = get_db()
    offset = (page - 1) * page_size
    if keyword:
        like = f"%{keyword}%"
        rows = conn.execute(
            """SELECT id, username, role, status, created_at FROM users
               WHERE username LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?""",
            (like, page_size, offset),
        ).fetchall()
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM users WHERE username LIKE ?", (like,)
        ).fetchone()["c"]
    else:
        rows = conn.execute(
            """SELECT id, username, role, status, created_at FROM users
               ORDER BY id DESC LIMIT ? OFFSET ?""",
            (page_size, offset),
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    conn.close()
    return [dict(r) for r in rows], total


# ==================== 历史记录 ====================
def save_reading(user_id, reading_type, input_data, result):
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO readings (user_id, type, input_data, result) VALUES (?, ?, ?, ?)",
        (user_id, reading_type, input_data, result),
    )
    conn.commit()
    reading_id = cursor.lastrowid
    conn.close()
    return reading_id


def _history_where(user_id, reading_type=None, keyword="", favorite=False):
    clauses = ["user_id = ?"]
    params = [user_id]
    if reading_type:
        clauses.append("type = ?")
        params.append(reading_type)
    if keyword:
        clauses.append("(input_data LIKE ? OR result LIKE ? OR tags LIKE ?)")
        like = f"%{keyword}%"
        params.extend([like, like, like])
    if favorite:
        clauses.append("is_favorite = 1")
    return " AND ".join(clauses), params


def get_readings(user_id, reading_type=None, limit=50, offset=0,
                 keyword="", favorite=False):
    where, params = _history_where(user_id, reading_type, keyword, favorite)
    conn = get_db()
    rows = conn.execute(
        f"""SELECT id, type, input_data, result, is_favorite, tags, created_at
            FROM readings WHERE {where} ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?""",
        (*params, limit, offset),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def count_readings(user_id, reading_type=None, keyword="", favorite=False):
    where, params = _history_where(user_id, reading_type, keyword, favorite)
    conn = get_db()
    total = conn.execute(
        f"SELECT COUNT(*) AS c FROM readings WHERE {where}", params
    ).fetchone()["c"]
    conn.close()
    return total


def get_reading(user_id, reading_id):
    conn = get_db()
    row = conn.execute(
        """SELECT id, type, input_data, result, is_favorite, tags, created_at
           FROM readings WHERE id = ? AND user_id = ?""",
        (reading_id, user_id),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def set_reading_favorite(user_id, reading_id, favorite):
    conn = get_db()
    cursor = conn.execute(
        "UPDATE readings SET is_favorite = ? WHERE id = ? AND user_id = ?",
        (1 if favorite else 0, reading_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def update_reading_tags(user_id, reading_id, tags):
    conn = get_db()
    cursor = conn.execute(
        "UPDATE readings SET tags = ? WHERE id = ? AND user_id = ?",
        (tags, reading_id, user_id),
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def delete_reading(user_id, reading_id):
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM readings WHERE id = ? AND user_id = ?", (reading_id, user_id)
    )
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


def admin_list_readings(page=1, page_size=20, reading_type="", keyword=""):
    clauses, params = [], []
    if reading_type:
        clauses.append("r.type = ?")
        params.append(reading_type)
    if keyword:
        clauses.append("(r.input_data LIKE ? OR r.result LIKE ? OR u.username LIKE ?)")
        like = f"%{keyword}%"
        params.extend([like, like, like])
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    conn = get_db()
    rows = conn.execute(
        f"""SELECT r.id, r.type, r.input_data, r.result, r.created_at,
                   u.username
            FROM readings r JOIN users u ON u.id = r.user_id
            {where} ORDER BY r.id DESC LIMIT ? OFFSET ?""",
        (*params, page_size, (page - 1) * page_size),
    ).fetchall()
    total = conn.execute(
        f"""SELECT COUNT(*) AS c FROM readings r JOIN users u ON u.id = r.user_id {where}""",
        params,
    ).fetchone()["c"]
    conn.close()
    return [dict(r) for r in rows], total


def admin_delete_reading(reading_id):
    conn = get_db()
    cursor = conn.execute("DELETE FROM readings WHERE id = ?", (reading_id,))
    conn.commit()
    conn.close()
    return cursor.rowcount > 0


# ==================== 对话 ====================
def create_conversation(user_id, title="新的对话", context_type="", context_id=None):
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO conversations (user_id, title, context_type, context_id)
           VALUES (?, ?, ?, ?)""",
        (user_id, title[:50], context_type, context_id),
    )
    conn.commit()
    conversation_id = cursor.lastrowid
    conn.close()
    return conversation_id


def get_conversation(user_id, conversation_id):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM conversations WHERE id = ? AND user_id = ?",
        (conversation_id, user_id),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def add_message(conversation_id, role, content):
    conn = get_db()
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
        (conversation_id, role, content),
    )
    conn.execute(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (conversation_id,),
    )
    conn.commit()
    conn.close()


def get_messages(conversation_id, limit=30):
    conn = get_db()
    rows = conn.execute(
        """SELECT role, content FROM messages WHERE conversation_id = ?
           ORDER BY id ASC LIMIT ?""",
        (conversation_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_conversations(user_id, limit=20):
    conn = get_db()
    rows = conn.execute(
        """SELECT id, title, context_type, context_id, updated_at
           FROM conversations WHERE user_id = ?
           ORDER BY updated_at DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ==================== 每日运势缓存 ====================
def get_fortune_cache(sign, date):
    conn = get_db()
    row = conn.execute(
        "SELECT content FROM fortune_cache WHERE sign = ? AND date = ?", (sign, date)
    ).fetchone()
    conn.close()
    return row["content"] if row else None


def save_fortune_cache(sign, date, content):
    conn = get_db()
    conn.execute(
        """INSERT INTO fortune_cache (sign, date, content) VALUES (?, ?, ?)
           ON CONFLICT(sign, date) DO UPDATE SET content = excluded.content""",
        (sign, date, content),
    )
    conn.commit()
    conn.close()


# ==================== AI 调用统计 ====================
def log_ai_usage(user_id, endpoint):
    conn = get_db()
    conn.execute(
        "INSERT INTO ai_usage (user_id, endpoint) VALUES (?, ?)", (user_id, endpoint)
    )
    conn.commit()
    conn.close()


def get_stats():
    conn = get_db()
    today = conn.execute(
        "SELECT COUNT(DISTINCT user_id) AS c FROM readings WHERE date(created_at) = date('now')"
    ).fetchone()["c"]
    total_users = conn.execute("SELECT COUNT(*) AS c FROM users").fetchone()["c"]
    total_readings = conn.execute("SELECT COUNT(*) AS c FROM readings").fetchone()["c"]
    total_ai = conn.execute("SELECT COUNT(*) AS c FROM ai_usage").fetchone()["c"]
    today_ai = conn.execute(
        "SELECT COUNT(*) AS c FROM ai_usage WHERE date(created_at) = date('now')"
    ).fetchone()["c"]

    by_type = [dict(r) for r in conn.execute(
        "SELECT type, COUNT(*) AS count FROM readings GROUP BY type ORDER BY count DESC"
    ).fetchall()]

    daily = [dict(r) for r in conn.execute(
        """SELECT date(created_at) AS day, COUNT(*) AS count FROM readings
           WHERE created_at >= date('now', '-6 days')
           GROUP BY date(created_at) ORDER BY day ASC"""
    ).fetchall()]

    daily_users = [dict(r) for r in conn.execute(
        """SELECT date(created_at) AS day, COUNT(DISTINCT user_id) AS count FROM readings
           WHERE created_at >= date('now', '-6 days')
           GROUP BY date(created_at) ORDER BY day ASC"""
    ).fetchall()]

    ai_endpoints = [dict(r) for r in conn.execute(
        "SELECT endpoint, COUNT(*) AS count FROM ai_usage GROUP BY endpoint ORDER BY count DESC"
    ).fetchall()]

    conn.close()
    return {
        "total_users": total_users,
        "today_active": today,
        "total_readings": total_readings,
        "total_ai": total_ai,
        "today_ai": today_ai,
        "by_type": by_type,
        "daily": daily,
        "daily_users": daily_users,
        "ai_endpoints": ai_endpoints,
    }


# 启动时初始化
init_db()
