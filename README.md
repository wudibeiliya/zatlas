# ZAtlas

个人知识分享站：教程、技术文章与踩坑记录。

- 框架：Astro（静态输出）
- 样式：原生 CSS + CSS 变量
- 内容：`src/content/blog/*.md`
- 部署：GitHub + Vercel

## 本地开发

```bash
npm install
npm run dev
```

打开终端提示的本地地址（通常是 `http://localhost:4321`）。

## 构建与预览

```bash
npm run build
npm run preview
```

构建产物在 `dist/`。

## 写一篇新文章

在 `src/content/blog/` 新建 `<slug>.md`：

```md
---
title: 文章标题
description: 一句话摘要，用于列表和 SEO
pubDate: 2026-11-01
tags: [标签一, 标签二]
draft: false
---

正文使用 Markdown。
```

- `slug` 就是文件名，也是文章 URL：`/blog/<slug>/`。
- `draft: true` 的文章不会出现在构建结果中。
- 图片放在 `public/images/<slug>/`，正文里用 `/images/<slug>/xxx.png` 引用。

## 发布

```bash
git add .
git commit -m "post: 文章标题"
git push
```

推送到 GitHub 后，Vercel 会自动构建并发布。

## 目录说明

```
src/
├── content.config.ts     内容集合与 frontmatter 校验
├── content/blog/         文章 Markdown
├── layouts/              页面布局
├── components/           页头、页脚、主题按钮、文章卡片
├── styles/global.css     全局样式与主题变量
├── utils/posts.ts        文章排序、标签聚合、归档分组
└── pages/                路由
```

## 主题

默认浅色纸张风，右上角按钮循环切换：浅色 → 深色 → 跟随系统。选择保存在浏览器 `localStorage`，首屏由内联脚本提前应用，避免闪烁。
