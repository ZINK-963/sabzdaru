/* views: home + category/PLP */

/* ═══ HOME ═══ */
var disc={step:0,cat:null,attr:null,budget:null};
function discoverResults(){
 var r=S.products.filter(function(p){return p.published&&p.cat===disc.cat});
 if(disc.attr){var a=disc.attr.split("|");r=r.filter(function(p){return p.attrs&&p.attrs[a[0]]===a[1]})}
 if(disc.budget){var b=disc.budget.split("-");r=r.filter(function(p){return eff(p)>=+b[0]&&eff(p)<=+b[1]})}
 return r}
function discoveryBlock(){
 var names=["دسته","ویژگی","بودجه"],c=disc.cat?catOf(disc.cat):null,q="",opts=[];
 if(disc.step===0){q="امروز دنبال چه چیزی هستید؟";opts=CATS.slice(0,6).map(function(x){return{v:x.id,t:x.name}})}
 else if(disc.step===1){
  var key=null;c.filters.forEach(function(f){if(!key&&f!=="brand"&&FD[f].opts.length)key=f});key=key||"form";
  q=FD[key].label+" را انتخاب کنید";
  opts=FD[key].opts.filter(function(o){return S.products.some(function(p){return p.cat===disc.cat&&p.attrs&&p.attrs[key]===o})})
       .map(function(o){return{v:key+"|"+o,t:o}})}
 else if(disc.step===2){q="محدودهٔ قیمت؟";opts=[{v:"0-300000",t:"تا ۳۰۰ هزار"},{v:"300000-600000",t:"۳۰۰ تا ۶۰۰ هزار"},{v:"600000-99999999",t:"بالای ۶۰۰ هزار"}]}
 var out="";
 if(disc.step===3){
  var res=discoverResults();
  out=res.length
   ?'<div class="disc-out"><span class="thumb">'+icon(c.icon)+'</span><span style="flex:1"><strong style="display:block">'+fa(res.length)+' محصول با این مشخصات</strong>'+
     '<span class="t-tiny">'+esc(c.name)+(disc.attr?" · "+esc(disc.attr.split("|")[1]):"")+(disc.budget?" · تا "+money(disc.budget.split("-")[1]):"")+'</span></span>'+
     '<button class="btn btn-primary btn-sm" data-discgo="1">دیدن نتایج</button></div>'
   :'<div class="disc-out"><span class="thumb">'+icon("i-search")+'</span><span style="flex:1"><strong style="display:block">محصولی با این ترکیب نیست</strong>'+
     '<span class="t-tiny">یکی از شرط‌ها را تغییر دهید</span></span>'+
     '<button class="btn btn-quiet btn-sm" data-discreset="1">شروع دوباره</button></div>'}
 return'<div class="disc"><div class="disc-steps">'+names.map(function(s,i){
   return'<span class="'+(i<=disc.step-1||i===disc.step?"on":"")+'"><i>'+(i<disc.step?"✓":fa(i+1))+'</i>'+s+'</span>'}).join("")+
  (disc.step>0?'<button class="btn btn-ghost btn-xs" data-discreset="1" style="margin-inline-start:auto">شروع دوباره</button>':"")+'</div>'+
  (disc.step<3?'<p class="disc-q">'+q+'</p><div class="row">'+opts.map(function(o){
    return'<button class="chip" data-disc="'+esc(o.v)+'">'+esc(o.t)+'</button>'}).join("")+'</div>':'<p class="disc-q">انتخاب شما</p>')+
  out+'<p class="t-tiny" style="margin-top:14px">این ابزار فقط کاتالوگ را فیلتر می‌کند؛ تشخیص یا توصیهٔ درمانی نمی‌دهد.</p></div>'}
