import Comms from '@/components/command-center/po/Comms';

/* COMMS — Parallax OS reskin. Channels + agent DMs, streaming replies, inline
   Job/Data cards, composer, and the Transmissions Console. The ATLAS direct
   line is backed by the real /api/command-center/ws bus (preserved). */
export default function CommsPage() {
  return <Comms />;
}
