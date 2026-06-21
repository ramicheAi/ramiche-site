# AI-Visibility Fix — Aunt I's Jamaican Restaurant (Fort Lauderdale)
**http://auntisjamaicanrestaurant.com** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Aunt I's Jamaican Restaurant",
  "description": "Aunt I",
  "url": "http://auntisjamaicanrestaurant.com",
  "telephone": "+1-954-321-0190",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Fort Lauderdale",
    "addressRegion": "FL",
    "addressCountry": "US"
  },
  "priceRange": "$$"
}
</script>
```

Before: invisible to ChatGPT/Perplexity. After: machine-readable → recommendable. — Parallax
