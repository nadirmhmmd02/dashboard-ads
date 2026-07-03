import './globals.css';
import { AuthProvider } from './components/AuthContext';
import AppShell from './components/AppShell';

export const metadata = {
  title: 'WILL OF D · Dashboard Ads',
  description: 'Performance Marketing Dashboard',
};

// No-flash theme: pilih tema sesuai role tersimpan + preferensi terakhir
const themeInit = `(function(){try{
  var raw=localStorage.getItem('wd-auth')||sessionStorage.getItem('wd-auth');
  if(!raw)return;
  var role=JSON.parse(raw).role;
  var t=localStorage.getItem('wd-theme-'+role)||(role==='admin'?'dark':'light');
  document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}