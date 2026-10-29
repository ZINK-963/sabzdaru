/* views: product detail + cart + checkout */

/* ═══ PRODUCT DETAIL ═══ */
var pdp={img:0,tab:"desc",qty:1};

var triedLive={};
/* fire-and-forget: tries to upgrade a product's local demo data with the
   real API response. Never throws, never blocks the page — if it fails
   (no backend deployed, product not seeded yet, network error), the page
   just keeps showing what it already had. */
async function loadProductLive(id){
 var local=prod(id);
 if(!local||!local.slug)return;
 var r=await API.fetchProduct(local.slug);
 if(!r.ok||!r.data)return;
 mergeApiProduct(local,r.data);
 save();
 if(R.view==="product"&&R.params.id===id)render();
}
function pdpTab(p,revs){
 if(pdp.tab==="desc")return'<p>'+esc(p.desc)+'</p><p class="t-small" style="margin-top:16px">'+esc(p.warn)+'</p>'+
  '<div class="card card-pad" style="margin-top:20px;background:var(--info-bg);border-color:rgba(47,100,120,.2)">'+
  '<div class="row" style="gap:10px;align-items:flex-start;flex-wrap:nowrap"><span style="color:var(--info)">'+icon("i-info")+'</span>'+
  '<p class="t-small" style="color:var(--info);flex:1">اطلاعات این صفحه نمونه است و جایگزین مشاورهٔ پزشکی یا دستور مصرف روی بستهٔ محصول نیست.</p></div></div>';
 if(pdp.tab==="spec"){
  var rows=[["برند",brandName(p.brand)],["دسته‌بندی",catName(p.cat)],["بسته‌بندی",p.variant],
   ["شناسهٔ بچ",p.batch],["تاریخ انقضا",fa(p.expiry)]];
  Object.keys(p.attrs||{}).forEach(function(k){rows.push([(FD[k]||{label:k}).label,p.attrs[k]])});
  return'<table class="spec-table"><tbody>'+rows.map(function(r){
   return'<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>'}).join("")+'</tbody></table>'}
 if(pdp.tab==="ing")return'<p>'+esc(p.ingredients)+'</p>';
 if(pdp.tab==="use")return'<p>'+esc(p.usage)+'</p><h4 class="t-h4" style="margin-top:20px">نگهداری</h4><p class="t-small">'+esc(p.storage)+'</p>';
 var avg=revs.length?(revs.reduce(function(a,r){return a+r.stars},0)/revs.length).toFixed(1):"—";
 var h='<div class="card card-pad" style="margin-bottom:20px"><div class="row" style="gap:32px;align-items:flex-start">'+
 '<div style="text-align:center"><div style="font-size:38px;font-weight:800">'+fa(avg)+'</div>'+
 '<span class="t-tiny">'+fa(revs.length)+' نظر ثبت‌شده</span></div><div style="flex:1;min-width:200px">'+
 [5,4,3,2,1].map(function(s){
  var n=revs.filter(function(r){return r.stars===s}).length;
  return'<div class="rating-bar"><span>'+fa(s)+'</span><span class="track"><span class="fill" style="width:'+(revs.length?n/revs.length*100:0)+'%"></span></span><span class="muted">'+fa(n)+'</span></div>'}).join("")+
 '</div><button class="btn btn-secondary btn-sm" data-review="'+p.id+'">ثبت نظر</button></div></div>';
 return h+(revs.length?revs.map(function(r){
  return'<div class="review"><div class="between"><b>'+esc(r.by)+'</b>'+(r.verified?'<span class="badge badge-success">خرید تأییدشده</span>':"")+'</div>'+
  '<div class="stars" style="margin-block:4px">'+new Array(r.stars+1).join(icon("i-star"))+'</div>'+
  '<p class="t-small">'+esc(r.text)+'</p>'+
  '<button class="btn btn-ghost btn-xs" style="margin-top:6px" data-helpful="'+r.id+'">مفید بود ('+fa(r.helpful||0)+')</button></div>'}).join("")
  :emptyState("i-chat","هنوز نظری ثبت نشده","اولین نفری باشید که تجربه‌اش را می‌نویسد.","ثبت نظر",'data-review="'+p.id+'"'))}
