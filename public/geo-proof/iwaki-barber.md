# AI-Visibility Fix — Iwaki Barber (Miami)
**https://iwaki-barber.square.site/** · type: BarOrPub

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BarOrPub",
  "name": "Iwaki Barber",
  "description": "Iwaki Barber in Miami, FL.",
  "url": "https://iwaki-barber.square.site/",
  "telephone": "+1-786-470-9629",
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
