import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'VidBoard | Music Video Storyboard Planner',
  description: 'AI-powered music video storyboard planner.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="bg-[#111111] text-neutral-50 font-sans antialiased min-h-screen flex flex-col selection:bg-amber-500/30" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
