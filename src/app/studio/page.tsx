export default function StudioPage() {
  return (
    <main style={{padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif'}}>
      <h1 style={{fontSize: '2.5rem', marginBottom: '0.5rem'}}>RAMICHE Studio</h1>
      <p style={{fontSize: '1.25rem', color: '#666', marginBottom: '2rem'}}>
        Creative direction for small brands. Built to ship.
      </p>
      
      <section style={{background: '#f5f5f5', padding: '2rem', borderRadius: '12px', marginTop: '2rem'}}>
        <h2 style={{marginTop: 0}}>$400 Creative Direction Sprint</h2>
        <p>48-hour brand identity system. Two directions. One winner. Delivered fast.</p>
        <a 
          href="mailto:studio@ramiche.com?subject=Sprint%20Inquiry" 
          style={{
            display: 'inline-block',
            background: '#000',
            color: '#fff',
            padding: '1rem 2rem',
            textDecoration: 'none',
            borderRadius: '8px',
            marginTop: '1rem',
            fontWeight: '600'
          }}
        >
          Start Your Sprint →
        </a>
      </section>
      
      <footer style={{marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #eee', color: '#999'}}>
        © 2025 Ramiche Studio
      </footer>
    </main>
  );
}
