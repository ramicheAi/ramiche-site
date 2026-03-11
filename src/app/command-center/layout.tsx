import Sidebar from '@/components/command-center/Sidebar';

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <main
        style={{
          minHeight: '100vh',
          overflowX: 'hidden',
        }}
        className="ml-0 md:ml-[240px] transition-[margin] duration-200"
      >
        {children}
      </main>
    </div>
  );
}
