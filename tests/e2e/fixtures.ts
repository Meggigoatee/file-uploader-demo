import { test as base } from '@playwright/test';

// API assertions must use the same cookie jar as the browser being exercised.
export const test = base.extend({ request: async ({ context }, use) => { await use(context.request); } });
export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

// Keep screenshots from a final audit separate from the historical TDD evidence.
export const verificationPath = (name: string) => '.docs/verification/' + (process.env.UPLOADER_VERIFICATION_PREFIX ? process.env.UPLOADER_VERIFICATION_PREFIX + '-' : '') + name;
