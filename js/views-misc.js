/* views: search/brand/blog/article/compare/design-system + chrome/render */

/* ═══ SECONDARY VIEWS ═══ */
function viewSearch(){
 var q=R.params.q||"",r=searchAll(q);
 var total=r.products.length+r.brands.length+r.cats.length+r.articles.length;
 var h='<div class="wrap section"><h1 class="t-h1" style="margin-bottom:8px">نتایج جست‌وجو</h1>'+
 '<p class="t-small" style="margin-bottom:24px">'+(q?"برای «"+esc(q)+"» · "+fa(total)+" نتیجه":"عبارتی وارد نشده")+'</p>';
 if(!q)return h+emptyState("i-search","چیزی جست‌وجو نکرده‌اید","نام کالا، برند یا دسته‌بندی را در نوار بالا بنویسید.","","")+'</div>';
 if(!total)return h+emptyState("i-search","نتیجه‌ای پیدا نشد","املا را بررسی کنید یا عبارت کوتاه‌تری بنویسید.","دیدن دسته‌بندی‌ها",'data-go="home"')+'</div>';
 if(r.cats.length||r.brands.length)h+='<div class="row" style="margin-bottom:24px">'+
  r.cats.map(function(c){return'<button class="chip" data-go="cat" data-id="'+c.id+'">'+icon(c.icon)+esc(c.name)+'</button>'}).join("")+
  r.brands.map(function(b){return'<button class="chip" data-go="brand" data-id="'+b.id+'">'+icon("i-tag")+esc(b.name)+'</button>'}).join("")+'</div>';
 if(r.products.length)h+='<h2 class="t-h3" style="margin-bottom:16px">کالاها</h2><div class="prod-grid">'+r.products.map(productCard).join("")+'</div>';
 if(r.articles.length)h+='<h2 class="t-h3" style="margin:32px 0 16px">مقاله‌ها</h2><div class="articles">'+r.articles.map(articleCard).join("")+'</div>';
 return h+'</div>'}
function viewBrand(){
 var b=null;BRANDS.forEach(function(x){if(x.id===R.params.id)b=x});b=b||BRANDS[0];
 var list=S.products.filter(function(p){return p.brand===b.id&&p.published});
 return'<div class="wrap">'+crumbs([{t:"خانه",go:"home"},{t:b.name}])+
 '<div class="card card-pad" style="margin-bottom:32px"><div class="row" style="gap:20px">'+
 '<span class="avatar-badge" style="width:64px;height:64px;border-radius:999px;display:grid;place-items:center;font-weight:800;font-size:24px">'+esc(b.name[0])+'</span>'+
 '<div style="flex:1;min-width:220px"><h1 class="t-h2">'+esc(b.name)+'</h1>'+
 '<p class="t-small measure" style="margin-top:6px">'+esc(b.desc)+'</p></div>'+
 '<span class="badge badge-neutral">'+fa(list.length)+' کالا</span></div></div>'+
 (list.length?'<div class="prod-grid" style="padding-bottom:64px">'+list.map(productCard).join("")+'</div>'
  :emptyState("i-box","کالایی از این برند منتشر نشده","بعداً دوباره سر بزنید.","دیدن همهٔ کالاها",'data-go="home"'))+'</div>'}
function viewBlog(){
 return'<div class="wrap section">'+crumbs([{t:"خانه",go:"home"},{t:"مجلهٔ سلامت"}])+
 '<h1 class="t-h1" style="margin-bottom:8px">مجلهٔ سلامت</h1>'+
 '<p class="t-small measure" style="margin-bottom:32px">مطالب آموزشی دربارهٔ استفاده و نگهداری محصولات. این متن‌ها نمونه‌اند؛ در نسخهٔ واقعی باید با ارجاع به منابع معتبر و بازبینی کارشناس منتشر شوند.</p>'+
 '<div class="articles">'+ARTICLES.map(articleCard).join("")+'</div></div>'}
