import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata = {
  title: 'WILL OF D · Dashboard Ads',
  description: 'Performance Marketing Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="dark">
      <body>
        <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
          <Sidebar />
          <main
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}