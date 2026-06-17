import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Corporate Signage',
  description: 'TV corporativa e mural de avisos digital signage.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
