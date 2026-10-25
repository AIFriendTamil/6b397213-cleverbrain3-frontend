import React from 'react';
import '../styles/globals.css';

export const metadata = {
  title: 'Portal Platform',
  description: 'Foundation and User Portal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
