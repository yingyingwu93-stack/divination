"""八字排盘引擎

实现内容：
- 24 节气（太阳视黄经法，误差约 ±10 分钟）
- 真太阳时（经度校正 + 均时差）
- 四柱（立春换年、节气换月、23 点换日）
- 十神、藏干、纳音、五行力量
- 大运（顺逆、起运时间、十步大运）
- 常用神煞

纯 Python 实现，无第三方依赖。
"""

import math
from datetime import datetime, timedelta

STEMS = list("甲乙丙丁戊己庚辛壬癸")
BRANCHES = list("子丑寅卯辰巳午未申酉戌亥")

STEM_ELEMENT = dict(zip(STEMS, ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"]))
BRANCH_ELEMENT = dict(zip(
    BRANCHES, ["水", "土", "木", "木", "土", "火", "火", "土", "金", "金", "土", "水"]
))
STEM_YANG = {s: i % 2 == 0 for i, s in enumerate(STEMS)}

ZODIAC = list("鼠牛虎兔龙蛇马羊猴鸡狗猪")

# 地支藏干及权重（本气、中气、余气）
HIDDEN_STEMS = {
    "子": [("癸", 1.0)],
    "丑": [("己", 0.6), ("癸", 0.3), ("辛", 0.1)],
    "寅": [("甲", 0.6), ("丙", 0.3), ("戊", 0.1)],
    "卯": [("乙", 1.0)],
    "辰": [("戊", 0.6), ("乙", 0.3), ("癸", 0.1)],
    "巳": [("丙", 0.6), ("戊", 0.3), ("庚", 0.1)],
    "午": [("丁", 0.7), ("己", 0.3)],
    "未": [("己", 0.6), ("丁", 0.3), ("乙", 0.1)],
    "申": [("庚", 0.6), ("壬", 0.3), ("戊", 0.1)],
    "酉": [("辛", 1.0)],
    "戌": [("戊", 0.6), ("辛", 0.3), ("丁", 0.1)],
    "亥": [("壬", 0.7), ("甲", 0.3)],
}

# 纳音（六十甲子，每两个一组）
NAYIN = [
    "海中金", "炉中火", "大林木", "路旁土", "剑锋金",
    "山头火", "涧下水", "城头土", "白蜡金", "杨柳木",
    "泉中水", "屋上土", "霹雳火", "松柏木", "长流水",
    "沙中金", "山下火", "平地木", "壁上土", "金箔金",
    "覆灯火", "天河水", "大驿土", "钗钏金", "桑柘木",
    "大溪水", "沙中土", "天上火", "石榴木", "大海水",
]

# 节气名称：小寒起，每月两个
SOLAR_TERMS = [
    "小寒", "大寒", "立春", "雨水", "惊蛰", "春分",
    "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
    "小暑", "大暑", "立秋", "处暑", "白露", "秋分",
    "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
]

# 12 个“节”（决定月柱），对应月支
JIE_NAMES = ["立春", "惊蛰", "清明", "立夏", "芒种", "小暑",
             "立秋", "白露", "寒露", "立冬", "大雪", "小寒"]
JIE_BRANCHES = ["寅", "卯", "辰", "巳", "午", "未",
                "申", "酉", "戌", "亥", "子", "丑"]
JIE_TERM_INDEX = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 0]


# ==================== 天文计算 ====================
def _jd_from_datetime(dt):
    """公历（UTC）转儒略日"""
    y, m = dt.year, dt.month
    d = dt.day + (dt.hour + dt.minute / 60 + dt.second / 3600) / 24
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return int(365.25 * (y + 4716)) + int(30.6001 * (m + 1)) + d + b - 1524.5


def _datetime_from_jd(jd):
    """儒略日转公历（UTC）"""
    jd += 0.5
    z = int(jd)
    f = jd - z
    if z < 2299161:
        a = z
    else:
        alpha = int((z - 1867216.25) / 36524.25)
        a = z + 1 + alpha - alpha // 4
    b = a + 1524
    c = int((b - 122.1) / 365.25)
    d = int(365.25 * c)
    e = int((b - d) / 30.6001)
    day = b - d - int(30.6001 * e) + f
    month = e - 1 if e < 14 else e - 13
    year = c - 4716 if month > 2 else c - 4715
    whole = int(day)
    secs = round((day - whole) * 86400)
    return datetime(year, month, whole) + timedelta(seconds=secs)


def _sun_apparent_longitude(jd):
    """太阳视黄经（度），Meeus 低精度算法，误差约 0.01°"""
    t = (jd - 2451545.0) / 36525
    l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
    m = math.radians((357.52911 + 35999.05029 * t - 0.0001537 * t * t) % 360)
    c = ((1.914602 - 0.004817 * t - 0.000014 * t * t) * math.sin(m)
         + (0.019993 - 0.000101 * t) * math.sin(2 * m)
         + 0.000289 * math.sin(3 * m))
    omega = math.radians(125.04 - 1934.136 * t)
    return (l0 + c - 0.00569 - 0.00478 * math.sin(omega)) % 360


# 用于迭代初值的平均节气偏移（分钟）
_TERM_OFFSET = [0, 21208, 42467, 63836, 85337, 107014, 128867, 150921,
                173149, 195551, 218072, 240693, 263343, 285989, 308563,
                331033, 353350, 375494, 397447, 419210, 440795, 462224,
                483532, 504758]


def solar_term_time(year, index):
    """返回某年第 index 个节气的北京时间（UTC+8）

    index: 0=小寒, 1=大寒, 2=立春 ... 23=冬至
    """
    target = (285 + 15 * index) % 360
    guess = datetime(1900, 1, 6, 2, 5) + timedelta(
        minutes=525948.76 * (year - 1900) + _TERM_OFFSET[index]
    )
    jd = _jd_from_datetime(guess - timedelta(hours=8))  # 初值按北京时间给出
    for _ in range(12):
        diff = ((target - _sun_apparent_longitude(jd) + 180) % 360) - 180
        jd += diff / 0.98564736
    return _datetime_from_jd(jd) + timedelta(hours=8)


def solar_terms_of_year(year):
    """返回该年 24 节气（北京时间）列表"""
    return [
        {"name": SOLAR_TERMS[i], "time": solar_term_time(year, i)}
        for i in range(24)
    ]


def _jie_of_year(year):
    """返回该年 12 个“节”的时间（北京时间）"""
    return [
        {"name": JIE_NAMES[i], "branch": JIE_BRANCHES[i],
         "time": solar_term_time(year, JIE_TERM_INDEX[i])}
        for i in range(12)
    ]


def equation_of_time_minutes(dt):
    """均时差（分钟），近似公式，误差约 ±30 秒"""
    n = dt.timetuple().tm_yday
    b = 2 * math.pi * (n - 81) / 364
    return 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)


