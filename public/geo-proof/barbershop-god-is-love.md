# AI-Visibility Fix — Barbershop God is Love (Miami)
**https://god-is-love-1995.square.site/** · type: BarOrPub

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BarOrPub",
  "name": "Barbershop God is Love",
  "description": "&quot;Nothing says &#039;I&#039;m ready for a new life&#039; like a change of look.&quot;",
  "url": "https://god-is-love-1995.square.site/",
  "telephone": "+1-786-560-6692",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Miami",
    "addressRegion": "FL",
    "addressCountry": "US"
  },
  "priceRange": "$$"
}
</script>
```

Before: invisible to ChatGPT/Perplexity. After: machine-readable → recommendable. — Parallax
