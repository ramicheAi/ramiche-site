import { readFileSync } from 'fs';
import Stripe from 'stripe';

const envContent = readFileSync('.env.stripe-prod', 'utf8');
const match = envContent.match(/STRIPE_SECRET_KEY="([^"]+)"/);
const key = match[1].replace(/\\n/g, '').trim();
const stripe = new Stripe(key);

// Update product descriptions to match billing page
await stripe.products.update('prod_TzZTlFMGtquVp9', {
  description: 'Up to 50 athletes. Coach, Athlete & Parent portals. XP & gamification. Cloud sync.'
});
console.log('✓ Starter updated');

await stripe.products.update('prod_TzZTQAiHw4Zger', {
  description: 'Up to 150 athletes. Full Apex experience with priority support, advanced analytics, and custom team branding.'
});
console.log('✓ Club updated');

await stripe.products.update('prod_TzZTltBWmjH7bR', {
  description: 'Up to 300 athletes. Full Apex experience with dedicated success manager and multi-sport support.'
});
console.log('✓ Program updated');
