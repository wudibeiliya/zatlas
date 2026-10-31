---
title: 用 SQLite FTS5 做中文全文检索：双字切分的取舍
description: 从 LIKE 查询的瓶颈出发，讲清 FTS5 的基本用法、中文分词问题，以及为什么用双字切分，最后给出可重建索引的工程做法。
pubDate: 2026-10-20
tags: [SQLite, 全文检索, 中文处理]
draft: false
---

个人知识库里最常做的操作不是“打开某篇笔记”，而是“我记得写过某个概念，帮我找出来”。一开始我用 `LIKE '%关键词%'` 扫全表，笔记少的时候没问题，几千篇之后每次搜索都要等上一两秒，而且没法按相关度排序。

这篇文章记录我改用 SQLite FTS5 的过程，重点讲中文场景下绕不开的一个问题：分词。

## 为什么不用 LIKE

`LIKE` 的问题不只是慢：

- 全表扫描，数据量一大就线性变慢。
- 只能判断“包含”，没有相关度排序。
- 对大小写、标点、空白很敏感，查询词稍不一致就搜不到。
- 无法建立真正的倒排索引。

FTS5 是 SQLite 内置的全文检索扩展，提供倒排索引、`MATCH` 查询和 `rank` 排序，足够个人知识库使用，而且不需要额外服务。

## FTS5 的最小可用配置

先建一张虚拟表：

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  title,
  body,
  tokenize = 'unicode61'
);
```

写入和查询都很直接：

```sql
INSERT INTO notes_fts (title, body) VALUES (?, ?);

SELECT rowid, title
FROM notes_fts
WHERE notes_fts MATCH ?
ORDER BY rank
LIMIT 20;
```

如果只有英文内容，到这里就结束了。中文的问题出在 `unicode61` 分词器上。

## 中文分词为什么是难点

英文用空格分词，`unicode61` 可以工作得很好。中文没有空格，连续的汉字会被当成一个很长的词元。结果是：索引里存的是“个人知识库检索方案”，你搜“知识库”却匹配不到，因为索引里没有这个独立的词元。

常见解法有三类：

1. 接入专门的中文分词器（如 jieba），效果好，但引入额外依赖，还要处理分词器与 SQLite 的绑定。
2. 使用 SQLite 的 `simple` 分词器或第三方扩展，配置成本较高。
3. 在写入和查询时都做**双字切分**（bigram），把连续汉字拆成重叠的两字词元。

个人项目里，我选了第三种：实现简单、没有额外依赖、效果足够。

## 双字切分（bigram）

核心思路是把“文档切分”变成“文档 档切 切分”三个词元。这样任意一个两字以上的查询词，都能命中重叠的部分。

一个够用的 Python 实现：

```python
import re

def bigrams(text: str) -> str:
    tokens = re.findall(r'[a-zA-Z0-9_]+|[一-鿿]+', text)
    out = []
    for token in tokens:
        if token.isascii():
            out.append(token)
        elif len(token) == 1:
            out.append(token)
        else:
            out.extend(token[i:i + 2] for i in range(len(token) - 1))
    return ' '.join(out)
```

写入时，把 `title` 和 `body` 都先经过 `bigrams()`，再写进 FTS 表。原始 Markdown 仍然是权威数据，FTS 表只是可重建的索引。

## 查询时也要切分

这一点很容易漏掉：**查询词必须用同样的规则切分**，否则索引和查询对不上。

```python
query = bigrams("文档切分")
# -> "文档 档切 切分"

rows = db.execute(
    "SELECT rowid, title FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 20",
    (query,),
).fetchall()
```

FTS5 默认把空格分隔的词元按 AND 处理，所以“文档 档切 切分”要求三个词元都出现，召回会比较严格。如果希望更宽松，可以把查询改成 OR，或者对查询词做更细的拆分策略。

## 英文词按原词匹配

上面的正则把英文和数字单独保留，所以 `RAG`、`MCP`、`FTS5` 这类词仍然按原词匹配，不会被拆成奇怪的双字组合。这也是混合中英文知识库必须处理的细节。

## 索引只是辅助数据

我给自己定了一条规则：**Markdown 是权威，SQLite 是可重建的辅助数据**。

这意味着：

- 索引损坏时，直接删掉重建，不要手修。
- 每次全量重建都应该能从 Vault 完整恢复。
- 索引结构变更时，用版本号标记，启动时检查并重建。

这条规则让检索系统变得可维护：出问题时的恢复动作是确定的，而不是“希望它还活着”。

## 局限

双字切分不是银弹：

- 单字查询（比如只搜“库”）效果差，通常要求至少两个字。
- 词元数量膨胀，索引体积会比原文大。
- 没有词性、同义词、停用词处理，语义召回能力有限。
- 对错别字和近义词不友好。

如果这些局限开始影响使用，再考虑接入真正的分词器或向量检索。但在个人知识库这个规模下，FTS5 + 双字切分已经能覆盖大部分“我知道自己写过”的搜索场景。

## 小结

- `LIKE` 适合临时查询，不适合作为检索层。
- FTS5 提供倒排索引和排序，是个人知识库的合理起点。
- 中文场景下，写入和查询都要用同一套双字切分规则。
- 把索引当作可重建的派生数据，系统才容易维护。
