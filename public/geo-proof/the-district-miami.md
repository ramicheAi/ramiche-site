# AI-Visibility Fix — The District Miami (Miami)
**http://thedistrictmiami.com** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "The District Miami",
  "description": "The District Miami in Miami, FL.",
  "url": "http://thedistrictmiami.com",
  "telephone": "+1-305-573-4199",
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