var heroSlide=0;
var megaOpen=false;
var HERO_SLIDES=[
 {title:"سلامتی و زیبایی در کنار هم",sub:"محصولات مراقبتی، بهداشتی و مکمل‌های اصل برای زندگی سالم‌تر",cta:"cat",cid:"skin",
  bg:"linear-gradient(115deg,#0F2A16 0%,#1F5C33 45%,#7FA36B 100%)"},
 {title:"ویتامین و مکمل، اصل و تضمینی",sub:"تأمین از منابع رسمی با کنترل تاریخ انقضا پیش از ارسال",cta:"cat",cid:"supp",
  bg:"linear-gradient(115deg,#122A22 0%,#2B5C46 45%,#7FA38C 100%)"},
 {title:"مادر و کودک، با مراقبت ویژه",sub:"محصولات ملایم و بررسی‌شده برای پوست حساس کودک",cta:"cat",cid:"baby",
  bg:"linear-gradient(115deg,#2A2312 0%,#5C4B2B 45%,#A38F6C 100%)"}
];
function heroDiscoveryPills(){
 return CATS.slice(0,4).map(function(c){
  return'<button class="hero-pill glass" data-go="cat" data-id="'+c.id+'">'+icon(c.icon)+esc(c.name)+'</button>'}).join("")}
