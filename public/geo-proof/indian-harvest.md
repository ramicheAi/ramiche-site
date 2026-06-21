# AI-Visibility Fix — Indian Harvest (Boca Raton)
**https://www.indianharvestboca.com/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Indian Harvest",
  "description": "Online ordering menu for Indian Harvest. Here at Indian Harvest in Boca Raton, FL, we serve Indian cuisine such as tandoori, chicken tikka masala, curry, biryani, and more. We are located east of inte",
  "url": "https://www.indianharvestboca.com/",
  "telephone": "+1 561 465 3246",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Boca Raton",
    "addressRegion": "FL",
    "addressCountry": "US"
  },
  "priceRange": "$$"
}
</script>
```

Before: invisible to ChatGPT/Perplexity. After: machine-readable → recommendable. — Parallax
