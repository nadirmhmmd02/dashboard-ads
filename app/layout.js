import './globals.css';
import Sidebar from './components/Sidebar';

export const metadata = {
  title: 'WILL OF D · Dashboard Ads',
  description: 'Performance Marketing Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wd-theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
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