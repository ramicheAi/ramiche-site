# AI-Visibility Fix — Guantanamera Cigars & Cafe (Miami)
**https://www.guantanameracigars.com/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Guantanamera Cigars & Cafe",
  "description": "Guantanamera offers a variety of hand-crafted cigars suitable for any afficionado.",
  "url": "https://www.guantanameracigars.com/",
  "telephone": "+1-786-618-5142",
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
