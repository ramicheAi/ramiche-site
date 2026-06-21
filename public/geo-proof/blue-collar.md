# AI-Visibility Fix — Blue Collar (Miami)
**https://www.bluecollarmiami.com/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Blue Collar",
  "description": "BentoBox offers restaurants beautiful, mobile friendly websites that drive revenue and customers — complete with a simple, hospitality-focused management system, hosting and exceptional customer suppo",
  "url": "https://www.bluecollarmiami.com/",
  "telephone": "+1-305-756-0366",
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
