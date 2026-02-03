import styles from "./page.module.css";

type Link = { label: string; href: string };

const links: Link[] = [
  {
    label: "Weavy — GA PRODUCTS flow",
    href: "https://app.weavy.ai/flow/c6YNwJ4aj9z2iXcK1pRSeU",
  },
  {
    label: "Printful — iPhone case (MagSafe)",
    href: "https://www.printful.com/dashboard/custom/phone-cases/personalized/iphone-case-magsafe",
  },
  {
    label: "Printful — framed poster (black frame + mat)",
    href: "https://www.printful.com/dashboard/custom/wall-art/framed-posters/framed-poster-with-frame-mat-cm?technique=FRAMED-POSTER&color=Black&size=21%C3%9730%20cm",
  },
  {
    label: "Printful — oversized high neck tee (exclude heather grey)",
    href: "https://www.printful.com/dashboard/custom/mens/t-shirts/unisex-organic-oversized-high-neck-t-shirt-stanley-stella-satu020",
  },
];

const paths = [
  {
    label: "GA vault (source of truth)",
    value: "/Users/admin/Desktop/GA_DECK_CANON_V0",
  },
  {
    label: "Source art",
    value: "/Users/admin/Desktop/GA_DECK_CANON_V0/GA ART",
  },
  {
    label: "Finals output",
    value:
      "/Users/admin/Desktop/GA_DECK_CANON_V0/GALACTIK ANTICS PRODUCTS TO SAVE FINALS",
  },
];

const next3 = [
  "Attach the Weavy tab via OpenClaw Browser Relay (so Atlas can run GA PRODUCTS in-browser)",
  "Run phone case production renders (case-safe art) → save into finals folder",
  "Create Printful iPhone case product (15–17 MagSafe) with listing-ready images + initial copy",
];

const checklist = [
  {
    title: "Phone cases (priority #1)",
    items: [
      "Pick art (case-safe crop; avoid camera cutout/wrap issues)",
      "Generate production shoot renders via Weavy GA PRODUCTS",
      "Save outputs into finals folder (named, organized)",
      "Upload to Printful + configure variants (iPhone 15–17 MagSafe)",
      "Pricing + margins",
      "PDP copy (story + materials + shipping)",
    ],
  },
  {
    title: "Framed posters (priority #2)",
    items: [
      "Generate production renders",
      "Black frame + mat preset",
      "PDP copy + sizing notes",
    ],
  },
  {
    title: "T-shirts (priority #3)",
    items: [
      "Choose colors (exclude heather grey)",
      "Generate production renders",
      "PDP copy + sizing",
    ],
  },
  {
    title: "Shopify (release readiness)",
    items: [
      "Theme baseline + GA branding",
      "Collections structure",
      "PDP template consistency",
      "Policies + payments + tax",
      "QA mobile browsing",
    ],
  },
];

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>Automation Dock</div>
          <h1 className={styles.h1}>GA Launch Command Center</h1>
          <p className={styles.sub}>
            Product execution order: <strong>phone cases → framed posters → t-shirts</strong>.
          </p>
        </div>
        <div className={styles.badges}>
          <span className={styles.badge}>No auto-publish</span>
          <span className={styles.badge}>PRs only</span>
          <span className={styles.badge}>Signal-first</span>
          <a className={styles.badge} href="/music">Music Command Center</a>
        </div>
      </header>

      <section className={styles.grid}>
        <div className={styles.card}>
          <h2 className={styles.h2}>Next 3 actions</h2>
          <ol className={styles.list}>
            {next3.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ol>
          <p className={styles.note}>
            Tip: once Browser Relay is attached to Weavy, Atlas can run the flow reliably without
            macOS screen recording permissions.
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2}>Key links</h2>
          <ul className={styles.list}>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <h2 className={styles.h2}>Local paths</h2>
          <ul className={styles.list}>
            {paths.map((p) => (
              <li key={p.label}>
                <div className={styles.row}>
                  <span className={styles.muted}>{p.label}</span>
                  <code className={styles.code}>{p.value}</code>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.cardWide}>
          <h2 className={styles.h2}>Launch checklist</h2>
          <div className={styles.columns}>
            {checklist.map((c) => (
              <div key={c.title} className={styles.miniCard}>
                <h3 className={styles.h3}>{c.title}</h3>
                <ul className={styles.list}>
                  {c.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.muted}>
          Dock v0.1 — designed to make “wake up and say wow” possible.
        </div>
      </footer>
    </main>
  );
}
