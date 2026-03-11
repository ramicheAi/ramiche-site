import Sidebar from '@/components/command-center/Sidebar';

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <div
        style={{
          marginLeft: 240,
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
        className="max-md:!ml-0"
      >
        {children}
      </div>
    </div>
  );
}
