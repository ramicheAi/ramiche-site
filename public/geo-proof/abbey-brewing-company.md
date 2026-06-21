# AI-Visibility Fix — Abbey Brewing Company (Miami)
**https://abbeybrewinginc.com/** · type: BarOrPub

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BarOrPub",
  "name": "Abbey Brewing Company",
  "description": "Abbey Brewing Company in Miami, FL.",
  "url": "https://abbeybrewinginc.com/",
  "telephone": "+1-305-538-8110",
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
