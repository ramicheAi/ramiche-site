import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "METTLE — Log In",
  description: "Log in to your METTLE account. Access your coach, athlete, or parent dashboard.",
  openGraph: {
    title: "METTLE — Log In",
    description: "Log in to your METTLE account. Access your coach, athlete, or parent dashboard.",
  },
  twitter: {
    card: "summary",
    title: "METTLE — Log In",
    description: "Log in to your METTLE account.",
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