function viewProduct(){
 var p=prod(R.params.id);
 if(!p)return'<div class="wrap section">'+emptyState("i-alert","کالا پیدا نشد","این شناسهٔ کالا وجود ندارد یا حذف شده است.","بازگشت به خانه",'data-go="home"')+'</div>';
 if(S.recent.indexOf(p.id)<0){S.recent.unshift(p.id);S.recent=S.recent.slice(0,8);save()}
 var revs=S.reviews[p.id]||[];
 var related=S.products.filter(function(x){return x.cat===p.cat&&x.id!==p.id&&x.published}).slice(0,4);
 var fbt=S.products.filter(function(x){return x.id!==p.id&&x.published&&x.stock>0}).sort(function(a,b){return b.sold-a.sold}).slice(0,2);
 var isFav=S.favs.indexOf(p.id)>-1,inCmp=S.compare.indexOf(p.id)>-1,out=p.stock<=0;
 var h='<div class="wrap">'+crumbs([{t:"خانه",go:"home"},{t:catName(p.cat),go:"cat",id:p.cat},{t:p.name}])+
 '<div class="pdp"><div><div class="gallery-main" id="gmain">'+icon(p.icon)+
 '<span class="badge badge-neutral" style="position:absolute;bottom:12px;inset-inline-start:12px">تصویر نمونه · برای بزرگ‌نمایی کلیک کنید</span></div>'+
 '<div class="gallery-thumbs">'+[0,1,2].map(function(i){
  return'<button data-img="'+i+'" aria-current="'+(pdp.img===i)+'" aria-label="تصویر '+fa(i+1)+'">'+icon(p.icon)+'</button>'}).join("")+'</div></div><div>'+
 '<span class="t-small">'+esc(brandName(p.brand))+' · '+esc(catName(p.cat))+'</span>'+
 '<h1 class="t-h1" style="margin-block:6px 8px">'+esc(p.name)+'</h1>'+
 '<p class="t-small">'+esc(p.variant)+'</p>'+
 '<div class="row" style="margin-top:12px"><span class="stars">'+icon("i-star")+' '+fa(p.rating)+' <span class="muted">('+fa(p.reviews)+' نظر)</span></span>'+badgeFor(p)+
 (p.live&&!(API&&API.live)?'<span class="badge badge-info" title="این داده از بک‌اند واقعی آمده، نه از دادهٔ نمایشی محلی">'+icon("i-check")+' دادهٔ زنده</span>':"")+'</div>'+
 '<div class="card card-pad" style="margin-top:20px"><div class="between"><div>'+
 (p.sale?'<span class="price-was t-num">'+toman(p.price)+'</span><br>':"")+
 '<span class="price t-num" style="font-size:26px">'+toman(eff(p))+'</span></div>'+
 (p.stock>0?'<span class="badge badge-success">'+icon("i-check")+' موجود در انبار</span>':'<span class="badge badge-error">ناموجود</span>')+'</div><div class="divider"></div>'+
 (out?'<button class="btn btn-quiet btn-block" data-restock="'+p.id+'">'+icon("i-bell")+' وقتی موجود شد خبرم کن</button>'
  :'<div class="row" style="gap:10px;flex-wrap:nowrap"><div class="qty">'+
   '<button data-q="-1"'+(pdp.qty<=1?" disabled":"")+' aria-label="کاهش">'+icon("i-minus")+'</button>'+
   '<span>'+fa(pdp.qty)+'</span><button data-q="1"'+(pdp.qty>=p.stock?" disabled":"")+' aria-label="افزایش">'+icon("i-plus")+'</button></div>'+
   '<button class="btn btn-primary" style="flex:1" data-add="'+p.id+'">'+icon("i-cart")+' افزودن به سبد</button></div>')+
 '<div class="row" style="margin-top:12px;gap:8px">'+
 '<button class="btn btn-secondary btn-sm" data-fav="'+p.id+'">'+icon("i-heart")+(isFav?" در علاقه‌مندی‌ها":" علاقه‌مندی")+'</button>'+
 '<button class="btn btn-secondary btn-sm" data-cmp="'+p.id+'">'+icon("i-scale")+(inCmp?" در مقایسه":" مقایسه")+'</button>'+
 '<button class="btn btn-secondary btn-sm" data-tolist="'+p.id+'">'+icon("i-list")+' فهرست خرید</button></div>'+
 '<div class="divider"></div><ul class="pdp-trust">'+
 '<li>'+icon("i-truck")+'ارسال از ۳ روز کاری · رایگان بالای ۸۰۰٬۰۰۰ تومان</li>'+
 '<li>'+icon("i-box")+'تاریخ انقضای بسته: '+fa(p.expiry)+'</li>'+
 '<li>'+icon("i-return")+'بازگشت کالای پلمب‌شده تا ۷ روز</li></ul></div></div></div>';
 h+='<section style="padding-bottom:48px"><div class="tabs" role="tablist">'+
 [["desc","معرفی"],["spec","مشخصات"],["ing","ترکیبات"],["use","نحوهٔ استفاده"],["rev","نظرها ("+fa(revs.length)+")"]]
 .map(function(t){return'<button role="tab" data-ptab="'+t[0]+'" aria-selected="'+(pdp.tab===t[0])+'">'+t[1]+'</button>'}).join("")+'</div>'+
 '<div style="padding-top:24px" class="measure">'+pdpTab(p,revs)+'</div></section>';
 if(fbt.length===2){var trio=[p].concat(fbt);
  h+='<section style="padding-bottom:48px"><h2 class="t-h2" style="margin-bottom:20px">اغلب با هم خریداری می‌شوند</h2>'+
  '<div class="card card-pad"><div class="row" style="gap:16px">'+
  trio.map(function(x){return'<div style="display:flex;gap:12px;align-items:center"><div class="line-thumb" data-open="'+x.id+'">'+icon(x.icon)+'</div>'+
   '<div><div style="font-size:14px;font-weight:600">'+esc(x.name)+'</div><span class="price t-num t-small">'+toman(eff(x))+'</span></div></div>'}).join('<span class="muted">+</span>')+
  '<div style="margin-inline-start:auto;text-align:center"><div class="price t-num" style="font-size:19px">'+toman(trio.reduce(function(a,x){return a+eff(x)},0))+'</div>'+
  '<button class="btn btn-primary btn-sm" style="margin-top:8px" data-addmany="'+trio.map(function(x){return x.id}).join(",")+'">افزودن هر سه</button></div></div></div></section>'}
 if(related.length)h+='<section style="padding-bottom:48px"><h2 class="t-h2" style="margin-bottom:20px">محصولات مرتبط</h2>'+
  '<div class="prod-grid">'+related.map(productCard).join("")+'</div></section>';
 var rec=S.recent.filter(function(i){return i!==p.id}).slice(0,4);
 if(rec.length)h+='<section style="padding-bottom:64px"><h2 class="t-h2" style="margin-bottom:20px">بازدیدهای اخیر</h2>'+
  '<div class="prod-grid">'+rec.map(function(i){return productCard(prod(i))}).join("")+'</div></section>';
 h+='</div>';
 if(!out)h+='<div class="sticky-buy glass"><span class="price t-num">'+toman(eff(p))+'</span>'+
  '<button class="btn btn-primary btn-sm" data-add="'+p.id+'">افزودن به سبد</button></div>';
 return h}

