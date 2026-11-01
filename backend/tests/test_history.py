"""历史记录筛选、收藏、标签与每日运势测试"""

import models


def _add(client, headers, type_, input_, result):
    res = client.post("/api/history", json={
        "type": type_, "input_data": input_, "result": result,
    }, headers=headers)
    assert res.status_code == 200


def test_history_save_returns_reading_id(client, auth_headers):
    res = client.post("/api/history", json={
        "type": "解梦", "input_data": "梦见蛇", "result": "蛇代表直觉",
    }, headers=auth_headers)
    data = res.get_json()
    assert data["success"] is True
    assert isinstance(data["reading_id"], int)
    assert data["reading_id"] > 0


def test_history_pagination_and_keyword(client, auth_headers):
    _add(client, auth_headers, "解梦", "梦见蛇", "蛇代表直觉")
    _add(client, auth_headers, "解梦", "梦见水", "水代表情绪")
    _add(client, auth_headers, "八字", "1995-06-15", "日主丁火")

    data = client.get("/api/history?page_size=2", headers=auth_headers).get_json()
    assert data["total"] == 3
    assert len(data["readings"]) == 2

    data = client.get("/api/history?keyword=蛇", headers=auth_headers).get_json()
    assert data["total"] == 1
    assert "蛇" in data["readings"][0]["input_data"]

    data = client.get("/api/history?type=八字", headers=auth_headers).get_json()
    assert data["total"] == 1


def test_history_favorite_and_tags(client, auth_headers):
    _add(client, auth_headers, "塔罗", "感情问题", "解读内容")
    reading_id = client.get("/api/history", headers=auth_headers).get_json()["readings"][0]["id"]

    res = client.put(f"/api/history/{reading_id}/favorite",
                     json={"favorite": True}, headers=auth_headers)
    assert res.get_json()["favorite"] is True

    data = client.get("/api/history?favorite=1", headers=auth_headers).get_json()
    assert data["total"] == 1

    res = client.put(f"/api/history/{reading_id}/tags",
                     json={"tags": ["感情", "塔罗"]}, headers=auth_headers)
    assert res.get_json()["tags"] == "感情,塔罗"

    data = client.get("/api/history?keyword=感情", headers=auth_headers).get_json()
    assert data["total"] == 1


def test_favorite_other_user_record(client, auth_headers):
    _add(client, auth_headers, "解梦", "梦见猫", "猫代表直觉")
    reading_id = client.get("/api/history", headers=auth_headers).get_json()["readings"][0]["id"]

    client.post("/api/register", json={"username": "other2", "password": "123456"})
    login = client.post("/api/login", json={"username": "other2", "password": "123456"})
    other = {"Authorization": f"Bearer {login.get_json()['token']}"}

    res = client.put(f"/api/history/{reading_id}/favorite",
                     json={"favorite": True}, headers=other)
    assert res.status_code == 404


def test_daily_fortune_requires_login(client):
    assert client.get("/api/fortune/daily?sign=白羊座").status_code == 401


def test_daily_fortune_invalid_sign(client, auth_headers):
    res = client.get("/api/fortune/daily?sign=不存在", headers=auth_headers)
    assert res.status_code == 400


def test_daily_fortune_deterministic_and_cached(client, auth_headers):
    res1 = client.get("/api/fortune/daily?sign=白羊座", headers=auth_headers).get_json()
    assert res1["success"] is True
    assert res1["cached"] is False
    assert set(res1["data"]["scores"]) == {"love", "career", "wealth", "health"}

    res2 = client.get("/api/fortune/daily?sign=白羊座", headers=auth_headers).get_json()
    assert res2["cached"] is True
    assert res2["data"] == res1["data"]

    # 不同星座结果不同
    other = client.get("/api/fortune/daily?sign=双鱼座", headers=auth_headers).get_json()
    assert other["data"]["scores"] != res1["data"]["scores"]


def test_daily_fortune_cache_table(client, auth_headers):
    client.get("/api/fortune/daily?sign=金牛座", headers=auth_headers)
    conn = models.get_db()
    count = conn.execute("SELECT COUNT(*) AS c FROM fortune_cache").fetchone()["c"]
    conn.close()
    assert count == 1


def test_period_fortunes(client, auth_headers):
    labels = {"day": "今日", "week": "本周", "month": "本月", "year": "今年"}
    for period, label in labels.items():
        res = client.get(
            f"/api/fortune/period?sign=狮子座&period={period}",
            headers=auth_headers,
        )
        data = res.get_json()
        assert res.status_code == 200
        assert data["success"] is True
        assert data["data"]["period"] == period
        assert data["data"]["period_label"] == label
        assert data["data"]["range"]
        assert len(data["data"]["advice"]) == 3


def test_period_fortune_invalid_period(client, auth_headers):
    res = client.get("/api/fortune/period?sign=狮子座&period=decade",
                     headers=auth_headers)
    assert res.status_code == 400


def test_fortune_overview(client, auth_headers):
    res = client.get("/api/fortune/overview?period=day", headers=auth_headers)
    data = res.get_json()
    assert res.status_code == 200
    assert data["success"] is True
    assert len(data["items"]) == 12
    assert all(0 <= item["overall"] <= 100 for item in data["items"])

    # 首页总览与详情页分数必须一致
    sign = data["items"][0]["sign"]
    detail = client.get(
        f"/api/fortune/period?sign={sign}&period=day", headers=auth_headers
    ).get_json()["data"]
    assert data["items"][0]["overall"] == detail["overall"]


def test_fortune_overview_requires_login(client):
    assert client.get("/api/fortune/overview").status_code == 401


def test_fortune_overview_invalid_period(client, auth_headers):
    res = client.get("/api/fortune/overview?period=decade", headers=auth_headers)
    assert res.status_code == 400


def test_period_fortunes_are_cached_separately(client, auth_headers):
    for period in ("day", "week", "month", "year"):
        client.get(f"/api/fortune/period?sign=处女座&period={period}",
                   headers=auth_headers)
    conn = models.get_db()
    count = conn.execute(
        "SELECT COUNT(*) AS c FROM fortune_cache WHERE sign = '处女座'"
    ).fetchone()["c"]
    conn.close()
    assert count == 4
