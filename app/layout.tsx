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
      <body>{children}</body>
    </html>
  )
}
