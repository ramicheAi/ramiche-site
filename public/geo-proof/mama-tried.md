# AI-Visibility Fix — Mama Tried (Miami)
**http://mamatriedmia.com/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Mama Tried",
  "description": "Mama Tried in Miami, FL.",
  "url": "http://mamatriedmia.com/",
  "telephone": "+1 786-803-8087",
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
