# AI-Visibility Fix — Conde Hair Salon (Miami)
**https://www.condehairsalon.com** · type: HairSalon

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HairSalon",
  "name": "Conde Hair Salon",
  "description": "We specialize in five premium hair extension methods: I-Tips, K-Tips, Tape-In, Weft, and Brazilian Knots.",
  "url": "https://www.condehairsalon.com",
  "telephone": "+1-786-789-2232",
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
