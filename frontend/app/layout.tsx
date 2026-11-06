import './globals.css';
import type { ReactNode } from 'react';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-gray-50">
        <div className="min-h-screen flex flex-col">
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h1 className="text-xl font-bold">NourishNet</h1>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <footer className="bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center text-sm text-gray-500">
              © 2026 NourishNet. All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}