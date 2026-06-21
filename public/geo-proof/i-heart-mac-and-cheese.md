# AI-Visibility Fix — I Heart Mac And Cheese (Fort Lauderdale)
**https://www.iheartmacandcheese.com/** · type: Restaurant

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "I Heart Mac And Cheese",
  "description": "I Heart Mac &amp; Cheese serves up chef-inspired mac &amp; cheese bowls, grilled cheese sandwiches, and more. Find bold flavors, melty cheese, and crave-worthy comfort food at each of our locations.",
  "url": "https://www.iheartmacandcheese.com/",
  "telephone": "+1-954-533-4195",
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
