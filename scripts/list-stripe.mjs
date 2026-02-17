import { readFileSync } from 'fs';
import Stripe from 'stripe';

// Read key from env file
const envContent = readFileSync('.env.stripe-prod', 'utf8');
const match = envContent.match(/STRIPE_SECRET_KEY="([^"]+)"/);
const key = match[1].replace(/\\n/g, '').trim();

const stripe = new Stripe(key);

const products = await stripe.products.list({ limit: 10 });
console.log('=== Products ===');
products.data.forEach(p => console.log(p.id, '|', p.name, '|', p.active));

const prices = await stripe.prices.list({ limit: 20, active: true });
console.log('\n=== Prices ===');
prices.data.forEach(p => console.log(p.id, '| prod:', p.product, '| amt:', p.unit_amount, p.currency, '| interval:', p.recurring?.interval));