function viewHome(){
 var pub=S.products.filter(function(p){return p.published});
 var best=pub.slice().sort(function(a,b){return b.sold-a.sold}).slice(0,8);
 var fresh=pub.slice(-4);
 var recommended=pub.slice().sort(function(a,b){return b.rating-a.rating}).slice(0,4);
 var popular=pub.slice().sort(function(a,b){return b.reviews-a.reviews}).slice(0,4);
 var slide=HERO_SLIDES[heroSlide];

 // ── main column ──
 var main='<div class="hero-panel" style="background:'+slide.bg+'">'+
 '<button class="hero-arrow prev" data-hero="-1" aria-label="اسلاید قبلی">'+icon("i-arrow")+'</button>'+
 '<button class="hero-arrow next" data-hero="1" aria-label="اسلاید بعدی">'+icon("i-arrow")+'</button>'+
 '<div class="wrap2">'+
 '<h1 class="t-h1" style="max-width:14ch;font-size:clamp(26px,4vw,40px)">'+esc(slide.title)+'</h1>'+
 '<p style="margin-top:10px;max-width:34ch;font-size:15px">'+esc(slide.sub)+'</p>'+
 '<button class="btn btn-primary" style="margin-top:22px" data-go="'+slide.cta+'" data-id="'+slide.cid+'">'+icon("i-chev")+' مشاهدهٔ محصولات</button>'+
 '</div><div class="hero-pills">'+heroDiscoveryPills()+'</div>'+
 '<div class="hero-dots">'+HERO_SLIDES.map(function(s,i){return'<span class="'+(i===heroSlide?"on":"")+'" data-herodot="'+i+'"></span>'}).join("")+'</div></div>';

 main+='<div class="hero-trust card">'+
 [["i-shield","اصالت کالا"],["i-return","ضمانت بازگشت"],["i-lock","پرداخت امن"],["i-truck","ارسال سریع"]]
 .map(function(t){return'<div><i>'+icon(t[0])+'</i>'+t[1]+'</div>'}).join("")+'</div>';

 main+='<div><div class="section-head" style="margin-bottom:var(--s4)"><div><h2 class="t-h2">دسته‌بندی محصولات</h2></div></div>'+
 '<div class="cat-grid">'+CATS.map(function(c){return'<a class="cat" data-go="cat" data-id="'+c.id+'"><i>'+icon(c.icon)+
  '</i><span><b>'+esc(c.name)+'</b><span>'+fa(S.products.filter(function(p){return p.cat===c.id}).length)+' کالا</span></span></a>'}).join("")+'</div></div>';

 main+='<div><div class="section-head" style="margin-bottom:var(--s4)"><div><h2 class="t-h2">مجموعه‌های منتخب</h2></div>'+
 '<a class="t-small" style="cursor:pointer" data-go="blog">مشاهدهٔ همه</a></div>'+
 '<div class="collections-wrap"><button class="collections-arrow prev" data-colscroll="-1" aria-label="مجموعهٔ قبلی">'+icon("i-arrow")+'</button>'+
 '<button class="collections-arrow next" data-colscroll="1" aria-label="مجموعهٔ بعدی">'+icon("i-arrow")+'</button>'+
 '<div class="collections" id="collscroll">'+collections().map(function(col){
  var items=col.ids.map(prod).filter(Boolean),sum=items.reduce(function(a,p){return a+eff(p)},0);
  return'<article class="col-card"><h3 class="t-h3">'+esc(col.name)+'</h3><p class="t-small" style="min-height:44px">'+esc(col.desc)+'</p>'+
  '<ul class="col-list">'+items.map(function(p){return'<li><a data-open="'+p.id+'">'+esc(p.name)+'</a><span>'+money(eff(p))+'</span></li>'}).join("")+'</ul>'+
  '<div class="between" style="margin-top:14px"><span class="price t-num">'+toman(sum)+'</span>'+
  '<button class="btn btn-secondary btn-sm" data-addcol="'+col.id+'">افزودن مجموعه</button></div></article>'}).join("")+'</div></div></div>';

 main+='<div><div class="section-head" style="margin-bottom:var(--s4)"><div><h2 class="t-h2">محصولات پرفروش</h2></div>'+
 '<a class="t-small" style="cursor:pointer" data-go="cat" data-id="skin">مشاهدهٔ همه</a></div>'+
 '<div class="prod-grid">'+best.map(productCard).join("")+'</div></div>';

 main+='<div class="card card-pad" style="background-image:linear-gradient(120deg,rgba(255,255,255,.15),rgba(255,255,255,0))">'+
 '<div class="split"><div><h2 class="t-h2">روتین مراقبت پوست و مو</h2>'+
 '<p class="t-small" style="margin-top:10px;max-width:40ch">با محصولات منتخب، زیبایی طبیعی خود را حفظ کنید.</p>'+
 '<button class="btn btn-primary" style="margin-top:18px" data-go="account" data-tab="routines">مشاهدهٔ محصولات</button></div>'+
 '<ul class="steps-list">'+
 [["پاک‌کننده","صبح و شب · ژل شست‌وشوی ملایم"],["سرم","شب · پس از خشک‌شدن کامل پوست"],
  ["آبرسان","صبح و شب · بافت سبک"],["ضدآفتاب","فقط صبح · طبق دستور روی بسته"]]
 .map(function(s,i){return'<li><i>'+fa(i+1)+'</i><div><b>'+s[0]+'</b><span>'+s[1]+'</span></div></li>'}).join("")+'</ul></div></div>';

 main+='<div><h2 class="t-h2" style="margin-bottom:var(--s4)">چرا سبزدارو؟</h2><div class="trust-row2">'+
 [["i-truck","ارسال سریع","به سراسر کشور"],["i-shield","تضمین اصالت کالا","با کنترل قبل از ارسال"],
  ["i-lock","پرداخت امن","همیشه در درگاه معتبر"],["i-chat","پشتیبانی ۲۴/۷","همیشه در کنار شما"]]
 .map(function(t){return'<div class="trust-item2"><i>'+icon(t[0])+'</i><b>'+t[1]+'</b><p>'+t[2]+'</p></div>'}).join("")+'</div></div>';

 main+='<div class="app-banner"><div class="phone"><div class="screen"><div class="row1"></div><div class="row2"></div>'+
 '<div class="grid4"><span></span><span></span><span></span><span></span></div></div></div>'+
 '<div class="txt"><h2 class="t-h2">تجربهٔ خرید بهتر، در موبایل</h2>'+
 '<p class="t-small" style="margin-top:8px">با اپلیکیشن سبزدارو، همیشه و همه‌جا خرید کنید.</p>'+
 '<div class="row" style="margin-top:16px">'+
 '<span class="store-btn">'+icon("i-apple")+'<span><small>دانلود از</small><b>App Store</b></span></span>'+
 '<span class="store-btn">'+icon("i-play")+'<span><small>دانلود از</small><b>Google Play</b></span></span>'+
 '</div></div></div>';

 // ── sidebar ──
 var side='<div class="side-card"><div class="side-head"><b>محصولات پیشنهادی برای شما</b><a data-go="cat" data-id="skin">مشاهدهٔ همه</a></div>'+
 '<div class="mini-grid">'+recommended.map(function(p){
  return'<div class="mini-item" data-open="'+p.id+'"><div class="mi-media">'+icon(p.icon)+'</div>'+
  '<b>'+esc(p.name)+'</b><span class="price t-num">'+money(eff(p))+'</span></div>'}).join("")+'</div></div>';

 side+='<div class="member-banner"><i>'+icon("i-gift")+'</i><b>با هر خرید، امتیاز بگیرید</b>'+
 '<button class="btn btn-primary btn-sm" data-go="account">عضویت در باشگاه</button></div>';

 side+='<div class="side-card"><div class="side-head"><b>دسته‌بندی‌های پرطرفدار</b></div>'+
 '<div class="cats-mini">'+CATS.slice(0,6).map(function(c){
  return'<a data-go="cat" data-id="'+c.id+'"><i>'+icon(c.icon)+'</i><span>'+esc(c.name)+'</span></a>'}).join("")+'</div></div>';

 side+='<div class="calm-banner"><b>آرامش، تعادل، سلامتی</b><p>با انتخاب‌های هوشمندانه، زندگی سالم‌تری بسازید</p>'+
 '<button class="btn btn-secondary btn-sm" data-go="blog">شروع کنید</button></div>';

 side+='<div class="side-card"><div class="side-head"><b>مقالات و آموزش‌ها</b><a data-go="blog">مشاهدهٔ همه</a></div>'+
 '<div class="mini-articles">'+ARTICLES.slice(0,3).map(function(a){
  return'<div class="mini-article" data-article="'+a.id+'"><div class="cover"></div><span>'+esc(a.title)+'</span></div>'}).join("")+'</div></div>';

 side+='<div class="side-card"><div class="side-head"><b>محصولات محبوب</b></div><ul class="mini-list">'+
 popular.map(function(p){return'<li><a data-open="'+p.id+'" class="mi-thumb">'+icon(p.icon)+'</a>'+
  '<div style="flex:1"><b>'+esc(p.name)+'</b><span>'+money(eff(p))+' تومان</span></div></li>'}).join("")+'</ul></div>';

 side+='<div class="side-card" style="text-align:center">'+
 '<b style="display:block;margin-bottom:6px">عضویت در خبرنامه</b>'+
 '<p class="t-small" style="margin-bottom:12px">جدیدترین تخفیف‌ها و مقالات را دریافت کنید</p>'+
 '<form id="newsform" style="display:flex;gap:6px"><input class="input" type="email" id="newsmail" placeholder="ایمیل شما" aria-label="ایمیل" style="height:40px">'+
 '<button class="btn btn-primary btn-sm" type="submit">ثبت</button></form>'+
 '<p class="hint hint-error hidden" id="newserr" style="margin-top:8px"></p></div>';

 return'<div class="wrap section"><div class="home-layout"><div class="home-main">'+main+'</div><div class="home-side">'+side+'</div></div></div>'}