/* ═══ CART & CHECKOUT ═══ */
var checkout={step:1,coupon:"",ship:"std",customer:{},address:{},method:"ok",errs:{}};
function summaryCard(t,withCoupon){
 return'<div class="card card-pad"><h3 class="t-h4" style="margin-bottom:12px">خلاصهٔ سفارش</h3>'+
 '<div class="sum-line"><span>مبلغ کالاها</span><span class="t-num">'+toman(t.sub)+'</span></div>'+
 (t.save?'<div class="sum-line" style="color:var(--brass)"><span>سود از تخفیف کالاها</span><span class="t-num">'+toman(t.save)+'</span></div>':"")+
 (t.disc?'<div class="sum-line" style="color:var(--success)"><span>کد تخفیف</span><span class="t-num">−'+toman(t.disc)+'</span></div>':"")+
 '<div class="sum-line"><span>هزینهٔ ارسال</span><span class="t-num">'+(t.shipFee?toman(t.shipFee):"رایگان")+'</span></div>'+
 '<div class="sum-total"><span>قابل پرداخت</span><span class="t-num">'+toman(t.total)+'</span></div>'+
 (withCoupon?'<div class="divider"></div><div class="field"><label class="t-label" for="cc">کد تخفیف</label>'+
  '<div class="row" style="gap:8px;flex-wrap:nowrap"><input class="input" id="cc" value="'+esc(checkout.coupon)+'" placeholder="مثلاً SABZ10"'+(t.cErr?' aria-invalid="true"':"")+'>'+
  '<button class="btn btn-quiet" id="applycc">اعمال</button></div>'+
  (t.cErr?'<span class="hint hint-error">'+icon("i-alert")+esc(t.cErr)+'</span>'
   :checkout.coupon?'<span class="hint" style="color:var(--success)">کد اعمال شد</span>'
   :'<span class="hint">کدهای فعال نمونه: SABZ10 و WELCOME50</span>')+'</div>':"")+'</div>'}
