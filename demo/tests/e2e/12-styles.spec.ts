import { expect, type Page, test } from '@playwright/test'

import { gotoAdmin, login } from './helpers'

// Payload's server components import their own CSS. The production build only
// links that CSS if the RSC plugin wraps each component, so check the rules.
const hasRule = (page: Page, selector: string) =>
  page.evaluate(
    (prefix) =>
      [...document.styleSheets].some((sheet) => {
        // Payload puts its rules in `@layer` blocks, so look inside grouping rules too.
        const matches = (rules: CSSRuleList): boolean =>
          [...rules].some(
            (rule) =>
              (rule as CSSStyleRule).selectorText?.startsWith(prefix) ||
              ('cssRules' in rule && matches((rule as CSSGroupingRule).cssRules)),
          )
        try {
          return matches(sheet.cssRules)
        } catch {
          return false
        }
      }),
    selector,
  )

test('the login page loads the minimal template styles', async ({ page }) => {
  await gotoAdmin(page, '/admin/login')
  // The admin view mounts after the hydration signal. Its stylesheet comes with it.
  await expect(page.locator('.template-minimal__wrap')).toBeVisible()
  expect(await hasRule(page, '.template-minimal')).toBe(true)
  const wrap = await page.locator('.template-minimal__wrap').boundingBox()
  expect(wrap?.width).toBeLessThan(600)
})

test('admin views load the default template and nav styles', async ({ page }) => {
  await login(page)
  await gotoAdmin(page, '/admin')
  await expect(page.locator('.dashboard')).toBeVisible()
  expect(await hasRule(page, '.template-default')).toBe(true)
  expect(await hasRule(page, '.nav')).toBe(true)
})
