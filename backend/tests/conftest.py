"""pytest 公共夹具：独立临时数据库，避免污染开发数据"""

import os
import sys
import tempfile

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

_TMP_DIR = tempfile.mkdtemp(prefix="zhanbu_test_")
os.environ["ZHANBU_DB_PATH"] = os.path.join(_TMP_DIR, "test.db")
os.environ["ZHANBU_SECRET_KEY"] = "test_secret_key"
os.environ.setdefault("LONGCAT_API_KEY", "test_key")

import models  # noqa: E402
from app import app as flask_app  # noqa: E402


@pytest.fixture()
def app():
    flask_app.config.update(TESTING=True)
    return flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def clean_db():
    conn = models.get_db()
    for table in ["ai_usage", "fortune_cache", "messages", "conversations",
                  "readings", "users"]:
        conn.execute(f"DELETE FROM {table}")
    conn.commit()
    conn.close()
    yield


@pytest.fixture()
def auth_headers(client):
    client.post("/api/register", json={"username": "tester", "password": "123456"})
    res = client.post("/api/login", json={"username": "tester", "password": "123456"})
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(client):
    models.create_user("admin", "admin123", role="admin")
    res = client.post("/api/login", json={"username": "admin", "password": "admin123"})
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}
