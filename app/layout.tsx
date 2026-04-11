import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🧾 小票情绪生成器',
  description: '把你的关系变成一张可以分享的票据',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700&family=Noto+Sans+SC:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
