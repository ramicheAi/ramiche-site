# CC-RECOVERY-23 Phase 4 — database backup capability, resolved

**Status: capability resolved with authoritative evidence. Mechanism proven with synthetic data.
No real content has been exported, encrypted, or stored anywhere. Nothing here has been executed
against production.**

## The question, answered definitively

Earlier rounds could not confirm whether `command-center-hq` (project `qkbkfsjkysdsfmhgfdoc`) has
any managed backup or PITR. This round resolved it with authoritative evidence rather than
inference:

- **Organization plan: free tier** (confirmed via `get_organization`).
- **Supabase's own documentation, read directly** (`search_docs` against the live Supabase docs,
  not memory): *"We automatically back up all Pro, Team, and Enterprise Plan projects on a daily
  basis... We recommend that free tier plan projects regularly export their data using the
  Supabase CLI `db dump` command and maintain off-site backups."*
- **Point-in-Time Recovery (PITR): Pro/Team/Enterprise add-on only**, additionally requiring at
  least a Small compute add-on. Not available on free tier at any price.
- **Branching**: listed as a `beta` platform feature for testing/previewing schema changes with a
  forked copy of data — not described anywhere as a production recovery mechanism, and nothing in
  the docs frames it as a backup/restore guarantee.

**Conclusion: this database has no managed backup or PITR of any kind today.** The only
recoverability if something goes wrong is whatever this project creates and holds itself. This is
no longer an open question — it's a confirmed fact that should shape how cautiously the migration
sequence in `CC-RECOVERY-21-MIGRATION-DEPLOYMENT-SEQUENCE.md` gets executed.

## The backup mechanism — designed and proven, not yet real

Per this round's explicit instruction, **no full-content production backup has been created**.
What's done instead: the entire mechanism — export, encrypt, store, decrypt, restore — proven
end-to-end against a synthetic dataset matching production's real shape (432 rows, same columns),
never touching real message content.

**Proven steps:**
1. A dataset shaped exactly like the real export (432 rows, same columns as `public.messages`)
   was written to a local JSON file.
2. Encrypted with `openssl enc -aes-256-cbc -pbkdf2 -iter 200000` under a randomly generated
   32-byte passphrase (`openssl rand -base64 32`) — a passphrase that strong is not brute-forceable
   and doesn't depend on any particular tool (`openssl` is present everywhere this would run; no
   dependency on `age` or `gpg`, though either would also work if preferred).
3. Decrypted and compared byte-for-byte (`sha256sum`) against the original — identical.
4. Restored into a fresh, disposable PostgreSQL 17 instance from the decrypted data — all 432 rows
   landed, first and last rows spot-checked for content correctness in the right order.
5. The disposable instance was stopped and deleted immediately after.

**What this proves:** the encrypt/store/decrypt/restore pipeline itself is sound. What it does
NOT yet answer — because answering it means touching real content, which needs your sign-off
first — is where the real encrypted backup should live and who/what can reach it.

## Proposed real backup, pending your approval on destination and handling

1. **Export**: either the Supabase CLI's `db dump` (the method Supabase's own docs recommend for
   free tier) run with real production credentials, or the same JSON-export approach already used
   for this round's content-safe fingerprint (read-only `execute_sql`), scaled up to full content.
   The CLI route produces a standard pg_dump-format file; the JSON route is simpler to encrypt and
   verify but is not a drop-in `pg_restore` target (the restore step would need to replay it as
   INSERTs, as this round's proof-of-concept did).
2. **Encrypt immediately**, before the plaintext export touches any persistent storage longer than
   necessary — same `openssl enc -aes-256-cbc -pbkdf2` approach just proven, with a freshly
   generated passphrase.
3. **Destination — needs your decision, not mine:** candidates are the iMac host's existing
   `~/.openclaw/workspace/secrets/`-equivalent pattern (already used for other secrets this
   session, 600-permissioned files in a 700-permissioned directory) for the encrypted blob, with
   the passphrase itself stored somewhere *separate* from the blob (your password manager, not
   alongside it on the same host) — the standard reason being that whoever can read the encrypted
   file should not automatically also hold the key. I have not picked a destination because this
   is explicitly the "destination and access controls" decision this round reserved for you.
4. **Retention**: a single dated snapshot before the migration runs is the minimum; whether to
   keep a rolling series afterward is a cost/discipline tradeoff I'd defer to you rather than
   invent a policy unprompted.
5. **Restoration**: proven above, mechanically. A real restoration would replay the decrypted
   export against either a fresh Supabase branch (safe, isolated, doesn't touch the live project)
   or, in a genuine disaster, a fresh project — never directly against the live database while
   other rows might have changed since the export.
6. **Verification**: the same content-safe fingerprint technique from
   `CC-RECOVERY-21-MIGRATION-DEPLOYMENT-SEQUENCE.md` (an md5 over id/channel_id/sender_type/
   content-length/created_at, never the actual text) lets you confirm a restored backup matches
   the live database at export time without ever displaying message content anywhere, including
   in this kind of report.

**Nothing above has been executed for real.** I'm stopping at "mechanism proven, destination
pending your decision" exactly as instructed — the next concrete step requires you to pick where
the encrypted file and its passphrase each live, after which I can run the real export, encrypt it,
place it, and verify the fingerprint matches, all without ever printing message content anywhere.
