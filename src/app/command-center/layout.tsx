import Sidebar from '@/components/command-center/Sidebar';

export default function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <Sidebar />
      <div id="cc-content" style={{ minHeight: '100vh', overflowX: 'hidden' }}>
        {children}
      </div>
      <style>{`
        #cc-content { margin-left: 240px; }
        @media (max-width: 767px) { #cc-content { margin-left: 0; } }
      `}</style>
    </div>
  );
}
