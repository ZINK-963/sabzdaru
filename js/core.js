/* ============================================================
   CORE — cart/checkout business logic, router, shared
   components. addToCart/placeOrder/searchAll still operate on
   local state S; see api.js for the real-backend equivalents
   that should eventually replace them.
   ============================================================ */

/* ═══ BUSINESS LOGIC — validated the same way the server would ═══ */
function addToCart(id,qty){
 var p=prod(id);if(!p)return;
 if(!p.published){toast("این کالا در دسترس نیست","error");return}
 if(p.stock<=0){toast("این کالا ناموجود است","error");return}
 var line=null;for(var i=0;i<S.cart.length;i++)if(S.cart[i].id===id)line=S.cart[i];
 var want=(line?line.qty:0)+(qty||1);
 if(want>p.stock){toast("موجودی کافی نیست؛ حداکثر "+fa(p.stock)+" عدد","error");return}
 if(line)line.qty=want;else S.cart.push({id:id,qty:qty||1});
 save();renderChrome();toast(p.name+" به سبد اضافه شد")}
function setQty(id,q){
 var p=prod(id),line=null;for(var i=0;i<S.cart.length;i++)if(S.cart[i].id===id)line=S.cart[i];
 if(!line)return;
 if(q<1){S.cart=S.cart.filter(function(c){return c.id!==id})}
 else if(q>p.stock){toast("حداکثر موجودی "+fa(p.stock)+" عدد است","error");return}
 else line.qty=q;
 save();render()}
function totals(code,shipId){
 var sub=0,sv=0;
 S.cart.forEach(function(c){var p=prod(c.id);if(!p)return;sub+=eff(p)*c.qty;if(p.sale)sv+=(p.price-p.sale)*c.qty});
 var disc=0,cErr=null;
 if(code){
  var co=null;S.coupons.forEach(function(x){if(x.code===code.toUpperCase())co=x});
  if(!co)cErr="کد تخفیف نامعتبر است";
  else if(!co.active)cErr="این کد فعال نیست یا منقضی شده";
  else if(co.limit&&co.uses>=co.limit)cErr="ظرفیت استفاده از این کد تمام شده";
  else if(sub<co.min)cErr="حداقل خرید برای این کد "+toman(co.min)+" است";
  else disc=co.type==="percent"?Math.min(sub*co.value/100,co.max||1e12):co.value}
 var ship=null;SHIPPING.forEach(function(s){if(s.id===shipId)ship=s});
 var fee=ship?ship.fee:0;
 if(sub-disc>=800000&&ship&&ship.id!=="pick")fee=0;
 return{sub:sub,save:sv,disc:Math.round(disc),shipFee:fee,cErr:cErr,total:Math.max(0,sub-disc)+fee}}
function placeOrder(d){
 for(var i=0;i<S.cart.length;i++){var c=S.cart[i],p=prod(c.id);
  if(!p||!p.published)return{err:"یکی از کالاها دیگر در دسترس نیست"};
  if(c.qty>p.stock)return{err:p.name+": موجودی به "+fa(p.stock)+" عدد کاهش یافته"}}
 var t=totals(d.coupon,d.ship);
 if(t.cErr)return{err:t.cErr};
 var id="SD-"+fa(String(100000+S.orders.length*7+Math.floor(Math.random()*900)));
 var items=S.cart.map(function(c){var p=prod(c.id);
  return{pid:p.id,name:p.name,variant:p.variant,brand:brandName(p.brand),qty:c.qty,price:eff(p),was:p.price}});
 S.cart.forEach(function(c){var p=prod(c.id);p.stock-=c.qty;p.sold+=c.qty;move(p.id,-c.qty,"فروش · سفارش "+id)});
 if(d.coupon)S.coupons.forEach(function(x){if(x.code===d.coupon.toUpperCase())x.uses++});
 var paid=d.method!=="fail";
 var o={id:id,items:items,sub:t.sub,disc:t.disc,shipFee:t.shipFee,total:t.total,ship:d.ship,
  address:d.address,customer:d.customer,method:d.method,status:paid?"پرداخت شده":"پرداخت ناموفق",at:now(),
  history:[{from:"—",to:"در انتظار پرداخت",by:"مشتری",at:now()},
           {from:"در انتظار پرداخت",to:paid?"پرداخت شده":"پرداخت ناموفق",by:"درگاه پرداخت",at:now()}],
  txn:paid?{ref:uid("TXN").toUpperCase(),at:now(),amount:t.total}:null};
 S.orders.unshift(o);S.cart=[];
 notify(paid?"سفارش "+id+" ثبت شد":"پرداخت سفارش "+id+" ناموفق بود",paid?"پرداخت با موفقیت انجام شد.":"مبلغی کسر نشده است.");
 logAudit("ثبت سفارش","سفارش "+id,"—",o.status);save();return{order:o}}