/* ═══ CATEGORY (PLP) ═══ */
var plp={filters:{},sort:"pop",page:1,loading:false};
function filterDefs(catId){
 return catOf(catId).filters.map(function(f){
  var d={key:f,label:FD[f].label,opts:FD[f].opts};
  if(f==="brand"){var seen=[];S.products.forEach(function(p){if(p.cat===catId){var n=brandName(p.brand);if(seen.indexOf(n)<0)seen.push(n)}});d.opts=seen}
  return d})}
function filterPanel(catId){
 var defs=filterDefs(catId);
 var h=defs.map(function(d){
  if(!d.opts.length)return"";
  var sel=plp.filters[d.key]||[];
  return'<div class="fgroup"><h4>'+esc(d.label)+'</h4>'+d.opts.map(function(o){
   var n=S.products.filter(function(p){return p.cat===catId&&(d.key==="brand"?brandName(p.brand)===o:p.attrs&&p.attrs[d.key]===o)}).length;
   return'<label class="fopt"><input type="checkbox" data-f="'+d.key+'" value="'+esc(o)+'"'+(sel.indexOf(o)>-1?" checked":"")+(n?"":" disabled")+'>'+
   '<span>'+esc(o)+'</span><small>'+fa(n)+'</small></label>'}).join("")+'</div>'}).join("");
 return h||'<p class="t-small">برای این دسته فیلتری تعریف نشده است.</p>'}
