import { readFileSync } from 'fs';
import Stripe from 'stripe';

const envContent = readFileSync('.env.stripe-prod', 'utf8');
const match = envContent.match(/STRIPE_SECRET_KEY="([^"]+)"/);
const key = match[1].replace(/\\n/g, '').trim();

const stripe = new Stripe(key);

// Create Starter tier product + price
const starterProduct = await stripe.products.create({
  name: 'Apex Starter',
  description: 'Up to 50 athletes. Coach, Athlete & Parent portals. XP & gamification. Cloud sync.',
});
const starterPrice = await stripe.prices.create({
  product: starterProduct.id,
  unit_amount: 14900, // $149
  currency: 'usd',
  recurring: { interval: 'month' },
});
console.log('Starter:', starterProduct.id, starterPrice.id);

// Create Club tier product + price
const clubProduct = await stripe.products.create({
  name: 'Apex Club',
  description: 'Up to 150 athletes. Everything in Starter plus performance analytics, meet management, and multi-sport support.',
});
const clubPrice = await stripe.prices.create({
  product: clubProduct.id,
  unit_amount: 34900, // $349
  currency: 'usd',
  recurring: { interval: 'month' },
});
console.log('Club:', clubProduct.id, clubPrice.id);

// Create Program tier product + price
const programProduct = await stripe.products.create({
  name: 'Apex Program',
  description: 'Up to 300 athletes. Everything in Club plus API access, advanced analytics, priority support, and custom branding.',
});
const programPrice = await stripe.prices.create({
  product: programProduct.id,
  unit_amount: 54900, // $549
  currency: 'usd',
  recurring: { interval: 'month' },
});
console.log('Program:', programProduct.id, programPrice.id);

// Note: existing APEX Team Plan ($249) will be archived — we're replacing the pricing structure
// The old price_1T0cx2RPYJlU529ec8oz2jmF stays for any existing subscribers

console.log('\n=== Summary ===');
console.log('Starter: $149/mo | product:', starterProduct.id, '| price:', starterPrice.id);
console.log('Club:    $349/mo | product:', clubProduct.id, '| price:', clubPrice.id);
console.log('Program: $549/mo | product:', programProduct.id, '| price:', programPrice.id);
console.log('Enterprise: Custom pricing (contact us) — no Stripe product needed');
