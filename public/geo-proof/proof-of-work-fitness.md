# AI-Visibility Fix — Proof of Work Fitness (Miami)
**https://www.proofofwork.fit/** · type: ExerciseGym

Your live site has **no structured data** → AI assistants can't read/recommend you. The fix (paste into <head>):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ExerciseGym",
  "name": "Proof of Work Fitness",
  "description": "I became a Pharmacist in 2014 and trained my first paid fitness client 5 years later. In pharmacy school, optimizing Wellness through diet, exercise, handling stress, social isolation and sleep was ca",
  "url": "https://www.proofofwork.fit/",
  "telephone": "+1-954-418-2545",
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
