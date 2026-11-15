// AI-assisted: written with Claude Code (Anthropic) and reviewed by the CHAKRA X team.
import {expect,test} from '@playwright/test'

test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('chakra-bio-guided-v3','hide'))})

test('dark is the default theme',async({page})=>{
 await page.goto('/?lang=en')
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
})

test('?theme=light enables the projector theme and the toggle choice is remembered',async({page})=>{
 await page.goto('/?lang=en&theme=light')
 await expect(page.locator('html')).toHaveAttribute('data-theme','light')
 await page.getByRole('button',{name:'Switch to dark mode'}).click()
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.goto('/?lang=en')
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
 await page.getByRole('button',{name:'Switch to light mode'}).click()
 await page.goto('/?lang=en')
 await expect(page.locator('html')).toHaveAttribute('data-theme','light')
})
