import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import asyncio
from playwright.async_api import async_playwright
URL = os.environ.get("FRONTEND_URL", "file://" + ROOT + "/frontend/index.html")
results = []
def ok(name, cond, extra=""):
    results.append(cond); print(("✓ " if cond else "✗ ") + name + (f"  [{extra}]" if extra and not cond else ""))

async def run(b, mobile, w):
    ctx = await b.new_context(viewport={"width":w,"height":844}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    page = await ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    await page.goto(URL); await page.wait_for_timeout(900)
    tag = f"[{'phone' if mobile else 'desktop'} {w}px]"

    # hero carousel: next / prev / dots
    t0 = await page.inner_text(".hero-panel h1")
    await (page.tap if mobile else page.click)(".hero-arrow.next"); await page.wait_for_timeout(400)
    t1 = await page.inner_text(".hero-panel h1")
    ok(f"{tag} hero NEXT arrow changes slide", t0 != t1)
    await (page.tap if mobile else page.click)(".hero-arrow.prev"); await page.wait_for_timeout(400)
    ok(f"{tag} hero PREV arrow returns to first slide", (await page.inner_text(".hero-panel h1")) == t0)
    await (page.tap if mobile else page.click)("[data-herodot='2']"); await page.wait_for_timeout(400)
    ok(f"{tag} hero indicator dot jumps to slide 3", (await page.inner_text(".hero-panel h1")) != t0)

    # mega menu: open, pick a category, menu closes + navigates
    if mobile: await page.tap("#megatrigger")
    else: await page.hover("#megatrigger")
    await page.wait_for_timeout(500)
    vis = await page.evaluate("() => getComputedStyle(document.querySelector('.mega-panel')).visibility")
    ok(f"{tag} mega menu opens", vis == "visible")
    await (page.tap if mobile else page.click)(".mega-grid a[data-id='supp']"); await page.wait_for_timeout(700)
    ok(f"{tag} picking a category navigates", "#/cat/supp" in page.url)
    if not mobile: await page.mouse.move(5, 500); await page.wait_for_timeout(400)
    vis2 = await page.evaluate("() => getComputedStyle(document.querySelector('.mega-panel')).visibility")
    ok(f"{tag} mega menu closes after navigating", vis2 == "hidden")

    # theme toggle
    await (page.tap if mobile else page.click)("#btn-theme"); await page.wait_for_timeout(300)
    ok(f"{tag} theme toggle → dark", (await page.evaluate("() => document.documentElement.getAttribute('data-theme')")) == "dark")
    await (page.tap if mobile else page.click)("#btn-theme"); await page.wait_for_timeout(200)

    # product → add to cart → cart
    await page.evaluate("() => { location.hash = '#/product/p4'; }"); await page.wait_for_timeout(700)
    await (page.tap if mobile else page.click)(".pdp [data-add]"); await page.wait_for_timeout(500)
    cnt = await page.evaluate("() => cartCount()")
    ok(f"{tag} add-to-cart from product page", cnt >= 1)
    await page.evaluate("() => { location.hash = '#/cart'; }"); await page.wait_for_timeout(600)
    ok(f"{tag} cart renders line items", await page.locator(".line-item").count() >= 1)
    await (page.tap if mobile else page.click)("#tocheckout"); await page.wait_for_timeout(600)
    ok(f"{tag} cart → checkout step 1", await page.locator("#cname").count() == 1)
    await page.fill("#cname", "مریم رضایی"); await page.fill("#cphone", "09123456789")
    await (page.tap if mobile else page.click)("#cbnext"); await page.wait_for_timeout(500)
    ok(f"{tag} checkout advances to address step", await page.locator("#cline").count() == 1)

    ok(f"{tag} no JavaScript errors", not errs, "; ".join(errs)[:200])
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM_EXECUTABLE_PATH"))
        await run(b, True, 390)
        await run(b, True, 360)
        await run(b, False, 1280)
        await b.close()
    print(f"\n{sum(results)}/{len(results)} passed")
asyncio.run(main())
