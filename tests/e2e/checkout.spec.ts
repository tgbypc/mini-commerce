import { test, expect } from '@playwright/test'

test.describe('Checkout flow', () => {
  test('guest user is redirected to login during checkout', async (
    { page, request },
    testInfo
  ) => {
    const health = await request.get('/')
    if (!health.ok()) {
      const base =
        (testInfo.project.use as { baseURL?: string } | undefined)?.baseURL ??
        'baseURL'
      testInfo.skip(true, `App is not running at ${base}.`)
      return
    }

    await page.route('/api/products?*', async (route) => {
      const url = new URL(route.request().url())
      if (!url.searchParams.get('cursor')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'prod-1',
                title: 'Nordic Chair',
                description: 'Comfortable chair',
                price: 199,
                category: 'furniture',
                thumbnail: '/placeholder.png',
              },
            ],
            nextCursor: null,
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], nextCursor: null }),
        })
      }
    })

    await page.route('**/api/checkout', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      })
    })

    await page.route('**/api/user/cart', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              productId: 'prod-1',
              title: 'Nordic Chair',
              price: 199,
              thumbnail: '/placeholder.png',
              qty: 1,
            },
          ],
        }),
      })
    })

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'mini-cart-v1',
        JSON.stringify({
          items: [
            {
              productId: 'prod-1',
              title: 'Nordic Chair',
              price: 199,
              thumbnail: '/placeholder.png',
              qty: 1,
            },
          ],
        })
      )
    })

    await page.goto('/cart')
    const checkoutButton = page.getByRole('button', { name: /checkout/i })
    await checkoutButton.waitFor({ state: 'visible' })
    await checkoutButton.click()

    await expect(page).toHaveURL(/user\/login/)
  })
})
