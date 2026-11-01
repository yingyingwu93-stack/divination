"""创建或提升管理员账号

用法：
    python create_admin.py admin 你的密码
"""

import sys

import models


def main():
    if len(sys.argv) != 3:
        print("用法：python create_admin.py <用户名> <密码>")
        print("示例：python create_admin.py admin admin123456")
        sys.exit(1)

    username, password = sys.argv[1].strip(), sys.argv[2].strip()
    if len(username) < 2 or len(password) < 6:
        print("用户名至少 2 位，密码至少 6 位")
        sys.exit(1)

    conn = models.get_db()
    row = conn.execute(
        "SELECT id FROM users WHERE username = ?", (username,)
    ).fetchone()

    if row:
        conn.execute(
            "UPDATE users SET role = 'admin', status = 'active', password_hash = ? WHERE id = ?",
            (models.hash_password(password), row["id"]),
        )
        conn.commit()
        print(f"已将用户「{username}」提升为管理员，并重置密码")
    else:
        conn.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
            (username, models.hash_password(password)),
        )
        conn.commit()
        print(f"已创建管理员「{username}」")
    conn.close()


if __name__ == "__main__":
    main()