function viewArticle(){
 var a=null;ARTICLES.forEach(function(x){if(x.id===R.params.id)a=x});a=a||ARTICLES[0];
 var rel=S.products.filter(function(p){return p.cat===a.tag&&p.published}).slice(0,4);
 return'<div class="wrap section" style="max-width:780px">'+crumbs([{t:"خانه",go:"home"},{t:"مجله",go:"blog"},{t:a.title}])+
 '<h1 class="t-h1">'+esc(a.title)+'</h1>'+
 '<p class="t-small" style="margin-block:8px 24px">'+esc(a.cat)+' · '+fa(a.read)+' دقیقه مطالعه · تیم محتوای سبزدارو</p>'+
 '<div class="card" style="aspect-ratio:16/7;background:linear-gradient(140deg,var(--green-soft),var(--cream-deep));margin-bottom:24px"></div>'+
 '<p>'+esc(a.body)+'</p>'+
 '<div class="card card-pad" style="margin-top:24px;background:var(--info-bg);border-color:rgba(47,100,120,.2)">'+
 '<p class="t-small" style="color:var(--info)">این مطلب جنبهٔ آموزشی دارد و جایگزین مشاورهٔ پزشکی نیست.</p></div>'+
 (rel.length?'<h2 class="t-h3" style="margin:40px 0 16px">محصولات مرتبط</h2><div class="prod-grid">'+rel.map(productCard).join("")+'</div>':"")+'</div>'}
function viewCompare(){
 var items=S.compare.map(prod).filter(Boolean);
 if(!items.length)return'<div class="wrap section">'+
  emptyState("i-scale","چیزی برای مقایسه انتخاب نشده","از صفحهٔ هر کالا دکمهٔ «مقایسه» را بزنید.","دیدن محصولات",'data-go="home"')+'</div>';
 var keys=[];items.forEach(function(p){Object.keys(p.attrs||{}).forEach(function(k){if(keys.indexOf(k)<0)keys.push(k)})});
 var rows=[["برند",function(p){return brandName(p.brand)}],["دسته",function(p){return catName(p.cat)}],
 ["بسته‌بندی",function(p){return p.variant}],["قیمت",function(p){return toman(eff(p))}],
 ["موجودی",function(p){return p.stock>0?fa(p.stock)+" عدد":"ناموجود"}],["امتیاز",function(p){return fa(p.rating)}]]
 .concat(keys.map(function(k){return[(FD[k]||{label:k}).label,function(p){return(p.attrs||{})[k]||"—"}]}));
 return'<div class="wrap section"><div class="between" style="margin-bottom:20px;flex-wrap:wrap"><h1 class="t-h1">مقایسهٔ محصولات</h1>'+
 '<button class="btn btn-quiet btn-sm" id="clearcmp">پاک کردن همه</button></div>'+
 '<div class="table-wrap"><table><thead><tr><th></th>'+items.map(function(p){
  return'<th style="min-width:180px"><b>'+esc(p.name)+'</b><br><button class="btn btn-ghost btn-xs" data-cmp="'+p.id+'">حذف</button></th>'}).join("")+
 '</tr></thead><tbody>'+rows.map(function(r){
  var vals=items.map(r[1]),uniq=[];vals.forEach(function(v){if(uniq.indexOf(v)<0)uniq.push(v)});
  var diff=uniq.length>1;
  return'<tr><td style="color:var(--ink-muted)">'+esc(r[0])+'</td>'+vals.map(function(v){
   return'<td'+(diff?' style="background:var(--warning-bg)"':"")+'>'+esc(v)+'</td>'}).join("")+'</tr>'}).join("")+
 '</tbody></table></div><p class="t-tiny" style="margin-top:12px">خانه‌های متفاوت با پس‌زمینهٔ روشن مشخص شده‌اند. این مقایسه فقط بر اساس مشخصات کاتالوگ است و توصیهٔ درمانی نیست.</p></div>'}
