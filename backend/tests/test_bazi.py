"""八字引擎回归测试"""

from bazi_engine import calculate_bazi, solar_term_time


def _pillars(result):
    return [p["stem"] + p["branch"] for p in result["pillars"]]


def test_known_case_1949():
    # 1949-10-01 为甲子日（六十甲子锚点）
    result = calculate_bazi(1949, 10, 1, 12, 0)
    assert _pillars(result) == ["己丑", "癸酉", "甲子", "庚午"]
    assert result["zodiac"] == "牛"


def test_known_case_1995():
    result = calculate_bazi(1995, 6, 15, 12, 0)
    assert _pillars(result) == ["乙亥", "壬午", "丁丑", "丙午"]


def test_lichun_year_boundary():
    # 2024 立春约为 2 月 4 日 16:26（北京时间）
    lichun = solar_term_time(2024, 2)
    before = calculate_bazi(2024, 2, 4, 15, 0)
    after = calculate_bazi(2024, 2, 4, 17, 0)
    assert before["pillars"][0]["stem"] + before["pillars"][0]["branch"] == "癸卯"
    assert after["pillars"][0]["stem"] + after["pillars"][0]["branch"] == "甲辰"
    assert lichun.year == 2024 and lichun.month == 2


def test_late_zi_hour_changes_day():
    before = calculate_bazi(2024, 1, 1, 22, 0)
    after = calculate_bazi(2024, 1, 1, 23, 30)
    day_before = before["pillars"][2]["stem"] + before["pillars"][2]["branch"]
    day_after = after["pillars"][2]["stem"] + after["pillars"][2]["branch"]
    assert day_before != day_after
    assert after["pillars"][3]["branch"] == "子"


def test_true_solar_time_by_longitude():
    east = calculate_bazi(2000, 6, 1, 12, 0, longitude=121.5)
    west = calculate_bazi(2000, 6, 1, 12, 0, longitude=87.6)
    assert east["solar_time"]["true_solar"] != west["solar_time"]["true_solar"]
    assert west["solar_time"]["longitude_correction_min"] < 0


def test_five_elements_percent_sum():
    result = calculate_bazi(1990, 3, 8, 9, 30)
    total = sum(v["percent"] for v in result["five_elements"].values())
    assert abs(total - 100) < 1.5


def test_luck_direction():
    # 阳年男顺排，阴年男逆排
    yang_male = calculate_bazi(2024, 6, 1, 12, 0, gender="male")
    yin_male = calculate_bazi(1995, 6, 1, 12, 0, gender="male")
    assert yang_male["luck"]["direction"] == "顺排"
    assert yin_male["luck"]["direction"] == "逆排"


def test_bazi_api(client, auth_headers):
    res = client.post("/api/bazi/calc", json={
        "year": 1995, "month": 6, "day": 15,
        "hour": 12, "minute": 0, "longitude": 116.4,
        "gender": "male", "location": "北京",
    }, headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert [p["stem"] + p["branch"] for p in data["data"]["pillars"]] == [
        "乙亥", "壬午", "丁丑", "丙午"
    ]


def test_bazi_api_validation(client, auth_headers):
    res = client.post("/api/bazi/calc", json={"year": 1800}, headers=auth_headers)
    assert res.status_code == 400
    assert res.get_json()["success"] is False
