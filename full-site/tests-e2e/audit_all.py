import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import asyncio, json, sys
from playwright.async_api import async_playwright

URL = os.environ.get("FRONTEND_URL", "file://" + ROOT + "/frontend/index.html")
WIDTHS = [320, 360, 375, 390, 412, 480, 600, 768, 820, 1024, 1280]
ROUTES = ["home", "cat/skin", "cat/device", "product/p1", "product/p6", "cart", "checkout", "account", "admin", "blog", "article/a1", "compare", "design", "search/کرم", "brand/b1"]

SETUP = """() => {
  S.user = {name:'تست', mail:'', demo:true};
  S.admin = 'super';
  S.compare = ['p1','p2'];
  try { addToCart('p1',2); addToCart('p7',1); } catch(e){}
  save();
}"""

MEASURE = """() => {
  const de = document.documentElement, vw = de.clientWidth;
  const bad = [];
  function inClipper(el){ let p = el.parentElement; while(p && p!==de){ const o=getComputedStyle(p); if(['hidden','clip','auto','scroll'].includes(o.overflowX)) return true; p=p.parentElement;} return false; }
  function inFixedOrHidden(el){ let p=el; while(p && p!==de){ const cs=getComputedStyle(p); if(cs.position==='fixed') return true; if(cs.visibility==='hidden'||cs.display==='none') return true; p=p.parentElement;} return false; }
  document.querySelectorAll('#app *, #foot *, header.site *, .topbar *').forEach(el=>{
    const r = el.getBoundingClientRect(); if(!r.width||!r.height) return;
    if(inClipper(el)||inFixedOrHidden(el)) return;
    const ext = Math.max(r.right - vw, 0 - r.left);
    if(ext>1) bad.push({tag:el.tagName.toLowerCase(), cls:String(el.className&&el.className.baseVal===undefined?el.className:'').slice(0,40), w:Math.round(r.width), ext:Math.round(ext)});
  });
  bad.sort((a,b)=>b.ext-a.ext);
  const mob = document.getElementById('mobnav'); const mr = mob ? mob.getBoundingClientRect() : null;
  return { vw, scrollWidth: de.scrollWidth, innerWidth: window.innerWidth, bad: bad.slice(0,4), badCount: bad.length,
           mobnavW: mr ? Math.round(mr.width) : null, mobnavDisplay: mob ? getComputedStyle(mob).display : null };
}"""

async def main():
    problems = 0; checked = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get("CHROMIUM_EXECUTABLE_PATH"))
        for mobile in (True, False):
            for w in WIDTHS:
                if not mobile and w < 600: continue
                ctx = await b.new_context(viewport={"width": w, "height": 800}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
                page = await ctx.new_page()
                await page.goto(URL); await page.wait_for_timeout(500)
                await page.evaluate(SETUP)
                for route in ROUTES:
                    await page.evaluate(f"() => {{ location.hash = '#/{route}'; }}")
                    await page.wait_for_timeout(260)
                    m = await page.evaluate(MEASURE)
                    checked += 1
                    overflow = m["scrollWidth"] > m["vw"] + 1 or m["innerWidth"] > m["vw"] + 1
                    if overflow or m["badCount"] > 0:
                        problems += 1
                        print(f"✗ mobile={mobile} w={w:4d} /{route:12s} scrollW={m['scrollWidth']} innerW={m['innerWidth']} vw={m['vw']} bad={m['badCount']} {json.dumps(m['bad'], ensure_ascii=False)}")
                await ctx.close()
        await b.close()
    print(f"\nchecked {checked} page×width combinations, {problems} with overflow")

asyncio.run(main())
