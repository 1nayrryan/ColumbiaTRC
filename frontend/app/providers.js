"use client";

import { Auth0Provider } from "@auth0/auth0-react";

export default function AuthProvider({ children }) {
  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname.startsWith("/admin") ? "/admin" : ""}`
      : undefined;
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
      }}
    >
      {children}
    </Auth0Provider>
  );
}
