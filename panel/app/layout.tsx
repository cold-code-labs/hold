export const metadata = {
  title: "Hold",
  description: "Hold — multi-tenant Postgres BaaS control panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 720,
          margin: "40px auto",
          padding: "0 16px",
          color: "#111",
        }}
      >
        {children}
      </body>
    </html>
  );
}