function viewCart(){
 if(!S.cart.length)return'<div class="wrap section">'+crumbs([{t:"خانه",go:"home"},{t:"سبد خرید"}])+
  emptyState("i-cart","سبد خرید خالی است","هنوز کالایی اضافه نکرده‌اید. از پرفروش‌های این هفته شروع کنید.","دیدن پرفروش‌ها",'data-go="home"')+'</div>';
 var t=totals(checkout.coupon,checkout.ship);
 var issues=S.cart.filter(function(c){var p=prod(c.id);return!p||c.qty>p.stock});
 var h='<div class="wrap">'+crumbs([{t:"خانه",go:"home"},{t:"سبد خرید"}])+
 '<h1 class="t-h1" style="margin-bottom:24px">سبد خرید</h1>';
 if(issues.length)h+='<div class="card card-pad" style="background:var(--error-bg);border-color:rgba(166,58,46,.3);margin-bottom:16px">'+
  '<div class="row" style="gap:10px"><span style="color:var(--error)">'+icon("i-alert")+'</span><b style="color:var(--error)">موجودی بعضی کالاها تغییر کرده است</b></div>'+
  '<p class="t-small" style="margin-top:6px">تعداد را اصلاح کنید تا بتوانید ادامه دهید.</p></div>';
 h+='<div class="two-col"><div class="card">'+S.cart.map(function(c){
  var p=prod(c.id);if(!p)return"";var over=c.qty>p.stock;
  return'<div class="line-item"><div class="line-thumb" data-open="'+p.id+'">'+icon(p.icon)+'</div>'+
  '<div style="flex:1;min-width:0"><div class="between"><div><div style="font-weight:600">'+esc(p.name)+'</div>'+
  '<span class="t-tiny">'+esc(brandName(p.brand))+' · '+esc(p.variant)+'</span></div>'+
  '<button class="btn btn-ghost btn-xs" data-del="'+p.id+'" aria-label="حذف">'+icon("i-trash")+'</button></div>'+
  (over?'<p class="hint hint-error" style="margin-top:6px">'+icon("i-alert")+' فقط '+fa(p.stock)+' عدد موجود است</p>':"")+
  '<div class="between" style="margin-top:10px"><div class="qty">'+
  '<button data-cq="'+p.id+'|'+(c.qty-1)+'" aria-label="کاهش">'+icon("i-minus")+'</button><span>'+fa(c.qty)+'</span>'+
  '<button data-cq="'+p.id+'|'+(c.qty+1)+'"'+(c.qty>=p.stock?" disabled":"")+' aria-label="افزایش">'+icon("i-plus")+'</button></div>'+
  '<span class="price t-num">'+toman(eff(p)*c.qty)+'</span></div></div></div>'}).join("")+'</div>'+
 '<div class="summary">'+summaryCard(t,true)+
 '<button class="btn btn-primary btn-lg btn-block" style="margin-top:16px" id="tocheckout"'+(issues.length?" disabled":"")+'>ادامه و تکمیل خرید</button>'+
 '<button class="btn btn-quiet btn-block" style="margin-top:8px" data-go="home">ادامهٔ خرید</button></div></div>';
 var sugg=S.products.filter(function(p){return p.published&&p.stock>0&&!S.cart.some(function(c){return c.id===p.id})}).slice(0,4);
 if(sugg.length)h+='<section style="padding-bottom:64px"><h2 class="t-h2" style="margin-bottom:20px">شاید لازم داشته باشید</h2>'+
  '<div class="prod-grid">'+sugg.map(productCard).join("")+'</div></section>';
 return h+'</div>'}
