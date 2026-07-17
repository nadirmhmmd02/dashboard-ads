import './globals.css';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from './components/AuthContext';
import { DateFilterProvider } from './components/DateFilterContext';
import AppShell from './components/AppShell';

// Font resmi redesain 2026 — geometris modern, satu keluarga untuk semua teks & angka
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata = {
  title: 'Baba Rafi Ad Hub',
  description: 'Performance Marketing Dashboard',
};

// No-flash theme: pilih tema sesuai role terakhir (ditulis AuthContext saat
// login/restore sesi Supabase) + preferensi tema tersimpan per role
const themeInit = `(function(){try{
  var role=localStorage.getItem('wd-last-role');
  if(!role)return;
  var t=localStorage.getItem('wd-theme-'+role)||(role==='admin'?'dark':'light');
  document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="id" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={jakarta.className}>
        <AuthProvider>
          <DateFilterProvider>
            <AppShell>{children}</AppShell>
          </DateFilterProvider>
        </AuthProvider>
      </body>
    </html>
  );
}