import { test, expect } from '@playwright/test'

test.describe('Admin guard', () => {
  test('redirects unauthenticated users to login', async ({ page, request }, testInfo) => {
    const health = await request.get('/')
    if (!health.ok()) {
      const base =
        (testInfo.project.use as { baseURL?: string } | undefined)?.baseURL ??
        'baseURL'
      testInfo.skip(true, `App is not running at ${base}.`)
      return
    }

    await page.goto('/admin')

    await expect(page).toHaveURL(/user\/login/)
  })
})