function field(label,id,val,ph,type){
 var err=checkout.errs[id];
 return'<div class="field" style="flex:1"><label class="t-label" for="'+id+'">'+esc(label)+'</label>'+
 '<input class="input" id="'+id+'" type="'+(type||"text")+'" value="'+esc(val||"")+'" placeholder="'+esc(ph||"")+'"'+(err?' aria-invalid="true"':"")+'>'+
 (err?'<span class="hint hint-error">'+icon("i-alert")+esc(err)+'</span>':"")+'</div>'}
function validateStep(){
 checkout.errs={};var e=checkout.errs;
 function v(id){var el=document.getElementById(id);return el?el.value:""}
 function digits(s){return String(s).replace(/[۰-۹]/g,function(d){return FA.indexOf(d)})}
 if(checkout.step===1){
  checkout.customer={name:v("cname"),phone:v("cphone"),mail:v("cmail")};
  if(checkout.customer.name.trim().length<3)e.cname="نام را کامل وارد کنید";
  if(!/^0?9\d{9}$/.test(digits(checkout.customer.phone)))e.cphone="شمارهٔ موبایل معتبر نیست";
  if(checkout.customer.mail&&!/^\S+@\S+\.\S+$/.test(checkout.customer.mail))e.cmail="ایمیل معتبر نیست"}
 if(checkout.step===2){
  checkout.address={prov:v("cprov"),city:v("ccity"),line:v("cline"),zip:v("czip")};
  if(!checkout.address.prov.trim())e.cprov="لازم است";
  if(!checkout.address.city.trim())e.ccity="لازم است";
  if(checkout.address.line.trim().length<10)e.cline="نشانی را کامل‌تر بنویسید";
  if(!/^\d{10}$/.test(digits(checkout.address.zip)))e.czip="کد پستی باید ۱۰ رقم باشد";
  if(!Object.keys(e).length&&!S.addresses.some(function(a){return a.line===checkout.address.line})){S.addresses.push(checkout.address);save()}}
 return!Object.keys(e).length}
