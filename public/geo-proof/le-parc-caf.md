# AI-Visibility Fix — Le Parc Café (Miami)
**https://www.coralgablescountryclub.com/leparc-caf%C3%A9** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Le Parc Café",
  "description": "Le Parc Café in Miami, FL.",
  "url": "https://www.coralgablescountryclub.com/leparc-caf%C3%A9",
  "telephone": "+1 305-772-8785",
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
