import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Defaults are fine: proxies use their own caching, and ISR is not used.
// Add an R2/KV incremental cache here if data-cache persistence is wanted.
export default defineCloudflareConfig();
