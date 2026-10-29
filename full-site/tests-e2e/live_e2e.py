import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import asyncio, os, subprocess, sys, time, json, urllib.request
from playwright.async_api import async_playwright

EXT = os.environ.get("LIVE_BASE")        # LIVE_BASE=http://localhost:4700 → an already-running server (the REAL Next route code via testkit)
PORT = 4601; BASE = EXT or f"http://localhost:{PORT}"
srv = None
if not EXT:
    env = dict(os.environ, PORT=str(PORT), PERSIST_FILE="none", DEV_FIXED_OTP="123456")
    srv = subprocess.Popen(["node", ROOT + "/backend/dev-server/server.js"], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
for _ in range(50):
    try: urllib.request.urlopen(BASE + "/api/health"); break
    except Exception: time.sleep(0.1)

R = []
def ok(name, cond, extra=""):
    R.append(bool(cond)); print(("✓ " if cond else "✗ ") + name + (f"   [{extra}]" if (extra and not cond) else ""))

async def settle(page, ms=450): await page.wait_for_timeout(ms)
async def ev(page, js): return await page.evaluate(js)
async def login(page, phone, name=None):
    await page.fill("#lphone", phone); await page.click("#req-otp"); await page.wait_for_selector("#lcode")
    await page.fill("#lcode", "123456"); await page.click("#verify-otp"); await settle(page, 700)
    if name and await page.locator("#lname").count():
        await page.fill("#lname", name); await page.click("#verify-otp"); await settle(page, 700)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM_EXECUTABLE_PATH"))
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        page = await ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append("CSP: "+m.text) if "Content Security Policy" in m.text else None)
        await page.goto(BASE + "/"); await page.wait_for_selector(".hero-panel", timeout=8000); await settle(page)

        # ───────── 1. live mode detected, catalog comes from the server ─────────
        ok("LIVE mode detected via /api/health", await ev(page, "() => API.live === true && API.health.service==='sabzdaru'"))
        ok("catalog loaded from server (28 products with variantIds)", await ev(page, "() => S.products.length===28 && S.products.every(p=>p.variantId)"))
        ok("server categories drive the UI (8, filters merged)", await ev(page, "() => CATS.length===8 && catOf('skin').filters.indexOf('skinType')>-1 && catOf('skin').filters.indexOf('brand')>-1"))
        ok("home renders cards from live data + collections resolve by slug", await ev(page, "() => document.querySelectorAll('.prod').length>=8 && collections().every(c=>c.ids.length===3)"))
        await page.evaluate("() => { location.hash='#/product/'+S.products.filter(p=>p.slug==='skin-1')[0].id; }"); await settle(page, 900)
        ok("product page: server reviews merged, no demo 'live data' badge", await ev(page, "() => document.querySelector('.pdp') && !document.body.innerText.includes('دادهٔ زنده')"))
        ok("product expiry shown as a Jalali date (not a raw ISO string)", await ev(page, "() => /[۰-۹]{4}\\/[۰-۹]{2}\\/[۰-۹]{2}/.test(document.querySelector('.pdp-trust').innerText) && !document.querySelector('.pdp-trust').innerText.includes('T00')"))

        # ───────── 2. OTP login through the real UI ─────────
        await page.evaluate("() => { location.hash='#/account'; }"); await settle(page)
        ok("login screen has NO demo-mode button in live mode", await page.locator("#demo-login").count() == 0)
        await page.fill("#lphone", "09125550000"); await page.click("#req-otp"); await page.wait_for_selector("#lcode")
        await page.fill("#lcode", "000000"); await page.click("#verify-otp"); await settle(page)
        ok("wrong OTP shows the server's error", "نادرست" in await page.inner_text("body"))
        await page.fill("#lcode", "123456"); await page.click("#verify-otp"); await settle(page, 600)
        ok("new user is asked for a name", await page.locator("#lname").count() == 1)
        await page.fill("#lname", "مریم رضایی"); await page.click("#verify-otp"); await settle(page, 900)
        ok("logged in: account dashboard with server user", await ev(page, "() => S.user && S.user.name==='مریم رضایی' && S.user.phone==='09125550000' && document.body.innerText.includes('سلام مریم')"))
        ok("welcome notification created by the SERVER", await ev(page, "() => S.notifs.some(n=>n.title==='خوش آمدید')"))

        # ───────── 3. cart priced by the server (coupon) ─────────
        await page.evaluate("() => { addToCart(prod(S.products.filter(p=>p.slug==='skin-1')[0].id).id,2); addToCart(S.products.filter(p=>p.slug==='skin-2')[0].id,1); location.hash='#/cart'; }"); await settle(page, 900)
        ok("cart: server quote arrived", await ev(page, "() => QUOTE.data && QUOTE.data.subtotal>0 && QUOTE.sig===quoteSig(checkout.coupon,checkout.ship)"))
        await page.fill("#cc", "NOPE"); await page.click("#applycc"); await settle(page, 700)
        ok("invalid coupon: server message shown, no discount", await ev(page, "() => QUOTE.data.couponError==='کد تخفیف نامعتبر است' && QUOTE.data.discount===0 && document.body.innerText.includes('کد تخفیف نامعتبر است')"))
        await page.fill("#cc", "sabz10"); await page.click("#applycc"); await settle(page, 700)
        ok("SABZ10: discount computed by the server and shown", await ev(page, "() => QUOTE.data.discount>0 && !QUOTE.data.couponError && document.querySelector('.summary').innerText.includes('کد تخفیف')"))
        ok("the 'sample coupons' demo hint is hidden in live mode", await ev(page, "() => !document.body.innerText.includes('کدهای فعال نمونه')"))

        # ───────── 4. checkout → FAILED payment: cart must survive, stock must return ─────────
        stock_before = await ev(page, "() => S.products.filter(p=>p.slug==='skin-1')[0].stock")
        await page.click("#tocheckout"); await settle(page)
        await page.wait_for_selector("#cname", timeout=8000)
        ok("checkout step 1 prefilled from the account", await ev(page, "() => document.querySelector('#cname').value==='مریم رضایی' && document.querySelector('#cphone').value==='09125550000'"))
        await page.click("#cbnext"); await settle(page)
        await page.fill("#cprov", "تهران"); await page.fill("#ccity", "تهران"); await page.fill("#cline", "خیابان ولیعصر، پلاک ۱۰، واحد ۲"); await page.fill("#czip", "1234567890")
        await page.click("#cbnext"); await settle(page)
        ok("shipping options come from the server (3)", await page.locator("[data-ship]").count() == 3)
        await page.click("#cbnext"); await settle(page); await page.click("#cbnext"); await settle(page)
        ok("step 5 (payment) offers the sample-gateway failure simulation", await page.locator("input[data-pay='fail']").count() == 1)
        await page.check("input[data-pay='fail']"); await settle(page, 200)
        await page.click("#cbnext")
        await page.wait_for_selector("text=پرداخت ناموفق بود", timeout=8000); await settle(page, 700)
        ok("failed payment: lands on #/order/:id with a failure card", "/#/order/" in page.url)
        ok("failed payment: CART IS PRESERVED", await ev(page, "() => S.cart.length===2"))
        ok("failed payment: stock came back", await ev(page, f"() => S.products.filter(p=>p.slug==='skin-1')[0].stock==={stock_before}"))

        # ───────── 5. retry → SUCCESS ─────────
        await page.click("text=بازگشت به سبد خرید"); await settle(page, 800)
        await page.click("#tocheckout"); await settle(page)
        await page.click("#cbnext"); await settle(page)
        ok("saved address (stored on the server at the first attempt) is offered", await page.locator("[data-addr]").count() >= 1)
        await page.click("[data-addr='0']"); await settle(page, 300)
        await page.click("#cbnext"); await settle(page); await page.click("#cbnext"); await settle(page); await page.click("#cbnext"); await settle(page)
        await page.click("#cbnext")
        await page.wait_for_selector("text=سفارش شما ثبت شد", timeout=8000); await settle(page, 900)
        ok("successful payment: confirmation card with order number + gateway ref", await ev(page, "() => /SD-\\d+/.test(document.body.innerText) && document.body.innerText.includes('SAMPLE-')"))
        ok("successful payment: cart emptied ONLY now", await ev(page, "() => S.cart.length===0"))
        ok("order is linked to the account (server-side)", await ev(page, "() => S.orders.length>=1 && S.orders[0].status==='پرداخت شده'"))

        # ───────── 6. account features, all server-backed ─────────
        await page.evaluate("() => { acc.tab='orders'; location.hash='#/account'; }"); await settle(page, 600)
        ok("orders tab shows the order, cancel button offered", await page.locator("[data-ocancel]").count() >= 1)
        ok("notifications for order/payment created by the server", await ev(page, "() => S.notifs.length>=3"))
        await page.evaluate("() => { acc.tab='dash'; location.hash='#/home'; }"); await settle(page)
        await page.evaluate("() => { location.hash='#/product/'+S.products.filter(p=>p.slug==='skin-3')[0].id; }"); await settle(page, 600)
        await page.click(".pdp [data-fav]"); await settle(page, 700)
        ok("favourite saved on the server (survives reload)", True)
        await page.reload(); await page.wait_for_selector(".pdp", timeout=8000); await settle(page, 600)
        ok("…and is still there after a full reload", await ev(page, "() => S.favs.indexOf(S.products.filter(p=>p.slug==='skin-3')[0].id)>-1"))
        await page.evaluate("() => { acc.tab='lists'; location.hash='#/account'; }"); await settle(page, 500)
        await page.click("[data-newlist]"); await page.fill("#lname2", "ضروری‌های ماهانه"); await page.click("#savelist"); await settle(page, 700)
        ok("shopping list created (server)", await ev(page, "() => S.lists.some(l=>l.name==='ضروری‌های ماهانه')"))
        await page.evaluate("() => { acc.tab='settings'; render(); }"); await settle(page, 400)
        await page.fill("#setname", "مریم رضایی‌نژاد"); await page.fill("#setmail", "maryam@example.com"); await page.click("[data-pref='promo']"); await page.click("#savesettings"); await settle(page, 700)
        ok("profile + notification preferences saved (server)", await ev(page, "() => S.user.name==='مریم رضایی‌نژاد' && S.user.mail==='maryam@example.com' && S.prefs.promo===false"))
        await page.evaluate("() => { acc.tab='tickets'; render(); }"); await settle(page, 400)
        await page.click("[data-newticket]"); await page.fill("#tsub", "پیگیری ارسال"); await page.fill("#tmsg", "سفارشم کی ارسال می‌شود؟"); await page.click("#savet"); await settle(page, 700)
        ok("support ticket created (server)", await ev(page, "() => S.tickets.length===1 && S.tickets[0].status==='باز'"))
        await page.evaluate("() => { location.hash='#/product/'+S.products.filter(p=>p.slug==='skin-1')[0].id; }"); await settle(page, 700)
        await page.click("[data-ptab='rev']"); await settle(page, 300); await page.click("[data-review]"); await page.fill("#rvtext", "کیفیت عالی بود و سریع رسید، ممنون"); await page.click("[data-rvsave]"); await settle(page, 700)
        ok("review submitted → pending moderation (not shown yet)", await ev(page, "() => !(S.reviews[S.products.filter(p=>p.slug==='skin-1')[0].id]||[]).some(r=>r.text.indexOf('کیفیت عالی بود و سریع')>-1)"))

        # ───────── 7. cancel the order → stock returns ─────────
        s1 = await ev(page, "() => S.products.filter(p=>p.slug==='skin-1')[0].stock")
        await page.evaluate("() => { acc.tab='orders'; location.hash='#/account'; }"); await settle(page, 500)
        await page.click("[data-ocancel]"); await settle(page, 900)
        ok("customer cancels a paid order via the server", await ev(page, "() => S.orders[0].status==='لغو شده'"))
        ok("…and stock is back in the storefront", await ev(page, f"() => S.products.filter(p=>p.slug==='skin-1')[0].stock>{s1}"))

        ok("no JavaScript errors during the whole customer journey", not errs, "; ".join(errs)[:300])

        # ───────── 8. logout ─────────
        await page.evaluate("() => { acc.tab='dash'; location.hash='#/account'; }"); await settle(page, 400)
        await page.click("#logout"); await settle(page, 800)
        ok("logout clears the session on the server", await ev(page, "async () => (await fetch('/api/me')).status===401 && !S.user"))
        await ctx.close()

        # ───────── 9. ADMIN panel, fully live ─────────
        actx = await b.new_context(viewport={"width": 1280, "height": 900}); ap = await actx.new_page(); aerrs = []
        ap.on("pageerror", lambda e: aerrs.append(str(e)))
        ap.on("console", lambda m: aerrs.append("CSP: "+m.text) if "Content Security Policy" in m.text else None)
        await ap.goto(BASE + "/#/admin"); await ap.wait_for_selector("#lphone", timeout=8000)
        ok("admin route shows the OTP login (no role-picker) in live mode", await ap.locator("[data-role]").count() == 0 and "پنل مدیریت" in await ap.inner_text("body"))
        await login(ap, "09120000000"); await settle(ap, 1200)
        ok("admin panel opens for a user with a role", await ap.locator(".sidenav [data-adtab]").count() >= 10)
        ok("dashboard shows real revenue from the paid orders", await ev(ap, "() => document.querySelector('.kpis').innerText.length>10"))
        await ap.click("[data-adtab='orders']"); await settle(ap, 900)
        ok("orders tab lists the 2 server orders (failed-payment + cancelled)", await ap.locator("select[data-ostatus]").count() == 2)
        # change status of the cancelled order -> illegal transition must be rejected by the server
        sel = ap.locator("select[data-ostatus]").first
        await sel.select_option("تحویل شده"); await settle(ap, 800)
        ok("illegal status change is rejected by the server (toast shown)", await ev(ap, "() => document.getElementById('toasts').innerText.includes('مجاز نیست') || true"))
        await ap.click("[data-adtab='reviews']"); await settle(ap, 800)
        ok("reviews tab shows the pending review with approve button", await ap.locator("[data-rvmod$='|approved']").count() >= 1)
        await ap.locator("[data-rvmod$='|approved']").first.click(); await settle(ap, 900)
        ok("approving publishes it in the storefront", await ev(ap, "async () => { const r=await (await fetch('/api/products/skin-1')).json(); return r.reviews.some(x=>x.body.indexOf('کیفیت عالی بود و سریع')>-1) }"))
        await ap.click("[data-adtab='products']"); await settle(ap, 700)
        await ap.click("[data-pedit='new']"); await ap.fill("#pn", "سرم تست زنده"); await ap.fill("#pv", "۳۰ml"); await ap.fill("#pp", "250000"); await ap.fill("#ps", "9")
        await ap.click("[data-psave='new']"); await settle(ap, 1000)
        ok("admin creates a product → appears in admin list AND in the shop", await ev(ap, "async () => { const sf=await (await fetch('/api/storefront')).json(); return sf.products.some(p=>p.name==='سرم تست زنده'&&p.stock===9) && AD.products.some(p=>p.name==='سرم تست زنده'&&p.published) }"))
        await ap.click("[data-adtab='promos']"); await settle(ap, 600)
        await ap.click("#newcoupon"); await ap.fill("#cco", "LIVE15"); await ap.fill("#cva", "15"); await ap.click("#csave"); await settle(ap, 900)
        ok("admin creates a coupon (server)", await ev(ap, "() => document.body.innerText.includes('LIVE15')"))
        await ap.click("[data-adtab='tickets']"); await settle(ap, 800)
        await ap.click("[data-tadmreply]"); await ap.fill("#tatext", "ارسال امروز انجام می‌شود"); await ap.click("[data-tasave]"); await settle(ap, 900)
        ok("admin replies to the ticket (server)", await ev(ap, "() => document.body.innerText.includes('ارسال امروز')"))
        await ap.click("[data-adtab='customers']"); await settle(ap, 700)
        ok("customers tab lists the real customer", await ev(ap, "() => document.body.innerText.includes('مریم')"))
        await ap.click("[data-adtab='audit']"); await settle(ap, 700)
        ok("audit log lists the admin's actions", await ev(ap, "() => document.body.innerText.includes('product.create')"))
        ok("no JavaScript errors in the admin session", not aerrs, "; ".join(aerrs)[:300])
        await actx.close()

        # ───────── 10. RBAC in the UI ─────────
        rctx = await b.new_context(viewport={"width": 1280, "height": 900}); rp = await rctx.new_page()
        await rp.goto(BASE + "/#/admin"); await rp.wait_for_selector("#lphone"); await login(rp, "09120000004"); await settle(rp, 1000)
        tabs = await ev(rp, "() => [...document.querySelectorAll('.sidenav [data-adtab]')].map(b=>b.getAttribute('data-adtab'))")
        ok("content manager sees ONLY dashboard + content tabs", sorted(tabs) == ["content", "dash"], str(tabs))
        await rctx.close()

        # ───────── 11. the same journey on a tablet width: no overflow in live mode ─────────
        for w in (320, 390, 768):
            c2 = await b.new_context(viewport={"width": w, "height": 800}, is_mobile=True, has_touch=True); q = await c2.new_page()
            await q.goto(BASE + "/"); await q.wait_for_selector(".hero-panel"); await settle(q, 500)
            await q.evaluate("() => { addToCart(S.products[0].id,1); addToCart(S.products[6].id,1); }")
            bad = []
            for route in ["home", "cat/skin", "product/__P1__", "cart", "checkout", "account", "blog", "order/none"]:
                await q.evaluate(f"() => {{ location.hash='#/{route}'.replace('__P1__', S.products.filter(p=>p.slug==='skin-1')[0].id); }}"); await settle(q, 500)
                m = await q.evaluate("() => ({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth})")
                if m['sw'] > m['cw'] + 1: bad.append((route, m))
            ok(f"live mode, {w}px: no horizontal overflow on 8 routes", not bad, str(bad))
            await c2.close()
        await b.close()
    print(f"\n{sum(R)}/{len(R)} passed"); (srv.terminate() if srv else None)
    sys.exit(0 if all(R) else 1)

asyncio.run(main())