def true_solar_time(dt, longitude=120.0):
    """把北京时间换算为出生地真太阳时"""
    longitude_minutes = (longitude - 120.0) * 4.0
    eot = equation_of_time_minutes(dt)
    return dt + timedelta(minutes=longitude_minutes + eot), longitude_minutes, eot


# ==================== 干支与十神 ====================
def ganzhi_index(stem, branch):
    """六十甲子序号，0=甲子"""
    s, b = STEMS.index(stem), BRANCHES.index(branch)
    for i in range(60):
        if i % 10 == s and i % 12 == b:
            return i
    raise ValueError("非法干支组合")


def nayin_of(stem, branch):
    return NAYIN[ganzhi_index(stem, branch) // 2]


def ten_god(day_stem, other_stem):
    """以日干为主，判断另一天干的十神"""
    me = STEM_ELEMENT[day_stem]
    other = STEM_ELEMENT[other_stem]
    same_polarity = STEM_YANG[day_stem] == STEM_YANG[other_stem]

    generates = {"木": "火", "火": "土", "土": "金", "金": "水", "水": "木"}
    overcomes = {"木": "土", "土": "水", "水": "火", "火": "金", "金": "木"}

    if me == other:
        return "比肩" if same_polarity else "劫财"
    if generates[me] == other:
        return "食神" if same_polarity else "伤官"
    if overcomes[me] == other:
        return "偏财" if same_polarity else "正财"
    if overcomes[other] == me:
        return "七杀" if same_polarity else "正官"
    return "偏印" if same_polarity else "正印"


def _year_pillar(dt):
    """以立春为界确定年柱"""
    lichun = solar_term_time(dt.year, 2)
    year = dt.year if dt >= lichun else dt.year - 1
    return year, STEMS[(year - 4) % 10], BRANCHES[(year - 4) % 12]


def _month_pillar(dt):
    """以节气为界确定月柱，返回 (节令年, 月序, 月干, 月支)"""
    entries = []
    for y in (dt.year - 1, dt.year, dt.year + 1):
        for i, jie in enumerate(_jie_of_year(y)):
            entries.append((jie["time"], y, i, jie["branch"]))
    entries.sort(key=lambda x: x[0])

    chosen = None
    for entry in entries:
        if entry[0] <= dt:
            chosen = entry
        else:
            break
    if chosen is None:
        chosen = entries[0]

    _, jie_year, offset, branch = chosen
    year_stem_idx = (jie_year - 4) % 10
    month_stem_idx = (year_stem_idx % 5 * 2 + 2 + offset) % 10
    return jie_year, offset, STEMS[month_stem_idx], branch


def _day_pillar(dt):
    """日柱；23:00 起算次日（晚子时）"""
    day = dt.date()
    if dt.hour >= 23:
        day = day + timedelta(days=1)
    jd = _jd_from_datetime(datetime(day.year, day.month, day.day, 12))
    anchor = _jd_from_datetime(datetime(1949, 10, 1, 12))  # 1949-10-01 为甲子日
    idx = (int(round(jd)) - int(round(anchor))) % 60
    return STEMS[idx % 10], BRANCHES[idx % 12]


def _hour_pillar(dt, day_stem):
    branch_idx = ((dt.hour + 1) // 2) % 12
    stem_idx = (STEMS.index(day_stem) % 5 * 2 + branch_idx) % 10
    return STEMS[stem_idx], BRANCHES[branch_idx]


# ==================== 命盘分析 ====================
def _five_elements(pillars):
    """五行力量：天干 1.0，地支藏干按权重，月支加权 1.5"""
    scores = {e: 0.0 for e in "木火土金水"}
    for p in pillars:
        scores[STEM_ELEMENT[p["stem"]]] += 1.0
        factor = 1.5 if p["label"] == "月柱" else 1.0
        for hs in p["hidden"]:
            scores[STEM_ELEMENT[hs["stem"]]] += hs["weight"] * factor

    total = sum(scores.values()) or 1
    result = {}
    for e, v in scores.items():
        result[e] = {"score": round(v, 2), "percent": round(v / total * 100, 1)}
    return result


def _shensha(pillars, day_stem):
    """常用神煞：天乙贵人、桃花、驿马、华盖、羊刃"""
    branches = {p["label"]: p["branch"] for p in pillars}
    all_branches = list(branches.values())
    found = []

    noble_map = {
        "甲": "丑未", "戊": "丑未", "庚": "丑未", "乙": "子申", "己": "子申",
        "丙": "亥酉", "丁": "亥酉", "壬": "卯巳", "癸": "卯巳", "辛": "寅午",
    }
    for b in noble_map.get(day_stem, ""):
        for label, branch in branches.items():
            if branch == b:
                found.append({"name": "天乙贵人", "pillar": label, "branch": b})

    year_branch = branches["年柱"]
    day_branch = branches["日柱"]
    group_map = {
        "申子辰": {"桃花": "酉", "驿马": "寅", "华盖": "辰"},
        "寅午戌": {"桃花": "卯", "驿马": "申", "华盖": "戌"},
        "巳酉丑": {"桃花": "午", "驿马": "亥", "华盖": "丑"},
        "亥卯未": {"桃花": "子", "驿马": "巳", "华盖": "未"},
    }
    for base in {year_branch, day_branch}:
        for group, rules in group_map.items():
            if base in group:
                for name, target in rules.items():
                    if target in all_branches:
                        label = next(k for k, v in branches.items() if v == target)
                        item = {"name": name, "pillar": label, "branch": target}
                        if item not in found:
                            found.append(item)

    blade_map = {"甲": "卯", "乙": "寅", "丙": "午", "丁": "巳", "戊": "午",
                 "己": "巳", "庚": "酉", "辛": "申", "壬": "子", "癸": "亥"}
    blade = blade_map.get(day_stem)
    if blade in all_branches:
        label = next(k for k, v in branches.items() if v == blade)
        found.append({"name": "羊刃", "pillar": label, "branch": blade})
    return found


def _jie_entries_around(dt):
    entries = []
    for y in (dt.year - 1, dt.year, dt.year + 1):
        for i, jie in enumerate(_jie_of_year(y)):
            entries.append({"time": jie["time"], "year": y, "index": i,
                            "name": jie["name"], "branch": jie["branch"]})
    entries.sort(key=lambda x: x["time"])
    return entries


def _luck_cycles(local_dt, true_dt, month_stem, month_branch,
                 year_stem, gender):
    """大运：阳年男/阴年女顺排，阴年男/阳年女逆排"""
    is_male = gender == "male"
    forward = STEM_YANG[year_stem] == is_male

    entries = _jie_entries_around(true_dt)
    prev_jie = next_jie = None
    for e in entries:
        if e["time"] <= true_dt:
            prev_jie = e
        elif next_jie is None:
            next_jie = e
            break
    if prev_jie is None:
        prev_jie = entries[0]
    if next_jie is None:
        next_jie = entries[-1]

    delta = (next_jie["time"] - true_dt) if forward else (true_dt - prev_jie["time"])
    total_days = max(delta.total_seconds() / 86400.0, 0.0)

    years = int(total_days // 3)
    remainder_days = total_days - years * 3
    total_months = remainder_days * 4
    months = int(total_months)
    days = int(round((total_months - months) * 30))

    start_age = {"years": years, "months": months, "days": days}
    start_year = local_dt.year + years + (1 if months >= 6 else 0)

    base = ganzhi_index(month_stem, month_branch)
    cycles = []
    for i in range(10):
        idx = (base + (i + 1) * (1 if forward else -1)) % 60
        stem, branch = STEMS[idx % 10], BRANCHES[idx % 12]
        age = years + i * 10
        cycles.append({
            "index": i + 1,
            "pillar": stem + branch,
            "stem": stem,
            "branch": branch,
            "ten_god": ten_god(_day_stem_of(true_dt), stem),
            "start_age": age,
            "start_year": start_year + i * 10,
        })

    return {
        "direction": "顺排" if forward else "逆排",
        "start_age": start_age,
        "start_year": start_year,
        "prev_jie": {"name": prev_jie["name"], "time": prev_jie["time"].isoformat()},
        "next_jie": {"name": next_jie["name"], "time": next_jie["time"].isoformat()},
        "cycles": cycles,
    }


def _day_stem_of(dt):
    return _day_pillar(dt)[0]


def calculate_bazi(year, month, day, hour, minute=0,
                   longitude=120.0, gender="male", location=""):
    """完整排盘，返回可直接序列化为 JSON 的字典"""
    local_dt = datetime(year, month, day, hour, minute)
    true_dt, lon_minutes, eot = true_solar_time(local_dt, longitude)

    year_num, year_stem, year_branch = _year_pillar(local_dt)
    jie_year, month_offset, month_stem, month_branch = _month_pillar(local_dt)
    day_stem, day_branch = _day_pillar(true_dt)
    hour_stem, hour_branch = _hour_pillar(true_dt, day_stem)

    raw = [
        ("年柱", year_stem, year_branch),
        ("月柱", month_stem, month_branch),
        ("日柱", day_stem, day_branch),
        ("时柱", hour_stem, hour_branch),
    ]

    pillars = []
    for label, stem, branch in raw:
        hidden = []
        for hs, weight in HIDDEN_STEMS[branch]:
            hidden.append({
                "stem": hs,
                "element": STEM_ELEMENT[hs],
                "weight": weight,
                "ten_god": ten_god(day_stem, hs),
            })
        pillars.append({
            "label": label,
            "stem": stem,
            "branch": branch,
            "element": STEM_ELEMENT[stem],
            "yin_yang": "阳" if STEM_YANG[stem] else "阴",
            "ten_god": "日主" if label == "日柱" else ten_god(day_stem, stem),
            "hidden": hidden,
            "nayin": nayin_of(stem, branch),
        })

    elements = _five_elements(pillars)
    ranked = sorted(elements.items(), key=lambda kv: kv[1]["score"], reverse=True)

    ten_gods = {}
    for p in pillars:
        if p["label"] != "日柱":
            ten_gods[p["ten_god"]] = ten_gods.get(p["ten_god"], 0) + 1
        for hs in p["hidden"]:
            ten_gods[hs["ten_god"]] = ten_gods.get(hs["ten_god"], 0) + 1

    luck = _luck_cycles(local_dt, true_dt, month_stem, month_branch,
                        year_stem, gender)

    return {
        "input": {
            "year": year, "month": month, "day": day,
            "hour": hour, "minute": minute,
            "longitude": longitude, "gender": gender, "location": location,
        },
        "solar_time": {
            "local": local_dt.strftime("%Y-%m-%d %H:%M"),
            "true_solar": true_dt.strftime("%Y-%m-%d %H:%M"),
            "longitude_correction_min": round(lon_minutes, 1),
            "equation_of_time_min": round(eot, 1),
        },
        "pillars": pillars,
        "day_master": {
            "stem": day_stem,
            "element": STEM_ELEMENT[day_stem],
            "yin_yang": "阳" if STEM_YANG[day_stem] else "阴",
        },
        "zodiac": ZODIAC[(year_num - 4) % 12],
        "five_elements": elements,
        "strongest": ranked[0][0],
        "weakest": ranked[-1][0],
        "ten_gods": ten_gods,
        "shensha": _shensha(pillars, day_stem),
        "luck": luck,
        "solar_terms": [
            {"name": t["name"], "time": t["time"].strftime("%Y-%m-%d %H:%M")}
            for t in solar_terms_of_year(local_dt.year)
        ],
    }
