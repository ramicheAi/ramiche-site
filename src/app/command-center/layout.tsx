import Sidebar from '@/components/command-center/Sidebar';

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <div
        id="cc-content"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          marginLeft: 240,
          overflowX: 'hidden' as const,
        }}
      >
        {children}
      </div>
      <style>{`
        @media (max-width: 767px) {
          #cc-content { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
