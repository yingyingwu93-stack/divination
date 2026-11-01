"""RAG 检索与解梦词条测试"""

from retriever import (
    retrieve, rag_context, list_dreams, dream_categories, get_dream, tokenize
)


def test_tokenize_chinese_bigram():
    tokens = tokenize("梦见蛇追我")
    assert "蛇" in tokens
    assert "蛇追" in tokens


def test_retrieve_snake():
    hits = retrieve("梦见蛇追我", "dreams", top_k=3)
    assert hits
    assert any("蛇" in h["doc"]["title"] for h in hits)


def test_retrieve_tooth():
    hits = retrieve("梦见掉牙", "dreams", top_k=3)
    assert hits[0]["doc"]["title"] in ("梦见掉牙", "梦见牙齿")


def test_rag_context_has_refs():
    context, refs = rag_context("梦见考试迟到", "dreams", top_k=3)
    assert context
    assert len(refs) == 3
    assert refs[0]["title"]


def test_rag_bazi_rules():
    context, refs = rag_context("日主丁火 身弱 用神", "bazi", top_k=3)
    assert context
    assert refs
    assert any("日主" in r["title"] or "用神" in r["title"] or "十神" in r["title"]
               for r in refs)


def test_rag_tarot():
    context, refs = rag_context("太阳 正位", "tarot", top_k=3)
    assert context
    assert refs[0]["title"] == "太阳"


def test_list_dreams_keyword_and_paging():
    items, total = list_dreams("蛇", "", 1, 5)
    assert total >= 5
    assert len(items) == 5
    assert all("蛇" in i["title"] or any("蛇" in k for k in i["keywords"]) for i in items)


def test_list_dreams_category():
    items, total = list_dreams("", "动物", 1, 10)
    assert total >= 30
    assert all(i["category"] == "动物" for i in items)


def test_dream_categories():
    cats = dream_categories()
    names = [c["name"] for c in cats]
    assert "动物" in names and "自然" in names
    assert sum(c["count"] for c in cats) >= 300


def test_get_dream():
    assert get_dream("dream-001")["title"] == "梦见蛇"
    assert get_dream("not-exist") is None


def test_dreams_api(client):
    res = client.get("/api/dreams?keyword=蛇&page_size=5")
    data = res.get_json()
    assert res.status_code == 200
    assert data["success"] is True
    assert data["total"] >= 5
    assert len(data["items"]) == 5


def test_dreams_categories_api(client):
    res = client.get("/api/dreams/categories")
    data = res.get_json()
    assert data["success"] is True
    assert any(c["name"] == "动物" for c in data["categories"])


def test_dreams_rag_api(client):
    res = client.get("/api/dreams/rag?q=梦见蛇")
    data = res.get_json()
    assert data["success"] is True
    assert data["references"]


def test_dream_ai_requires_login(client):
    res = client.post("/api/ai/dream", json={"dream": "我梦见一条蛇"})
    assert res.status_code == 401
