"use client";

import { preconnect } from "react-dom";

// No crossOrigin: every Cloudinary request on the storefront is a plain
// <img>/<video> (no-cors, credentialed), and the browser keeps those on a
// separate connection pool from anonymous CORS ones — a crossOrigin preconnect
// warmed a socket the images could never use, so the LCP image still paid for
// its own TCP + TLS handshake. images.unsplash.com is gone too: no storefront
// page loads anything from it (it only appears in the dashboard's promo-banner
// defaults), so that preconnect was a wasted handshake on every page view.
//
// ReactDOM.preconnect rather than a <link> element: React writes resource
// hints at the top of <head>, while a rendered <link> landed at its end,
// after some thirty script tags.
export default function PreconnectLinks() {
  preconnect("https://res.cloudinary.com");
  return null;
}
