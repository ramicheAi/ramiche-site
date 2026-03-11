import Sidebar from '@/components/command-center/Sidebar';

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex' }}>
      <Sidebar />
      {/* Spacer for fixed sidebar — hidden on mobile */}
      <div className="hidden md:block" style={{ minWidth: 240, flexShrink: 0 }} />
      <main
        style={{
          minHeight: '100vh',
          overflowX: 'hidden',
          flex: 1,
          minWidth: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
