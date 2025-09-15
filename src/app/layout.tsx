import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ResearchBanner from '@/components/ResearchBanner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Momo LINE Bot',
  description: 'LINE Bot application with OpenAI and Supabase integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ResearchBanner />
        {children}
      </body>
    </html>
  )
}




