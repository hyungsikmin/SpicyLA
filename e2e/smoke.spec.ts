import { test, expect } from '@playwright/test'

test.describe('Smoke: public pages load', () => {
  test('home page loads', async ({ page }) => {
    const res = await page.goto('/')
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('a[href*="login"]').or(page.getByText(/로그인/))).toBeVisible({ timeout: 15000 })
  })

  test('login page loads', async ({ page }) => {
    const res = await page.goto('/login')
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
  })

  test('support page loads', async ({ page }) => {
    const res = await page.goto('/support')
    expect(res?.status()).toBe(200)
    await expect(page.locator('body')).toBeVisible()
  })

  test('post detail with non-existent id shows not-found message', async ({ page }) => {
    const res = await page.goto('/p/00000000-0000-0000-0000-000000000000')
    expect(res?.status()).toBe(200)
    await expect(page.getByText(/글을 찾을 수 없어/)).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Smoke: auth-required pages redirect when unauthenticated', () => {
  test('/profile redirects to login', async ({ page }) => {
    const res = await page.goto('/profile', { waitUntil: 'commit' })
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('/write redirects to login', async ({ page }) => {
    await page.goto('/write', { waitUntil: 'commit' })
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('/notifications redirects to login', async ({ page }) => {
    await page.goto('/notifications', { waitUntil: 'commit' })
    await page.waitForURL(/\/login/, { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('/admin redirects when not admin', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'commit' })
    await page.waitForURL((u) => {
      const path = new URL(u).pathname
      return path === '/login' || path === '/'
    }, { timeout: 15000 })
    const pathname = new URL(page.url()).pathname
    expect(pathname === '/login' || pathname === '/').toBe(true)
  })
})