function viewDesign(){
 var solid=[["سبز اصلی","#1F8A4C","--green"],["سبز عمیق (فقط روی سطوح روشن)","#233C29","--green-deep"],
 ["جوهر اصلی متن (سازگار با تم تاریک)","var(--accent-ink)","--accent-ink"],
 ["برنزی — فقط قیمت و پیشنهاد","#A9843F","--brass"],
 ["موفق","#2E7D52","--success"],["هشدار","#B8801F","--warning"],["خطا","#A63A2E","--error"],["اطلاع","#2F6478","--info"]];
 var glass=[["پس‌زمینهٔ کارت","--surface"],["پس‌زمینهٔ ثانویه","--surface-2"],["خط و حاشیه","--line"],["سبز روشن (چیپ‌ها)","--green-soft"]];
 var h='<div class="wrap section"><h1 class="t-h1">سیستم طراحی</h1>'+
 '<p class="t-small measure" style="margin-top:8px">همهٔ صفحه‌های فروشگاه و پنل مدیریت از همین توکن‌ها ساخته می‌شوند. تم پایه سبز زیتونی شیشه‌ای است؛ با دکمهٔ ماه/خورشید در هدر بین حالت روشن و تاریک جابه‌جا شوید — همهٔ نمونه‌های زیر آن تغییر را زنده نشان می‌دهند.</p>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line);margin-top:32px"><h2 class="t-h2" style="margin-bottom:6px">رنگ‌های ثابت</h2>'+
 '<p class="t-small" style="margin-bottom:16px">این‌ها در هر دو تم همین مقدارند (به‌جز accent-ink که در تم تاریک روشن‌تر می‌شود).</p>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">'+solid.map(function(s){
  return'<div class="card" style="overflow:hidden"><div style="height:60px;background:'+s[1]+'"></div>'+
  '<div style="padding:10px 12px"><b style="font-size:12.5px;display:block">'+s[0]+'</b><span class="t-tiny">'+s[2]+'</span></div></div>'}).join("")+'</div></section>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:6px">سطوح شیشه‌ای</h2>'+
 '<p class="t-small" style="margin-bottom:16px">نیمه‌شفاف و بلوردار روی گرادیان پس‌زمینه؛ مقدار واقعی را روی خود صفحه (نه یک هگز ثابت) نشان می‌دهند.</p>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">'+glass.map(function(g){
  return'<div class="card" style="overflow:hidden"><div style="height:60px;background:var('+g[1]+');backdrop-filter:blur(14px)"></div>'+
  '<div style="padding:10px 12px"><b style="font-size:12.5px;display:block">'+g[0]+'</b><span class="t-tiny">'+g[1]+'</span></div></div>'}).join("")+'</div></section>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:16px">تایپوگرافی</h2>'+
 [["display","سلامت روزمره","t-display"],["h1","قفسهٔ محصولات","t-h1"],["h2","مجموعه‌های آماده","t-h2"],
  ["h3","کرم آبرسان صورت","t-h3"],["body","متن اصلی صفحه با ارتفاع خط ۱٫۸ برای خوانایی فارسی.",""],
  ["small","توضیح کوتاه و شرایط ارسال.","t-small"],["tiny","یادداشت و سلب مسئولیت.","t-tiny"]].map(function(t){
  return'<div style="display:flex;gap:24px;align-items:baseline;padding-block:12px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap">'+
  '<code class="t-tiny" style="width:70px">'+t[0]+'</code><span class="'+t[2]+'">'+t[1]+'</span></div>'}).join("")+'</section>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:8px">فاصله‌گذاری</h2>'+
 '<p class="t-small" style="margin-bottom:20px">مقیاس ۴ پیکسلی؛ همهٔ فاصله‌ها از این مقادیر انتخاب می‌شوند.</p><div class="row" style="align-items:flex-end;gap:16px">'+
 [4,8,12,16,24,32,48,64,96].map(function(v,i){return'<div style="display:grid;gap:6px;justify-items:center;font-size:12px;color:var(--ink-muted)">'+
  '<div style="width:'+v+'px;height:'+v+'px;background:var(--green-soft);border:1px solid rgba(46,107,79,.25);border-radius:3px"></div>s'+fa(i+1)+' · '+fa(v)+'</div>'}).join("")+'</div></section>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:8px">دکمه‌ها و شیشهٔ مایع</h2>'+
 '<p class="t-small measure" style="margin-bottom:20px">در نسخهٔ فعلی، شیشه روی همهٔ سطوح بزرگ (کارت، هدر، فیلتر، دیالوگ) به‌کار می‌رود، نه فقط دکمه‌ها — تفاوت اصلی بین سطوح در میزان شفافیت و بلور است، نه حضور/غیاب آن.</p>'+
 '<div class="row"><button class="btn btn-primary">افزودن به سبد</button><button class="btn btn-secondary">مقایسه</button>'+
 '<button class="btn btn-quiet">ادامهٔ خرید</button><button class="btn btn-ghost">انصراف</button>'+
 '<button class="btn btn-danger btn-sm">حذف</button><button class="btn btn-primary" disabled>ناموجود</button></div>'+
 '<div class="row" style="margin-top:16px"><button class="btn btn-primary btn-lg">تکمیل خرید</button>'+
 '<button class="btn btn-secondary btn-sm">افزودن سریع</button>'+
 '<button class="btn btn-secondary btn-icon btn-sm" aria-label="نمونه">'+icon("i-heart")+'</button></div>'+
 '<div style="margin-top:24px;padding:24px;border-radius:14px;background:linear-gradient(140deg,var(--green-deep),#10261E)">'+
 '<p style="color:var(--on-dark-2);font-size:13.5px;margin-bottom:12px">همان دکمه‌ها روی سطح تیره</p>'+
 '<div class="row"><button class="btn btn-primary">افزودن به سبد</button>'+
 '<button class="btn glass-dark" style="color:var(--on-dark)">جزئیات</button></div></div></section>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:20px">فرم و فیلتر</h2>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">'+
 '<div class="field"><label class="t-label">نام</label><input class="input" placeholder="مثلاً مریم رضایی"></div>'+
 '<div class="field"><label class="t-label">استان</label><select class="select"><option>تهران</option><option>اصفهان</option></select></div>'+
 '<div class="field"><label class="t-label">کد تخفیف</label><input class="input" value="SPRING24" aria-invalid="true">'+
 '<span class="hint hint-error">'+icon("i-alert")+'این کد منقضی شده است.</span></div></div>'+
 '<div class="row" style="margin-top:20px"><button class="chip" aria-pressed="true" data-demochip="1">پوست خشک</button>'+
 '<button class="chip" aria-pressed="true" data-demochip="1">بدون عطر</button>'+
 '<button class="chip" aria-pressed="false" data-demochip="1">SPF ۵۰</button></div></section>';
 h+='<section style="padding-block:40px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:20px">نشان، پیام و وضعیت</h2>'+
 '<div class="row"><span class="badge badge-success">موجود</span><span class="badge badge-warning">تنها ۲ عدد</span>'+
 '<span class="badge badge-error">ناموجود</span><span class="badge badge-info">ارسال رایگان</span>'+
 '<span class="badge badge-offer">۱۵٪ تخفیف</span><span class="badge badge-neutral">پیش‌نویس</span></div>'+
 '<div class="row" style="margin-top:16px"><div class="toast toast-success">'+icon("i-check")+' کالا به سبد اضافه شد</div>'+
 '<div class="toast toast-error">'+icon("i-alert")+' موجودی کافی نیست</div></div>'+
 '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-top:24px">'+
 skeletonCards(1)+emptyState("i-cart","سبد خرید خالی است","محصولی اضافه نکرده‌اید.","دیدن پرفروش‌ها",'data-go="home"')+'</div></section>';
 h+='<section style="padding-block:40px 64px;border-top:1px solid var(--line)"><h2 class="t-h2" style="margin-bottom:20px">کارت محصول</h2>'+
 '<div class="prod-grid">'+S.products.slice(0,4).map(productCard).join("")+'</div></section>';
 return h+'</div>'}

