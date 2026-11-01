"""对话追问与结构化输出测试"""

import json

import pytest

import app as app_module
import models


def test_extract_json_plain():
    assert app_module._extract_json('{"a": 1}') == {"a": 1}


def test_extract_json_code_fence():
    text = '```json\n{"a": 1}\n```'
    assert app_module._extract_json(text) == {"a": 1}


def test_extract_json_invalid():
    assert app_module._extract_json("没有 JSON") is None


def test_validate_tarot_structured():
    data = {
        "summary": "整体不错",
        "cards": [{"position": "过去", "card": "愚者", "orientation": "正位",
                   "interpretation": "新的开始"}],
        "advice": ["保持开放"],
    }
    result = app_module._validate_structured("tarot", data)
    assert result["summary"] == "整体不错"
    assert result["cards"][0]["card"] == "愚者"


def test_validate_tarot_missing_cards():
    assert app_module._validate_structured("tarot", {"summary": "x", "cards": []}) is None


def test_validate_zodiac_scores_clamped():
    data = {"summary": "x", "scores": {"love": 120, "career": -5, "wealth": 70, "health": 80}}
    result = app_module._validate_structured("zodiac", data)
    assert result["scores"]["love"] == 100
    assert result["scores"]["career"] == 0


def test_call_model_missing_content(monkeypatch):
    class FakeResponse:
        status_code = 200

        def json(self):
            return {"choices": [{"message": {"reasoning_content": "只有推理"}}]}

    monkeypatch.setattr(app_module.requests, "post", lambda *a, **k: FakeResponse())
    with pytest.raises(RuntimeError, match="未返回正文"):
        app_module._call_model([{"role": "user", "content": "hi"}])


def test_chat_requires_login(client):
    res = client.post("/api/ai/chat", json={"message": "你好"})
    assert res.status_code == 401


def test_chat_creates_conversation(client, auth_headers, monkeypatch):
    captured = {}

    def fake_stream(messages, max_tokens=2000, temperature=0.8,
                    endpoint="chat", on_complete=None):
        captured["messages"] = messages
        if on_complete:
            on_complete("这是回复")
        from flask import Response
        return Response("data: [DONE]\n\n", mimetype="text/event-stream")

    monkeypatch.setattr(app_module, "_sse_stream", fake_stream)

    res = client.post("/api/ai/chat", json={
        "message": "我最近感情不顺",
        "system": "你是助手",
    }, headers=auth_headers)

    assert res.status_code == 200
    conversation_id = int(res.headers["X-Conversation-Id"])
    captured["conversation_id"] = conversation_id

    user_id = client.get("/api/user", headers=auth_headers).get_json()["user"]["id"]
    convs = models.list_conversations(user_id)
    assert convs and convs[0]["id"] == conversation_id
    messages = models.get_messages(conversation_id)
    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert messages[0]["content"] == "我最近感情不顺"
    assert captured["messages"][0]["role"] == "system"


def test_chat_with_reading_id_context(client, auth_headers, monkeypatch):
    saved = client.post("/api/history", json={
        "type": "解梦", "input_data": "梦见蛇", "result": "蛇代表直觉",
    }, headers=auth_headers).get_json()
    reading_id = saved["reading_id"]

    captured = {}

    def fake_stream(messages, max_tokens=2000, temperature=0.8,
                    endpoint="chat", on_complete=None):
        captured["messages"] = messages
        if on_complete:
            on_complete("结合你的梦境，蛇代表直觉。")
        from flask import Response
        return Response("data: [DONE]\n\n", mimetype="text/event-stream")

    monkeypatch.setattr(app_module, "_sse_stream", fake_stream)
    res = client.post("/api/ai/chat", json={
        "message": "那我最近要注意什么？",
        "reading_id": reading_id,
    }, headers=auth_headers)

    assert res.status_code == 200
    system = captured["messages"][0]["content"]
    assert "解读记录" in system
    assert "蛇代表直觉" in system


def test_chat_history_api(client, auth_headers, monkeypatch):
    def fake_stream(messages, max_tokens=2000, temperature=0.8,
                    endpoint="chat", on_complete=None):
        on_complete("回复")
        from flask import Response
        return Response("data: [DONE]\n\n", mimetype="text/event-stream")

    monkeypatch.setattr(app_module, "_sse_stream", fake_stream)
    res = client.post("/api/ai/chat", json={"message": "你好"}, headers=auth_headers)
    conversation_id = res.headers["X-Conversation-Id"]

    res = client.get(f"/api/chat/history?conversation_id={conversation_id}",
                     headers=auth_headers)
    data = res.get_json()
    assert data["success"] is True
    assert len(data["messages"]) == 2


def test_chat_history_forbidden_for_other_user(client, auth_headers, monkeypatch):
    def fake_stream(messages, max_tokens=2000, temperature=0.8,
                    endpoint="chat", on_complete=None):
        on_complete("回复")
        from flask import Response
        return Response("data: [DONE]\n\n", mimetype="text/event-stream")

    monkeypatch.setattr(app_module, "_sse_stream", fake_stream)
    res = client.post("/api/ai/chat", json={"message": "你好"}, headers=auth_headers)
    conversation_id = res.headers["X-Conversation-Id"]

    client.post("/api/register", json={"username": "other", "password": "123456"})
    login = client.post("/api/login", json={"username": "other", "password": "123456"})
    other_headers = {"Authorization": f"Bearer {login.get_json()['token']}"}

    res = client.get(f"/api/chat/history?conversation_id={conversation_id}",
                     headers=other_headers)
    assert res.status_code == 404


def test_structured_requires_login(client):
    res = client.post("/api/ai/structured", json={"kind": "tarot", "input": {}})
    assert res.status_code == 401


def test_structured_success(client, auth_headers, monkeypatch):
    def fake_call(messages, max_tokens=1200, temperature=0.4):
        return json.dumps({
            "summary": "整体积极",
            "cards": [{"position": "现在", "card": "太阳", "orientation": "正位",
                       "interpretation": "充满活力"}],
            "advice": ["保持行动"],
        }, ensure_ascii=False)

    monkeypatch.setattr(app_module, "_call_model", fake_call)
    res = client.post("/api/ai/structured", json={
        "kind": "tarot",
        "input": {"cards": [{"name": "太阳"}]},
    }, headers=auth_headers)
    data = res.get_json()
    assert data["success"] is True
    assert data["structured"] is True
    assert data["data"]["cards"][0]["card"] == "太阳"


def test_structured_fallback(client, auth_headers, monkeypatch):
    monkeypatch.setattr(app_module, "_call_model", lambda *a, **k: "不是 JSON")
    res = client.post("/api/ai/structured", json={
        "kind": "tarot", "input": {"cards": []},
    }, headers=auth_headers)
    data = res.get_json()
    assert data["success"] is True
    assert data["structured"] is False
    assert data["raw"] == "不是 JSON"
