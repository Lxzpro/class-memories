"use client";

import Script from "next/script";

const LA_SITE_ID = "3R1LbptvXl7KHT9h";

type LaAnalyticsConfig = {
  id: string;
  ck: string;
  hashMode: boolean;
};

declare global {
  interface Window {
    LA?: {
      init?: (config: LaAnalyticsConfig) => void;
    };
    __classMemoriesLaInitialized?: boolean;
  }
}

function initializeLaAnalytics() {
  if (window.__classMemoriesLaInitialized || !window.LA?.init) {
    return;
  }

  window.LA.init({
    id: LA_SITE_ID,
    ck: LA_SITE_ID,
    hashMode: true,
  });
  window.__classMemoriesLaInitialized = true;
}

export function LaAnalytics() {
  return (
    <Script
      id="LA_COLLECT"
      src="https://sdk.51.la/js-sdk-pro.min.js"
      strategy="lazyOnload"
      charSet="UTF-8"
      onReady={initializeLaAnalytics}
    />
  );
}