/* ═══ CHROME + RENDER ═══ */
function renderChrome(){
 var cd=document.getElementById("cartdot"),fd=document.getElementById("favdot"),md=document.getElementById("cmpdot");
 cd.textContent=fa(cartCount());cd.classList.toggle("hidden",!cartCount());
 fd.textContent=fa(S.favs.length);fd.classList.toggle("hidden",!S.favs.length);
 md.textContent=fa(S.compare.length);md.classList.toggle("hidden",!S.compare.length);
 document.getElementById("catnav").innerHTML=
  '<div class="mega'+(megaOpen?" open":"")+'" id="megacats"><button class="mega-trigger" id="megatrigger" aria-expanded="'+megaOpen+'">دسته‌بندی محصولات '+icon("i-down")+'</button>'+
  '<div class="mega-panel"><div class="mega-grid">'+CATS.map(function(c){
   return'<a data-go="cat" data-id="'+c.id+'"><i>'+icon(c.icon)+'</i><span><b>'+esc(c.name)+'</b><span>'+fa(S.products.filter(function(p){return p.cat===c.id}).length)+' کالا</span></span></a>'}).join("")+
  '</div></div></div>'+
  '<a data-go="blog" class="'+(R.view==="blog"?"on":"")+'">مجلهٔ سلامت</a>'+
  '<a data-go="brand" class="'+(R.view==="brand"?"on":"")+'">برندها</a>'+
  '<a data-go="compare" class="'+(R.view==="compare"?"on":"")+'">مقایسه</a>';
 document.getElementById("mobnav").innerHTML=[["home","i-home","خانه"],["cat","i-grid","دسته‌ها"],
  ["search","i-search","جست‌وجو"],["cart","i-cart","سبد"],["account","i-user","حساب"]].map(function(m){
  return'<button data-go="'+m[0]+'" aria-current="'+(R.view===m[0])+'">'+icon(m[1])+m[2]+
  (m[0]==="cart"&&cartCount()?'<span class="dot">'+fa(cartCount())+'</span>':"")+'</button>'}).join("");
 document.getElementById("foot").innerHTML='<div class="wrap"><div class="foot-grid"><div>'+
 '<a class="logo" data-go="home"><span class="mark">'+icon("i-leaf")+'</span>سبزدارو</a>'+
 '<p class="t-small measure" style="margin-top:16px">فروشگاه آنلاین محصولات بدون نسخهٔ داروخانه، مراقبت شخصی و تجهیزات سلامت خانگی. داروهای نسخه‌ای در این فروشگاه عرضه نمی‌شود.</p>'+
 '<p class="t-tiny" style="margin-top:12px">نسخهٔ نمایشی؛ همهٔ برندها، قیمت‌ها و نظرها ساختگی‌اند.</p></div>'+
 '<div><h4>خرید</h4><ul>'+CATS.slice(0,4).map(function(c){
  return'<li><a data-go="cat" data-id="'+c.id+'">'+esc(c.name)+'</a></li>'}).join("")+'</ul></div>'+
 '<div><h4>حساب من</h4><ul><li><a data-go="account" data-tab="orders">سفارش‌ها</a></li>'+
 '<li><a data-go="account" data-tab="favs">علاقه‌مندی‌ها</a></li>'+
 '<li><a data-go="account" data-tab="lists">فهرست‌های خرید</a></li>'+
 '<li><a data-go="account" data-tab="routines">روتین‌ها</a></li></ul></div>'+
 '<div><h4>پشتیبانی</h4><ul><li><a data-go="account" data-tab="tickets">تماس با ما</a></li>'+
 '<li><a data-go="blog">مجلهٔ سلامت</a></li><li><a data-go="admin">پنل مدیریت</a></li>'+
 '<li><a data-go="design">سیستم طراحی</a></li></ul></div></div>'+
 '<div class="foot-bottom"><span>© ۱۴۰۵ سبزدارو</span>'+
 '<span>اطلاعات محصولات جایگزین مشاورهٔ پزشکی نیست.</span></div></div>'}
