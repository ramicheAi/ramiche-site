import { ThemeProvider } from "@/components/theme/ThemeProvider";

export default function ModernChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}