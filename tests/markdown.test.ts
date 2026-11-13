import assert from 'node:assert/strict'
import test from 'node:test'
import Markdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'
import { markdownPlugins } from '../src/markdown.ts'
import { islandAssetUrl } from '../src/island-content.ts'

function render(body: string) {
  return renderToStaticMarkup(Markdown({ children: body, ...markdownPlugins, urlTransform: url => islandAssetUrl(url, '5/article.md') }))
}

test('LaTeX renders inline and display formulas with KaTeX', () => {
  const html = render('Inline $E=mc^2$.\n\n$$\n\\frac{1}{2} + \\sqrt{x}\n$$')
  assert.match(html, /class="katex"/)
  assert.match(html, /class="katex-display"/)
  assert.match(html, /<math[^>]*display="block"/)
  assert.match(html, /<mfrac>/)
  assert.match(html, /<msqrt>/)
  assert.doesNotMatch(html, /katex-error/)
})

test('trusted HTML retains layout styles, media, iframe and custom tags', () => {
  const html = render('<div style="display: flex; gap: 2px;"><img src="./5/image.avif" style="background-color: #191919"></div>\n\n<video controls poster="./5/poster.avif"><source src="./5/video.mp4" type="video/mp4"></video>\n\n<iframe src="https://www.shadertoy.com/embed/4s23zz" allowfullscreen></iframe>\n\n<custom-label data-value="example">Text</custom-label>')
  assert.match(html, /style="display:flex;gap:2px"/)
  assert.match(html, /style="background-color:#191919"/)
  assert.match(html, /src="\/island-assets\/5\/5\/image.avif"/)
  assert.match(html, /poster="\/island-assets\/5\/5\/poster.avif"/)
  assert.match(html, /<video[^>]*controls=""/)
  assert.match(html, /<source src="\/island-assets\/5\/5\/video.mp4" type="video\/mp4"/)
  assert.match(html, /<iframe[^>]*src="https:\/\/www.shadertoy.com\/embed\/4s23zz"/)
  assert.match(html, /allowFullScreen=""/)
  assert.match(html, /<custom-label data-value="example">Text<\/custom-label>/)
})

test('code blocks preserve literal HTML and LaTeX', () => {
  const html = render('```html\n<div>$x$</div>\n```')
  assert.match(html, /&lt;div&gt;\$x\$&lt;\/div&gt;/)
  assert.doesNotMatch(html, /class="katex"/)
})
