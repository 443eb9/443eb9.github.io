import type { Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'

export const markdownPlugins: Pick<Options, 'remarkPlugins' | 'rehypePlugins'> = {
  remarkPlugins: [remarkGfm, remarkMath],
  rehypePlugins: [rehypeRaw, [rehypeKatex, { trust: true }]],
}
