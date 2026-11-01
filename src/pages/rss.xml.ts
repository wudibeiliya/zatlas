import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts } from '../utils/posts';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  const site = context.site ?? new URL('https://zatlas.vercel.app');

  return rss({
    title: 'ZAtlas',
    description: 'ZAtlas 的知识分享：教程、技术文章与踩坑记录。',
    site: site.toString(),
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: new URL(`/blog/${post.id}/`, site).toString(),
    })),
    customData: '<language>zh-cn</language>',
  });
}
