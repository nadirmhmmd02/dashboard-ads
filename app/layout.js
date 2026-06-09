import './globals.css';
import Navbar from './components/Navbar';

export const metadata = {
  title: 'Dashboard Ads',
  description: 'Dashboard Ads - Baba Rafi Enterprise',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <Navbar />
        <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}