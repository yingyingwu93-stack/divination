"""管理后台接口测试"""

import shutil

import admin as admin_module
import models
import retriever


def test_admin_requires_admin(client, auth_headers):
    res = client.get("/api/admin/stats", headers=auth_headers)
    assert res.status_code == 403


def test_admin_stats(client, admin_headers):
    res = client.get("/api/admin/stats", headers=admin_headers)
    data = res.get_json()
    assert data["success"] is True
    assert "total_users" in data["stats"]


def test_admin_users_list(client, admin_headers):
    client.post("/api/register", json={"username": "alice", "password": "123456"})
    res = client.get("/api/admin/users", headers=admin_headers)
    data = res.get_json()
    assert data["success"] is True
    assert any(u["username"] == "alice" for u in data["users"])


def test_admin_cannot_disable_self(client, admin_headers):
    me = client.get("/api/user", headers=admin_headers).get_json()["user"]
    res = client.put(f"/api/admin/users/{me['id']}/status",
                     json={"status": "disabled"}, headers=admin_headers)
    assert res.status_code == 400


def test_admin_disable_user(client, admin_headers):
    client.post("/api/register", json={"username": "bob", "password": "123456"})
    login = client.post("/api/login", json={"username": "bob", "password": "123456"})
    bob_id = login.get_json()["user"]["id"]

    res = client.put(f"/api/admin/users/{bob_id}/status",
                     json={"status": "disabled"}, headers=admin_headers)
    assert res.status_code == 200

    res = client.post("/api/login", json={"username": "bob", "password": "123456"})
    assert res.status_code == 401


def test_admin_readings_list_and_delete(client, auth_headers, admin_headers):
    client.post("/api/history", json={
        "type": "解梦", "input_data": "梦见蛇", "result": "解读内容",
    }, headers=auth_headers)

    res = client.get("/api/admin/readings", headers=admin_headers)
    data = res.get_json()
    assert data["total"] == 1
    reading_id = data["readings"][0]["id"]

    res = client.delete(f"/api/admin/readings/{reading_id}", headers=admin_headers)
    assert res.status_code == 200
    assert client.get("/api/admin/readings", headers=admin_headers).get_json()["total"] == 0


def test_admin_dreams_list(client, admin_headers):
    res = client.get("/api/admin/dreams?keyword=蛇&page_size=5", headers=admin_headers)
    data = res.get_json()
    assert data["success"] is True
    assert data["total"] >= 5


def test_admin_dream_create_validation(client, admin_headers):
    res = client.post("/api/admin/dreams", json={"title": "梦见测试"},
                      headers=admin_headers)
    assert res.status_code == 400


def test_admin_dream_create_route(client, admin_headers, monkeypatch):
    monkeypatch.setattr(admin_module, "add_dream", lambda *a: {"id": "dream-999", "title": "梦见测试"})
    res = client.post("/api/admin/dreams", json={
        "title": "梦见测试", "category": "其他", "keywords": "测试,梦",
        "traditional": "传统解释", "psychology": "心理分析",
    }, headers=admin_headers)
    data = res.get_json()
    assert data["success"] is True
    assert data["item"]["id"] == "dream-999"


def test_retriever_dream_crud_in_temp_dir(tmp_path, monkeypatch):
    shutil.copy(
        f"{retriever.KNOWLEDGE_DIR}/dreams.json",
        tmp_path / "dreams.json",
    )
    monkeypatch.setattr(retriever, "KNOWLEDGE_DIR", str(tmp_path))
    monkeypatch.setattr(retriever, "_DREAMS", None)
    monkeypatch.setattr(retriever, "_INDEXES", {})

    item = retriever.add_dream("梦见测试", "其他", ["测试"], "传统", "心理")
    assert retriever.get_dream(item["id"])["title"] == "梦见测试"

    updated = retriever.update_dream(item["id"], title="梦见测试2")
    assert updated["title"] == "梦见测试2"

    assert retriever.delete_dream(item["id"]) is True
    assert retriever.get_dream(item["id"]) is None
