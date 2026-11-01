"""轻量 RAG 检索：纯 Python BM25 + 中文 bigram 分词

无需 jieba / 向量模型，适合 Python 3.8 与离线部署。
"""

import json
import math
import os
import re
from collections import Counter

KNOWLEDGE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge")

_STOPWORDS = set("的 了 是 我 你 他 她 它 在 有 和 与 就 都 也 很 不 吗 呢 啊 呀 吧 这 那 个 们".split())
_ASCII_WORD = re.compile(r"[a-zA-Z0-9]+")
_CHINESE_RUN = re.compile(r"[一-鿿]+")


def tokenize(text):
    """中文按单字 + bigram，英文数字按词切分"""
    text = (text or "").lower()
    tokens = []

    for word in _ASCII_WORD.findall(text):
        tokens.append(word)

    for run in _CHINESE_RUN.findall(text):
        chars = [c for c in run if c not in _STOPWORDS]
        tokens.extend(chars)
        tokens.extend(chars[i] + chars[i + 1] for i in range(len(chars) - 1))
        if 2 <= len(chars) <= 6:
            tokens.append("".join(chars))

    return tokens


def _doc_text(doc):
    parts = [
        doc.get("title", ""),
        doc.get("category", ""),
        doc.get("source", ""),
        " ".join(doc.get("keywords", [])),
        doc.get("text", ""),
        doc.get("traditional", ""),
        doc.get("psychology", ""),
    ]
    return " ".join(p for p in parts if p)


class BM25Index:
    def __init__(self, docs, k1=1.5, b=0.75):
        self.docs = docs
        self.k1 = k1
        self.b = b
        self.tokens = [tokenize(_doc_text(d)) for d in docs]
        self.lengths = [len(t) for t in self.tokens]
        self.avgdl = sum(self.lengths) / len(self.lengths) if self.lengths else 0.0

        df = Counter()
        for tokens in self.tokens:
            df.update(set(tokens))
        total = len(docs)
        self.idf = {
            term: math.log(1 + (total - freq + 0.5) / (freq + 0.5))
            for term, freq in df.items()
        }

    def score(self, query_tokens, index):
        tokens = self.tokens[index]
        if not tokens:
            return 0.0
        freq = Counter(tokens)
        length = self.lengths[index]
        score = 0.0
        for term in query_tokens:
            if term not in freq:
                continue
            idf = self.idf.get(term, 0.0)
            tf = freq[term]
            denom = tf + self.k1 * (1 - self.b + self.b * length / (self.avgdl or 1))
            score += idf * tf * (self.k1 + 1) / denom
        return score

    def search(self, query, top_k=5, predicate=None):
        query_tokens = tokenize(query)
        if not query_tokens:
            return []
        results = []
        for i, doc in enumerate(self.docs):
            if predicate and not predicate(doc):
                continue
            s = self.score(query_tokens, i)
            if s > 0:
                results.append((s, doc))
        results.sort(key=lambda x: x[0], reverse=True)
        return [
            {"score": round(score, 4), "doc": doc}
            for score, doc in results[:top_k]
        ]


_INDEXES = {}
_DREAMS = None


def _load_json(name):
    path = os.path.join(KNOWLEDGE_DIR, name)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


_SOURCE_FILES = {
    "dreams": "dreams.json",
    "tarot": "tarot.json",
    "bazi": "bazi_rules.json",
    "ziwei": "ziwei_rules.json",
}


def get_index(source):
    """source: dreams / tarot / bazi"""
    if source not in _SOURCE_FILES:
        raise ValueError(f"未知知识库：{source}")
    if source not in _INDEXES:
        _INDEXES[source] = BM25Index(_load_json(_SOURCE_FILES[source]))
    return _INDEXES[source]


def retrieve(query, source="dreams", top_k=3, category=None):
    def predicate(doc):
        return not category or doc.get("category") == category

    return get_index(source).search(query, top_k=top_k, predicate=predicate)


def rag_context(query, source="dreams", top_k=3, category=None):
    """返回 (prompt 片段, 引用列表)"""
    hits = retrieve(query, source, top_k, category)
    if not hits:
        return "", []

    lines = []
    refs = []
    for i, hit in enumerate(hits, 1):
        doc = hit["doc"]
        text = doc.get("text") or (
            f"{doc.get('traditional', '')} {doc.get('psychology', '')}"
        )
        lines.append(f"{i}. 《{doc['title']}》：{text}")
        refs.append({
            "id": doc.get("id"),
            "title": doc.get("title"),
            "category": doc.get("category", ""),
            "score": hit["score"],
        })
    return "\n".join(lines), refs


# ==================== 解梦词条查询 ====================
def _all_dreams():
    global _DREAMS
    if _DREAMS is None:
        _DREAMS = _load_json("dreams.json")
    return _DREAMS


def list_dreams(keyword="", category="", page=1, page_size=20):
    docs = _all_dreams()
    if category:
        docs = [d for d in docs if d["category"] == category]

    if keyword:
        hits = get_index("dreams").search(
            keyword, top_k=len(_all_dreams()),
            predicate=lambda d: not category or d["category"] == category,
        )
        matched = [h["doc"] for h in hits]
        if not matched:
            matched = [
                d for d in docs
                if keyword in d["title"] or any(keyword in k for k in d["keywords"])
            ]
        docs = matched

    total = len(docs)
    start = max(0, (page - 1) * page_size)
    return docs[start:start + page_size], total


def dream_categories():
    counts = Counter(d["category"] for d in _all_dreams())
    return [{"name": name, "count": count} for name, count in counts.most_common()]


def get_dream(dream_id):
    for d in _all_dreams():
        if d["id"] == dream_id:
            return d
    return None


def _save_dreams(docs):
    global _DREAMS
    path = os.path.join(KNOWLEDGE_DIR, "dreams.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(docs, f, ensure_ascii=False, indent=1)
    _DREAMS = docs
    _INDEXES.pop("dreams", None)


def add_dream(title, category, keywords, traditional, psychology):
    docs = list(_all_dreams())
    used = set()
    for d in docs:
        try:
            used.add(int(d["id"].split("-")[-1]))
        except (ValueError, KeyError):
            continue
    next_id = max(used or {0}) + 1
    item = {
        "id": f"dream-{next_id:03d}",
        "title": title,
        "category": category,
        "keywords": keywords,
        "traditional": traditional,
        "psychology": psychology,
    }
    docs.append(item)
    _save_dreams(docs)
    return item


def update_dream(dream_id, **fields):
    docs = list(_all_dreams())
    for i, d in enumerate(docs):
        if d["id"] != dream_id:
            continue
        for key in ("title", "category", "keywords", "traditional", "psychology"):
            if key in fields:
                d[key] = fields[key]
        docs[i] = d
        _save_dreams(docs)
        return d
    return None


def delete_dream(dream_id):
    docs = list(_all_dreams())
    remaining = [d for d in docs if d["id"] != dream_id]
    if len(remaining) == len(docs):
        return False
    _save_dreams(remaining)
    return True
