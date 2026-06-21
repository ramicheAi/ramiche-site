# AI-Visibility Fix — Doc B's Fresh Kitchen (Fort Lauderdale)
**https://docbsfreshkitchen.com/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Doc B's Fresh Kitchen",
  "description": "Doc B&#x27;s Restaurant serves fast, fresh meals for lunch and dinner, including local ingredients, healthful dishes, pizza, sandwiches, salads and more.",
  "url": "https://docbsfreshkitchen.com/",
  "telephone": "+1-754-900-2401",
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