function render(){
 var v=R.view,el=document.getElementById("app"),h="";
 try{
  h=v==="home"?viewHome():v==="cat"?viewCat():v==="product"?viewProduct():v==="cart"?viewCart():
    v==="checkout"?viewCheckout():v==="account"?viewAccount():v==="admin"?viewAdmin():
    v==="design"?viewDesign():v==="search"?viewSearch():v==="brand"?viewBrand():
    v==="blog"?viewBlog():v==="article"?viewArticle():v==="compare"?viewCompare():v==="order"?viewOrderResult():viewHome();
 }catch(e){
  h='<div class="wrap section">'+emptyState("i-alert","نمایش این صفحه ممکن نشد","خطایی رخ داد: "+e.message+" — به صفحهٔ اصلی بازگردید.","بازگشت به خانه",'data-go="home"')+'</div>';
 }
 el.innerHTML=h;renderChrome();
 var titles={home:"سبزدارو — داروخانه و سلامت",cart:"سبد خرید | سبزدارو",checkout:"تکمیل خرید | سبزدارو",
  account:"حساب کاربری | سبزدارو",admin:"پنل مدیریت | سبزدارو",design:"سیستم طراحی | سبزدارو",
  compare:"مقایسه | سبزدارو",blog:"مجلهٔ سلامت | سبزدارو"};
 document.title=titles[v]||"سبزدارو";
 // دادهٔ محلی همین الان روی صفحه نشان داده شده؛ این فقط یک تلاش پس‌زمینه برای
 // ارتقای بی‌صدا به دادهٔ زندهٔ API است — هر محصول فقط یک‌بار در این نشست امتحان می‌شود
 if(v==="product"&&R.params.id&&!triedLive[R.params.id]){triedLive[R.params.id]=true;loadProductLive(R.params.id)}
 // page-change animation: #app persists across renders, so retrigger its
 // CSS animation by toggling the class off → force reflow → on
 el.classList.remove("page-anim");void el.offsetWidth;el.classList.add("page-anim");
 if(v==="home")setupReveal();
}

/* scroll-reveal for the home page's top-level blocks. Safe no-op if
   IntersectionObserver isn't available (very old browsers) — content
   is visible by default per the CSS safety net either way. */
function setupReveal(){
 if(typeof IntersectionObserver==="undefined")return;
 if(!window.__revealObserver){
  window.__revealObserver=new IntersectionObserver(function(entries){
   entries.forEach(function(en){
    if(en.isIntersecting){en.target.classList.add("in-view");window.__revealObserver.unobserve(en.target)}
   });
  },{threshold:.12,rootMargin:"0px 0px -40px 0px"});
 }
 document.querySelectorAll(".home-main > *, .home-side > *").forEach(function(elm){
  if(elm.classList.contains("reveal"))return; // already set up, don't re-observe
  elm.classList.add("reveal");
  window.__revealObserver.observe(elm);
 });
}
