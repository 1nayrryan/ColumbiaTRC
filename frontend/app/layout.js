import "./globals.css";
import AuthProvider from "./providers";

export const metadata = {
  title: "ColumbiaTRC Records",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