function viewCheckout(){
 if(!S.cart.length&&checkout.step<6)return'<div class="wrap section">'+
  emptyState("i-cart","سبد خالی است","برای تکمیل خرید ابتدا کالایی اضافه کنید.","بازگشت به فروشگاه",'data-go="home"')+'</div>';
 var t=totals(checkout.coupon,checkout.ship),st=checkout.step;
 var steps=["اطلاعات","نشانی","ارسال","بازبینی","پرداخت","تأیید"],body="";
 if(st===1)body='<div class="stack" style="gap:16px">'+
  field("نام و نام خانوادگی","cname",checkout.customer.name,"مثلاً مریم رضایی")+
  field("شمارهٔ موبایل","cphone",checkout.customer.phone,"۰۹xxxxxxxxx")+
  field("ایمیل (اختیاری)","cmail",checkout.customer.mail,"name@example.com")+
  '<label class="check"><input type="checkbox" checked><span>وضعیت سفارش را برایم اطلاع دهید</span></label></div>';
 if(st===2)body='<div class="stack" style="gap:16px">'+
  (S.addresses.length?'<div class="stack">'+S.addresses.map(function(a,i){
   return'<label class="radio-card'+(checkout.address.line===a.line?" on":"")+'"><input type="radio" name="addr" data-addr="'+i+'"'+(checkout.address.line===a.line?" checked":"")+'>'+
   '<span><b>'+esc(a.city)+'</b><span>'+esc(a.line)+'</span></span></label>'}).join("")+'</div><div class="divider"></div>':"")+
  '<div class="row row-2col">'+field("استان","cprov",checkout.address.prov,"تهران")+field("شهر","ccity",checkout.address.city,"تهران")+'</div>'+
  field("نشانی کامل","cline",checkout.address.line,"خیابان، کوچه، پلاک، واحد")+
  field("کد پستی","czip",checkout.address.zip,"۱۰ رقم")+'</div>';
 if(st===3)body='<div class="stack">'+SHIPPING.map(function(s){
  return'<label class="radio-card'+(checkout.ship===s.id?" on":"")+'"><input type="radio" name="ship" data-ship="'+s.id+'"'+(checkout.ship===s.id?" checked":"")+'>'+
  '<span style="flex:1"><b>'+esc(s.name)+'</b><span>'+esc(s.days)+'</span></span>'+
  '<span class="price t-num">'+(s.fee?toman(s.fee):"رایگان")+'</span></label>'}).join("")+
  (t.sub>=800000?'<p class="hint" style="color:var(--success)">با توجه به مبلغ سفارش، ارسال پستی رایگان محاسبه می‌شود.</p>':"")+'</div>';
 if(st===4)body='<div class="card"><div style="padding:14px 20px;border-bottom:1px solid var(--line-soft)"><b>کالاها</b></div>'+
  S.cart.map(function(c){var p=prod(c.id);
   return'<div class="line-item" style="padding:12px 20px"><div class="line-thumb" style="width:56px;height:56px">'+icon(p.icon)+'</div>'+
   '<div style="flex:1"><div style="font-weight:600;font-size:14.5px">'+esc(p.name)+'</div>'+
   '<span class="t-tiny">'+fa(c.qty)+' عدد × '+money(eff(p))+'</span></div>'+
   '<span class="price t-num">'+toman(eff(p)*c.qty)+'</span></div>'}).join("")+
  '<div style="padding:16px 20px;border-top:1px solid var(--line-soft)" class="stack">'+
  '<div class="between t-small"><span>گیرنده</span><b>'+esc(checkout.customer.name||"—")+' · '+fa(checkout.customer.phone||"")+'</b></div>'+
  '<div class="between t-small"><span>نشانی</span><b style="text-align:end;max-width:60%">'+esc(checkout.address.city||"")+'، '+esc(checkout.address.line||"—")+'</b></div>'+
  '<div class="between t-small"><span>روش ارسال</span><b>'+esc((SHIPPING.filter(function(s){return s.id===checkout.ship})[0]||{}).name)+'</b></div></div></div>';
 if(st===5){
  var liveGw=API&&API.live;                     /* live mode: real gateway flow */
  var sample=!liveGw||(API.health&&API.health.gateway==="sample");
  body='<div class="stack">'+
  '<label class="radio-card'+(checkout.method==="ok"?" on":"")+'"><input type="radio" name="pay" data-pay="ok"'+(checkout.method==="ok"?" checked":"")+'>'+
  '<span><b>درگاه پرداخت اینترنتی</b><span>'+(liveGw&&!sample?'انتقال به صفحهٔ امن بانک':'انتقال به صفحهٔ بانک (آزمایشی — پرداخت موفق)')+'</span></span></label>'+
  (sample?'<label class="radio-card'+(checkout.method==="fail"?" on":"")+'"><input type="radio" name="pay" data-pay="fail"'+(checkout.method==="fail"?" checked":"")+'>'+
  '<span><b>شبیه‌سازی پرداخت ناموفق</b><span>برای آزمودن مسیر خطا (فقط درگاه آزمایشی)</span></span></label>':'')+
  '<div class="card card-pad" style="background:var(--info-bg);border-color:rgba(47,100,120,.2)">'+
  '<div class="row" style="gap:10px;align-items:flex-start;flex-wrap:nowrap"><span style="color:var(--info)">'+icon("i-lock")+'</span>'+
  '<p class="t-small" style="color:var(--info);flex:1">'+(liveGw
    ?(sample?'درگاه آزمایشی فعال است؛ هیچ مبلغی دریافت نمی‌شود.':'پس از تأیید، به درگاه بانکی منتقل می‌شوید. اطلاعات کارت هرگز نزد ما ذخیره نمی‌شود و نتیجهٔ پرداخت فقط از سمت سرور تأیید می‌شود.')
    :'پرداخت شبیه‌سازی‌شده است؛ هیچ اطلاعات کارتی دریافت یا ذخیره نمی‌شود. در نسخهٔ واقعی تأیید تراکنش فقط سمت سرور و به‌صورت idempotent انجام می‌شود.')+'</p></div></div></div>';
 }
 if(st===6){
  var o=S.orders[0];
  return'<div class="wrap section" style="max-width:720px">'+(o&&o.status!=="پرداخت ناموفق"
   ?'<div class="state" style="border-style:solid;border-color:var(--green-soft);background:var(--surface)">'+
    '<i style="background:var(--green-soft);border-color:var(--green)"><span style="color:var(--green)">'+icon("i-check")+'</span></i>'+
    '<b class="t-h2">سفارش شما ثبت شد</b><p>شمارهٔ سفارش: '+esc(o.id)+' · مبلغ پرداخت‌شده: '+toman(o.total)+'</p>'+
    '<p class="t-tiny">کد پیگیری تراکنش: '+esc(o.txn.ref)+'</p>'+
    '<div class="row" style="justify-content:center;margin-top:12px"><button class="btn btn-primary" data-go="account" data-tab="orders">پیگیری سفارش</button>'+
    '<button class="btn btn-quiet" data-go="home">بازگشت به فروشگاه</button></div></div>'
   :'<div class="state" style="border-style:solid;border-color:rgba(166,58,46,.3);background:var(--error-bg)">'+
    '<i style="border-color:rgba(166,58,46,.3)"><span style="color:var(--error)">'+icon("i-alert")+'</span></i>'+
    '<b class="t-h2">پرداخت ناموفق بود</b><p>مبلغی از حساب شما کسر نشده است. سفارش '+esc(o?o.id:"")+' با وضعیت پرداخت ناموفق ثبت شد.</p>'+
    '<button class="btn btn-primary" id="retrypay">بازگرداندن کالاها به سبد و تلاش دوباره</button></div>')+'</div>'}
 return'<div class="wrap section"><div class="stepper">'+steps.map(function(s,i){
  return'<div class="'+(i+1===st?"on":i+1<st?"done":"")+'"><i>'+(i+1<st?icon("i-check"):fa(i+1))+'</i>'+s+'</div>'}).join("")+'</div>'+
 '<div class="two-col"><div class="card card-pad"><h2 class="t-h3" style="margin-bottom:20px">'+steps[st-1]+'</h2>'+body+
 '<div class="row" style="margin-top:24px;gap:8px;flex-wrap:nowrap">'+
 (st>1?'<button class="btn btn-quiet" id="cbback">بازگشت</button>':"")+
 '<button class="btn btn-primary" id="cbnext" style="flex:1">'+(st===5?"پرداخت و ثبت سفارش":"ادامه")+'</button></div></div>'+
 '<div class="summary">'+summaryCard(t,st<4)+'</div></div></div>'}
