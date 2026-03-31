import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resume Scanner - AI-Powered Resume Screening',
  description: 'Upload and analyze resumes with AI-powered screening and ranking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="bg-blue-600 text-white p-4 shadow-md">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold">Resume Scanner</h1>
            <p className="text-blue-100">AI-Powered Resume Screening & Ranking</p>
          </div>
        </header>
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
        <footer className="bg-gray-800 text-white p-4 mt-8">
          <div className="container mx-auto text-center">
            <p>&copy; 2024 Resume Scanner. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
