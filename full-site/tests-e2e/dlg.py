import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import asyncio
from playwright.async_api import async_playwright
URL=os.environ.get("FRONTEND_URL", "file://" + ROOT + "/frontend/index.html")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("CHROMIUM_EXECUTABLE_PATH")); page=await (await b.new_context(viewport={"width":1280,"height":900})).new_page()
        errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
        await page.goto(URL); await page.wait_for_timeout(800)
        await page.evaluate("()=>{S.user={name:'تست',mail:'',demo:true};save();acc.tab='lists';location.hash='#/account';render()}"); await page.wait_for_timeout(500)
        await page.click("[data-newlist]"); await page.wait_for_timeout(300)
        print("dialog open:", await page.locator(".dialog").count())
        await page.fill("#lname2","فهرست تست"); 
        await page.click("#lname2"); await page.wait_for_timeout(200)
        print("dialog still open after clicking INSIDE it:", await page.locator(".dialog").count())
        await page.click("#savelist"); await page.wait_for_timeout(500)
        print("list saved in demo mode (S.lists):", await page.evaluate("()=>S.lists.map(l=>l.name)"))
        print("errors:", errs)
        await b.close()
asyncio.run(main())
