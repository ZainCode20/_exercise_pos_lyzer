
import type {Metadata} from 'next';
import { Inter } from 'next/font/google' // Use Inter for a clean look
import './globals.css';
import { Toaster } from "@/components/ui/toaster" // Import Toaster

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' }) // Define Inter font variable

export const metadata: Metadata = {
  title: 'GymSight - AI Fitness Form Analyzer',
  description: 'Get real-time feedback on your exercise form using AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}> {/* Use Inter font */}
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
