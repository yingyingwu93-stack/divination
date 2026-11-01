"""认证接口测试（含修改密码回归）"""

import models


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_register_validation(client):
    res = client.post("/api/register", json={"username": "a", "password": "123456"})
    assert res.status_code == 400
    res = client.post("/api/register", json={"username": "abc", "password": "123"})
    assert res.status_code == 400
    res = client.post("/api/register", json={})
    assert res.status_code == 400


def test_register_and_login(client):
    assert client.post("/api/register", json={
        "username": "alice", "password": "123456"
    }).get_json()["success"] is True

    res = client.post("/api/login", json={"username": "alice", "password": "123456"})
    data = res.get_json()
    assert data["success"] is True
    assert data["token"]
    assert data["user"]["role"] == "user"


def test_login_wrong_password(client):
    client.post("/api/register", json={"username": "bob", "password": "123456"})
    res = client.post("/api/login", json={"username": "bob", "password": "wrong"})
    assert res.status_code == 401


def test_user_info(client, auth_headers):
    res = client.get("/api/user", headers=auth_headers)
    data = res.get_json()
    assert data["success"] is True
    assert data["user"]["username"] == "tester"
    assert data["user"]["role"] == "user"


def test_change_password(client, auth_headers):
    res = client.put("/api/user/password", json={
        "old_password": "123456", "new_password": "654321",
    }, headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["success"] is True

    assert client.post("/api/login", json={
        "username": "tester", "password": "123456"
    }).status_code == 401
    assert client.post("/api/login", json={
        "username": "tester", "password": "654321"
    }).status_code == 200


def test_change_password_wrong_old(client, auth_headers):
    res = client.put("/api/user/password", json={
        "old_password": "wrong", "new_password": "654321",
    }, headers=auth_headers)
    assert res.status_code == 400


def test_delete_account(client, auth_headers):
    res = client.delete("/api/user", json={"password": "123456"}, headers=auth_headers)
    assert res.get_json()["success"] is True
    assert client.post("/api/login", json={
        "username": "tester", "password": "123456"
    }).status_code == 401


def test_invalid_token(client):
    res = client.get("/api/user", headers={"Authorization": "Bearer invalid"})
    assert res.status_code == 401


def test_disabled_user_token_invalid(client, auth_headers):
    me = client.get("/api/user", headers=auth_headers).get_json()["user"]
    models.set_user_status(me["id"], "disabled")
    res = client.get("/api/user", headers=auth_headers)
    assert res.status_code == 401


def test_save_birth_date(client, auth_headers):
    res = client.put("/api/user/birth", json={"birth_date": "1995-06-15"},
                     headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["birth_date"] == "1995-06-15"

    user = client.get("/api/user", headers=auth_headers).get_json()["user"]
    assert user["birth_date"] == "1995-06-15"

    # 重新登录也应返回出生日期
    login = client.post("/api/login", json={
        "username": "tester", "password": "123456"
    }).get_json()
    assert login["user"]["birth_date"] == "1995-06-15"


def test_birth_date_validation(client, auth_headers):
    res = client.put("/api/user/birth", json={"birth_date": "1995/06/15"},
                     headers=auth_headers)
    assert res.status_code == 400
    res = client.put("/api/user/birth", json={"birth_date": "1800-01-01"},
                     headers=auth_headers)
    assert res.status_code == 400
    res = client.put("/api/user/birth", json={}, headers=auth_headers)
    assert res.status_code == 400


def test_birth_date_requires_login(client):
    res = client.put("/api/user/birth", json={"birth_date": "1995-06-15"})
    assert res.status_code == 401


def test_sqlite_concurrency_pragmas():
    conn = models.get_db()
    journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
    busy_timeout = conn.execute("PRAGMA busy_timeout").fetchone()[0]
    conn.close()
    assert journal_mode.lower() == "wal"
    assert busy_timeout == 5000