function viewCat(){
 var id=R.params.id||"skin";if(!catOf(id)||CATS.map(function(c){return c.id}).indexOf(id)<0)id="skin";
 R.params.id=id;var cat=catOf(id);
 var list=S.products.filter(function(p){return p.published&&p.cat===id});
 Object.keys(plp.filters).forEach(function(k){
  var vals=plp.filters[k];if(!vals.length)return;
  list=list.filter(function(p){return k==="brand"?vals.indexOf(brandName(p.brand))>-1:(p.attrs&&vals.indexOf(p.attrs[k])>-1)})});
 var srt={pop:function(a,b){return b.sold-a.sold},new:function(a,b){return b.id.localeCompare(a.id)},
  cheap:function(a,b){return eff(a)-eff(b)},exp:function(a,b){return eff(b)-eff(a)},rate:function(a,b){return b.rating-a.rating}};
 list.sort(srt[plp.sort]);
 var per=8,pages=Math.max(1,Math.ceil(list.length/per));
 if(plp.page>pages)plp.page=1;
 var slice=list.slice((plp.page-1)*per,plp.page*per);
 var active=[];Object.keys(plp.filters).forEach(function(k){(plp.filters[k]||[]).forEach(function(v){active.push({k:k,v:v})})});
 var h='<div class="wrap">'+crumbs([{t:"خانه",go:"home"},{t:cat.name}])+
 '<div class="between" style="margin-bottom:24px;flex-wrap:wrap"><div><h1 class="t-h1">'+esc(cat.name)+'</h1>'+
 '<p class="t-small">'+fa(list.length)+' کالا با فیلترهای فعلی</p></div></div><div class="plp">'+
 '<aside class="filters">'+filterPanel(id)+'</aside><div>'+
 '<div class="plp-bar"><button class="btn btn-secondary btn-sm mobile-filter-btn" id="openfilters">'+icon("i-filter")+' فیلترها'+(active.length?" ("+fa(active.length)+")":"")+'</button>'+
 '<div class="row" style="margin-inline-start:auto;gap:8px"><label class="t-small" for="sort">مرتب‌سازی</label>'+
 '<select class="select" id="sort" style="width:auto;height:38px;padding-inline-end:38px">'+
 [["pop","پرفروش‌ترین"],["new","جدیدترین"],["cheap","ارزان‌ترین"],["exp","گران‌ترین"],["rate","بیشترین امتیاز"]]
 .map(function(s){return'<option value="'+s[0]+'"'+(plp.sort===s[0]?" selected":"")+'>'+s[1]+'</option>'}).join("")+'</select></div></div>';
 if(active.length)h+='<div class="active-filters">'+active.map(function(a){
  return'<span class="filter-pill">'+esc(a.v)+'<button data-rmf="'+a.k+'|'+esc(a.v)+'" aria-label="حذف فیلتر">'+icon("i-x")+'</button></span>'}).join("")+
  '<button class="btn btn-ghost btn-xs" data-clearf="1">حذف همه</button></div>';
 h+=plp.loading?'<div class="prod-grid">'+skeletonCards(8)+'</div>'
  :slice.length?'<div class="prod-grid">'+slice.map(productCard).join("")+'</div>'+pager(plp.page,pages)
  :emptyState("i-search","کالایی با این فیلترها نیست","ترکیب فیلترها نتیجه‌ای ندارد. یکی از شرط‌ها را بردارید.","حذف همهٔ فیلترها",'data-clearf="1"');
 return h+'</div></div></div>'}
function openFilterDrawer(){
 overlay('<div class="scrim" data-close="1"></div><aside class="drawer" role="dialog" aria-label="فیلترها">'+
 '<div class="dialog-head"><b class="t-h4">فیلترها</b><button class="iconbtn" data-close="1" aria-label="بستن">'+icon("i-x")+'</button></div>'+
 '<div class="dialog-body" style="flex:1" id="filterdrawerbody">'+filterPanel(R.params.id)+'</div>'+
 '<div class="dialog-foot"><button class="btn btn-primary" style="flex:1" data-close="1">نمایش نتایج</button>'+
 '<button class="btn btn-quiet" data-clearf="1">پاک کردن</button></div></aside>')}
function refreshFilterDrawer(){var el=$("filterdrawerbody");if(el)el.innerHTML=filterPanel(R.params.id)}