function searchAll(q){
 q=(q||"").trim();if(!q)return{products:[],brands:[],cats:[],articles:[]};
 function nm(s){return String(s).toLowerCase().replace(/ي/g,"ی").replace(/ك/g,"ک")}
 var t=nm(q);function m(s){return nm(s).indexOf(t)>-1}
 return{products:S.products.filter(function(p){return p.published&&(m(p.name)||m(p.variant)||m(brandName(p.brand))||m(catName(p.cat)))}),
 brands:BRANDS.filter(function(b){return m(b.name)}),
 cats:CATS.filter(function(c){return m(c.name)}),
 articles:ARTICLES.filter(function(a){return m(a.title)||m(a.cat)})}}

/* ═══ ROUTER ═══ */
var R={view:"home",params:{}};
var VIEWS=["home","cat","product","cart","checkout","account","admin","design","search","brand","blog","article","compare","order"];
function go(v,p){R={view:v,params:p||{}};
 var h="#/"+v+(p&&p.id?"/"+p.id:"");if(location.hash!==h)location.hash=h;else render();
 window.scrollTo({top:0})}
function parseHash(){
 // any navigation (link tap, back button, hash change) closes the mega menu —
 // previously it stayed open over the page you'd just navigated to
 if(typeof megaOpen!=="undefined")megaOpen=false;
 var h=location.hash.replace(/^#\//,"").split("/"),v=h[0]||"home";
 var keep=R.params.tab;
 R={view:VIEWS.indexOf(v)>-1?v:"home",params:{id:h[1]?decodeURIComponent(h[1]):null}};
 if(keep)R.params.tab=keep;
 if(v==="search")R.params.q=h[1]?decodeURIComponent(h[1]):""}
window.addEventListener("hashchange",function(){parseHash();render()});

/* ═══ SHARED COMPONENTS ═══ */
function badgeFor(p){
 if(!p.published)return'<span class="badge badge-neutral">منتشر نشده</span>';
 if(p.stock<=0)return'<span class="badge badge-error">ناموجود</span>';
 if(p.stock<=3)return'<span class="badge badge-warning">تنها '+fa(p.stock)+' عدد</span>';
 if(p.sale)return'<span class="badge badge-offer">'+fa(Math.round((1-p.sale/p.price)*100))+'٪ تخفیف</span>';
 return""}
function productCard(p){
 if(!p)return"";
 var out=p.stock<=0,isFav=S.favs.indexOf(p.id)>-1;
 return'<article class="prod"><div class="prod-media" data-open="'+p.id+'">'+badgeFor(p)+
 '<button class="prod-fav glass'+(isFav?" on":"")+'" data-fav="'+p.id+'" aria-pressed="'+isFav+'" aria-label="'+(isFav?"حذف از":"افزودن به")+' علاقه‌مندی‌ها">'+icon("i-heart")+'</button>'+
 icon(p.icon)+'</div><div class="prod-body"><span class="prod-brand">'+esc(brandName(p.brand))+'</span>'+
 '<h3 class="prod-name" data-open="'+p.id+'">'+esc(p.name)+'</h3>'+
 '<span class="prod-meta">'+esc(p.variant)+'</span>'+
 '<span class="stars">'+icon("i-star")+' '+fa(p.rating)+' <span class="muted">('+fa(p.reviews)+')</span></span>'+
 '<div class="prod-foot"><span>'+(p.sale?'<span class="price-was t-num">'+money(p.price)+'</span><br>':"")+
 '<span class="price t-num">'+toman(eff(p))+'</span></span>'+
 (out?'<button class="btn btn-quiet btn-sm" data-restock="'+p.id+'">خبرم کن</button>'
     :'<button class="btn btn-primary btn-sm" data-add="'+p.id+'">افزودن</button>')+
 '</div></div></article>'}
function emptyState(ic,title,body,btn,act){
 return'<div class="state"><i>'+icon(ic)+'</i><b>'+esc(title)+'</b><p>'+esc(body)+'</p>'+
 (btn?'<button class="btn btn-secondary btn-sm" '+(act||"")+'>'+esc(btn)+'</button>':"")+'</div>'}
function skeletonCards(n){var h="";for(var i=0;i<(n||8);i++)h+='<div class="card" style="padding:0;overflow:hidden">'+
 '<div class="skel" style="aspect-ratio:1/1"></div><div style="padding:16px">'+
 '<div class="skel" style="height:11px;width:40%;margin-bottom:8px"></div>'+
 '<div class="skel" style="height:14px;width:85%;margin-bottom:8px"></div>'+
 '<div class="skel" style="height:14px;width:55%"></div></div></div>';return h}
function crumbs(arr){return'<nav class="breadcrumb" aria-label="مسیر">'+arr.map(function(c,i){
 return(i?icon("i-chev"):"")+(c.go?'<a data-go="'+c.go+'"'+(c.id?' data-id="'+c.id+'"':"")+'>'+esc(c.t)+'</a>':'<span>'+esc(c.t)+'</span>')}).join("")+'</nav>'}
function pager(page,pages){
 if(pages<2)return"";
 var h='<div class="pager"><button '+(page===1?"disabled":"")+' data-page="'+(page-1)+'">قبلی</button>';
 for(var i=1;i<=pages;i++)h+='<button data-page="'+i+'"'+(i===page?' aria-current="page"':"")+'>'+fa(i)+'</button>';
 return h+'<button '+(page===pages?"disabled":"")+' data-page="'+(page+1)+'">بعدی</button></div>'}
function kpi(label,val,delta){return'<div class="kpi"><span>'+esc(label)+'</span><b>'+val+'</b>'+
 (delta?'<em class="'+(delta[0]==="+"?"up":"down")+'">'+fa(delta)+'</em>':"")+'</div>'}
function articleCard(a){return'<article class="article" data-article="'+a.id+'"><div class="cover"></div><div class="body">'+
 '<h3 class="t-h3">'+esc(a.title)+'</h3><p class="t-small" style="margin-top:8px">'+esc(a.body.slice(0,72))+'…</p>'+
 '<div class="meta"><span>'+esc(a.cat)+'</span><span>'+fa(a.read)+' دقیقه مطالعه</span></div></div></article>'}
function overlay(html){document.getElementById("overlay").innerHTML=html||"";document.body.style.overflow=html?"hidden":""}
function closeOverlay(){overlay("")}
function dialog(title,body,foot){
 overlay('<div class="scrim" data-close="1"><div class="dialog" role="dialog" aria-modal="true">'+
 '<div class="dialog-head"><b class="t-h4">'+esc(title)+'</b><button class="iconbtn" data-close="1" aria-label="بستن">'+icon("i-x")+'</button></div>'+
 '<div class="dialog-body">'+body+'</div>'+(foot?'<div class="dialog-foot">'+foot+'</div>':"")+'</div></div>')}
function collections(){
 /* resolved by SLUG, not id: ids are opaque database ids once the backend is live */
 function ids(slugs){return slugs.map(function(sl){for(var i=0;i<S.products.length;i++)if(S.products[i].slug===sl)return S.products[i].id;return null}).filter(Boolean)}
 return[
 {id:"c1",name:"مراقبت روزانهٔ پوست",desc:"سه قدم ساده برای صبح: پاک‌کننده، آبرسان، ضدآفتاب.",ids:ids(["skin-4","skin-1","skin-2"])},
 {id:"c2",name:"ضروری‌های موی رنگ‌شده",desc:"شست‌وشوی ملایم و ترمیم رطوبت.",ids:ids(["hair-1","hair-2","hair-3"])},
 {id:"c3",name:"کیف سفر",desc:"اقلام کوچک بهداشتی و کمک‌های اولیه.",ids:ids(["daily-1","hygiene-3","daily-2"])}]}
