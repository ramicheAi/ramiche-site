# AI-Visibility Fix — Tom Jenkins BBQ (Fort Lauderdale)
**https://tomjenkinsbbq.net/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Tom Jenkins BBQ",
  "description": "Tom Jenkins BBQ in Fort Lauderdale, FL.",
  "url": "https://tomjenkinsbbq.net/",
  "telephone": "+1-954-522-5046",
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
