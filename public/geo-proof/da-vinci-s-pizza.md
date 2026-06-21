# AI-Visibility Fix — Da Vinci's Pizza (Fort Lauderdale)
**http://davincispizzeriafl.com** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Da Vinci's Pizza",
  "description": "Da Vinci's Pizza in Fort Lauderdale, FL.",
  "url": "http://davincispizzeriafl.com",
  "telephone": "+1-954-561-0404",
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
