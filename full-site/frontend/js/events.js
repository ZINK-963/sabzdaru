/* event delegation (click/change/submit), search box wiring, boot */

/* ═══ EVENT DELEGATION ═══ */
function $(id){return document.getElementById(id)}
function val(id){var e=$(id);return e?e.value.trim():""}
document.addEventListener("click",function(ev){
 var t=ev.target;
 function hit(a){return t.closest("["+a+"]")}
 var el;

 if(megaOpen&&!t.closest("#megacats")){megaOpen=false;renderChrome()}

 var closer=hit("data-close");
 if(closer&&!(closer.classList.contains("scrim")&&t.closest(".dialog"))){closeOverlay();if(R.view==="cat")render();return}   /* a click INSIDE a dialog must not close it (previously an inline stopPropagation, which also swallowed every dialog button) */

 el=hit("data-hero");if(el){heroSlide=(heroSlide+HERO_SLIDES.length+ +el.getAttribute("data-hero"))%HERO_SLIDES.length;render();return}
 el=hit("data-colscroll");if(el){var cs=$("collscroll");
  if(cs)cs.scrollBy({left:+el.getAttribute("data-colscroll")*320*(document.dir==="rtl"?-1:1),behavior:"smooth"});
  return}
 el=hit("data-herodot");if(el){heroSlide=+el.getAttribute("data-herodot");render();return}
 if(t.closest("#megatrigger")){megaOpen=!megaOpen;renderChrome();return}

 el=hit("data-go");
 if(el){var v=el.getAttribute("data-go"),id=el.getAttribute("data-id"),tab=el.getAttribute("data-tab");
  if(tab)R.params.tab=tab;
  if(v==="cat"&&id){plp={filters:{},sort:plp.sort,page:1,loading:true};closeOverlay();
   go("cat",{id:id});setTimeout(function(){plp.loading=false;render()},300);return}
  closeOverlay();go(v,id?{id:id}:{});return}

 el=hit("data-open");if(el){pdp={img:0,tab:"desc",qty:1};closeOverlay();go("product",{id:el.getAttribute("data-open")});return}
 el=hit("data-article");if(el){closeOverlay();go("article",{id:el.getAttribute("data-article")});return}

 el=hit("data-add");if(el){addToCart(el.getAttribute("data-add"),R.view==="product"?pdp.qty:1);
  if(R.view==="cart"||R.view==="checkout")render();return}
 el=hit("data-addmany");if(el){el.getAttribute("data-addmany").split(",").forEach(function(i){addToCart(i,1)});return}
 el=hit("data-addcol");if(el){var cid=el.getAttribute("data-addcol");
  collections().forEach(function(c){if(c.id===cid)c.ids.forEach(function(i){addToCart(i,1)})});return}

 el=hit("data-fav");if(el){var fid=el.getAttribute("data-fav");
  if(S.favs.indexOf(fid)>-1){S.favs=S.favs.filter(function(x){return x!==fid});toast("از علاقه‌مندی‌ها حذف شد")}
  else{S.favs.push(fid);toast("به علاقه‌مندی‌ها اضافه شد")}
  save();render();return}
 el=hit("data-cmp");if(el){var mid=el.getAttribute("data-cmp");
  if(S.compare.indexOf(mid)>-1){S.compare=S.compare.filter(function(x){return x!==mid});toast("از مقایسه حذف شد")}
  else if(S.compare.length>=3){toast("حداکثر سه کالا قابل مقایسه است","error");return}
  else{S.compare.push(mid);toast("به مقایسه اضافه شد")}
  save();render();return}
 if(t.closest("#clearcmp")){S.compare=[];save();render();return}
 el=hit("data-restock");if(el){var rp=prod(el.getAttribute("data-restock"));
  notify("اعلان موجودی ثبت شد","به‌محض موجود شدن «"+rp.name+"» خبرتان می‌کنیم.");
  toast("وقتی موجود شد خبرتان می‌کنیم");renderChrome();return}

 el=hit("data-tolist");if(el){var pid=el.getAttribute("data-tolist");
  dialog("افزودن به فهرست خرید",
   (S.lists.length?'<div class="stack">'+S.lists.map(function(l){
     return'<button class="radio-card" data-pick="'+l.id+'|'+pid+'"><span><b>'+esc(l.name)+'</b><span>'+fa(l.items.length)+' کالا</span></span></button>'}).join("")+'</div>'
    :'<p class="t-small">هنوز فهرستی نساخته‌اید.</p>')+
   '<div class="divider"></div><div class="field"><label class="t-label" for="nlname">یا فهرست تازه بسازید</label>'+
   '<div class="row" style="flex-wrap:nowrap;gap:8px"><input class="input" id="nlname" placeholder="نام فهرست">'+
   '<button class="btn btn-quiet" data-newlistwith="'+pid+'">بساز</button></div></div>');return}
 el=hit("data-pick");if(el){var pr=el.getAttribute("data-pick").split("|");
  S.lists.forEach(function(l){if(l.id===pr[0]&&l.items.indexOf(pr[1])<0)l.items.push(pr[1])});
  save();closeOverlay();toast("به فهرست اضافه شد");return}
 el=hit("data-newlistwith");if(el){var nn=val("nlname");
  if(!nn){toast("نام فهرست را بنویسید","error");return}
  S.lists.push({id:uid("l"),name:nn,items:[el.getAttribute("data-newlistwith")]});
  save();closeOverlay();toast("فهرست ساخته شد");return}

 /* PDP */
 el=hit("data-img");if(el){pdp.img=+el.getAttribute("data-img");render();return}
 el=hit("data-ptab");if(el){pdp.tab=el.getAttribute("data-ptab");render();return}
 el=hit("data-q");if(el){var pp=prod(R.params.id);
  pdp.qty=Math.max(1,Math.min(pp.stock,pdp.qty+ +el.getAttribute("data-q")));render();return}
 if(t.closest("#gmain")){t.closest("#gmain").classList.toggle("zoom");return}
 el=hit("data-demochip");if(el){el.setAttribute("aria-pressed",el.getAttribute("aria-pressed")==="true"?"false":"true");return}

 /* reviews */
 el=hit("data-review");if(el){var rid2=el.getAttribute("data-review");
  dialog("ثبت نظر",'<div class="stack" style="gap:14px">'+
   '<div class="field"><label class="t-label">امتیاز</label><div class="row">'+
   [1,2,3,4,5].map(function(s){return'<button class="chip" data-star="'+s+'" aria-pressed="'+(s===5)+'">'+fa(s)+'</button>'}).join("")+'</div></div>'+
   '<div class="field"><label class="t-label" for="rvby">نام شما</label><input class="input" id="rvby" value="'+esc(S.user?S.user.name:"")+'"></div>'+
   '<div class="field"><label class="t-label" for="rvtext">نظر شما</label><textarea class="textarea" id="rvtext" placeholder="تجربه‌تان از این محصول"></textarea>'+
   '<span class="hint">لطفاً ادعای درمانی ننویسید؛ نظرها پیش از انتشار بازبینی می‌شوند.</span></div></div>',
   '<button class="btn btn-primary" data-rvsave="'+rid2+'">ثبت</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 el=hit("data-star");if(el){document.querySelectorAll("[data-star]").forEach(function(b){b.setAttribute("aria-pressed",b===el)});return}
 el=hit("data-rvsave");if(el){var rpid=el.getAttribute("data-rvsave"),txt=val("rvtext"),by=val("rvby");
  if(!by){toast("نام را وارد کنید","error");return}
  if(txt.length<10){toast("متن نظر خیلی کوتاه است","error");return}
  S.reviews[rpid]=S.reviews[rpid]||[];
  if(S.reviews[rpid].some(function(r){return r.by===by})){toast("قبلاً برای این کالا نظر ثبت کرده‌اید","error");return}
  var sel=document.querySelector('[data-star][aria-pressed="true"]');
  S.reviews[rpid].unshift({id:uid("r"),by:by,stars:sel?+sel.getAttribute("data-star"):5,text:txt,helpful:0,
   verified:S.orders.some(function(o){return o.items.some(function(i){return i.pid===rpid})})});
  save();closeOverlay();toast("نظر ثبت شد و در صف بازبینی است");render();return}
 el=hit("data-helpful");if(el){var hid=el.getAttribute("data-helpful");
  Object.keys(S.reviews).forEach(function(k){S.reviews[k].forEach(function(r){if(r.id===hid)r.helpful=(r.helpful||0)+1})});
  save();render();return}

 /* cart & checkout */
 el=hit("data-cq");if(el){var cq=el.getAttribute("data-cq").split("|");setQty(cq[0],+cq[1]);return}
 el=hit("data-del");if(el){var did=el.getAttribute("data-del");
  S.cart=S.cart.filter(function(c){return c.id!==did});save();toast("کالا از سبد حذف شد");render();return}
 if(t.closest("#applycc")){checkout.coupon=val("cc");save();render();
  var tt=totals(checkout.coupon,checkout.ship);if(!tt.cErr&&checkout.coupon)toast("کد تخفیف اعمال شد");return}
 if(t.closest("#tocheckout")){checkout.step=1;go("checkout");return}
 if(t.closest("#cbback")){checkout.step--;render();return}
 if(t.closest("#cbnext")){
  if((checkout.step===1||checkout.step===2)&&!validateStep()){render();toast("لطفاً خطاها را برطرف کنید","error");return}
  if(checkout.step===5){
   var btn=$("cbnext");btn.innerHTML='<span class="spin"></span> در حال پرداخت';btn.disabled=true;
   setTimeout(function(){
    var r=placeOrder({coupon:checkout.coupon,ship:checkout.ship,customer:checkout.customer,address:checkout.address,method:checkout.method});
    if(r.err){toast(r.err,"error");checkout.step=4;render();return}
    checkout.step=6;checkout.coupon="";render()},900);return}
  checkout.step++;render();return}
 el=hit("data-addr");if(el){checkout.address=S.addresses[+el.getAttribute("data-addr")];render();return}
 el=hit("data-ship");if(el){checkout.ship=el.getAttribute("data-ship");render();return}
 el=hit("data-pay");if(el){checkout.method=el.getAttribute("data-pay");render();return}
 if(t.closest("#retrypay")){var o0=S.orders[0];
  o0.items.forEach(function(i){var p=prod(i.pid);if(p)p.stock+=i.qty;S.cart.push({id:i.pid,qty:i.qty})});
  S.orders.shift();checkout.step=5;checkout.method="ok";save();render();return}

 /* account */
 el=hit("data-atab");if(el){acc.tab=el.getAttribute("data-atab");render();return}

 if(t.closest("#req-otp")){requestOtpFlow();return}
 if(t.closest("#verify-otp")){verifyOtpFlow();return}
 if(t.closest("#otp-back")){login={step:1,phone:login.phone,loading:false,err:"",isNewUser:false,code:""};render();return}
 if(t.closest("#demo-login")){
  dialog("ورود در حالت نمایشی","<p class='t-small'>بدون بک‌اند واقعی، حساب شما فقط در همین مرورگر (localStorage) ذخیره می‌شود و با هیچ سرویس واقعی همگام نیست.</p>"+
   '<div class="field" style="margin-top:14px"><label class="t-label" for="demoname">نام</label><input class="input" id="demoname" placeholder="نام شما"></div>',
   '<button class="btn btn-primary" id="demologinok">ادامه</button><button class="btn btn-quiet" data-close="1">انصراف</button>');
  return}
 if(t.closest("#demologinok")){var dn=val("demoname");
  if(dn.length<2){toast("نام را وارد کنید","error");return}
  S.user={name:dn,mail:"",demo:true};save();closeOverlay();
  notify("خوش آمدید","حساب نمایشی شما (بدون بک‌اند) ساخته شد.");toast("خوش آمدید، "+dn);render();return}
 if(t.closest("#logout")){
  if(!S.user||!S.user.demo)API.logout(); // بدون انتظار برای پاسخ — خطای شبکه نباید مانع خروج محلی شود
  S.user=null;save();toast("از حساب خارج شدید");go("home");return}
 if(hit("data-newlist")){dialog("فهرست تازه",
  '<div class="field"><label class="t-label" for="lname2">نام فهرست</label><input class="input" id="lname2" placeholder="مثلاً ضروری‌های ماهانه"></div>',
  '<button class="btn btn-primary" id="savelist">ساختن</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 if(t.closest("#savelist")){var nl=val("lname2");if(!nl){toast("نام لازم است","error");return}
  S.lists.push({id:uid("l"),name:nl,items:[]});save();closeOverlay();render();toast("فهرست ساخته شد");return}
 el=hit("data-lrename");if(el){var lid=el.getAttribute("data-lrename"),lo=null;
  S.lists.forEach(function(l){if(l.id===lid)lo=l});
  dialog("تغییر نام فهرست",'<div class="field"><input class="input" id="lren" value="'+esc(lo.name)+'"></div>',
   '<button class="btn btn-primary" data-lrensave="'+lid+'">ذخیره</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 el=hit("data-lrensave");if(el){var lid2=el.getAttribute("data-lrensave"),nv=val("lren");
  S.lists.forEach(function(l){if(l.id===lid2&&nv)l.name=nv});save();closeOverlay();render();return}
 el=hit("data-ldel");if(el){var dl=el.getAttribute("data-ldel");
  S.lists=S.lists.filter(function(l){return l.id!==dl});save();render();toast("فهرست حذف شد");return}
 el=hit("data-lrm");if(el){var lr=el.getAttribute("data-lrm").split("|");
  S.lists.forEach(function(l){if(l.id===lr[0])l.items=l.items.filter(function(i){return i!==lr[1]})});save();render();return}
 el=hit("data-ladd");if(el){var la=el.getAttribute("data-ladd");
  S.lists.forEach(function(l){if(l.id===la)l.items.forEach(function(i){addToCart(i,1)})});return}
 if(hit("data-newroutine")){dialog("ساخت روتین",
  '<div class="field" style="margin-bottom:14px"><label class="t-label" for="rname">نام روتین</label>'+
  '<input class="input" id="rname" placeholder="مثلاً روتین صبح"></div>'+
  '<p class="t-label" style="margin-bottom:8px">محصولات را به ترتیب استفاده انتخاب کنید</p>'+
  '<div class="stack" style="gap:6px;max-height:300px;overflow:auto">'+
  S.products.filter(function(p){return p.cat==="skin"||p.cat==="hair"}).map(function(p){
   return'<label class="check" style="padding:8px;border:1px solid var(--line-soft);border-radius:8px">'+
   '<input type="checkbox" data-rstep="'+p.id+'"><span><b style="font-weight:600">'+esc(p.name)+'</b><br>'+
   '<span class="t-tiny">'+esc(p.variant)+'</span></span></label>'}).join("")+'</div>',
  '<button class="btn btn-primary" id="saveroutine">ذخیرهٔ روتین</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 if(t.closest("#saveroutine")){var rn=val("rname"),steps=[];
  document.querySelectorAll("[data-rstep]").forEach(function(i){if(i.checked)steps.push(i.getAttribute("data-rstep"))});
  if(!rn){toast("نام روتین را بنویسید","error");return}
  if(!steps.length){toast("حداقل یک محصول انتخاب کنید","error");return}
  S.routines.push({id:uid("rt"),name:rn,steps:steps});save();closeOverlay();render();toast("روتین ذخیره شد");return}
 el=hit("data-rdel");if(el){var rd=el.getAttribute("data-rdel");
  S.routines=S.routines.filter(function(r){return r.id!==rd});save();render();return}
 el=hit("data-radd");if(el){var ra=el.getAttribute("data-radd");
  S.routines.forEach(function(r){if(r.id===ra)r.steps.forEach(function(i){addToCart(i,1)})});return}
 el=hit("data-adel");if(el){S.addresses.splice(+el.getAttribute("data-adel"),1);save();render();toast("نشانی حذف شد");return}
 if(t.closest("#savesettings")){S.user.name=val("setname")||S.user.name;S.user.mail=val("setmail");
  document.querySelectorAll("[data-pref]").forEach(function(i){S.prefs[i.getAttribute("data-pref")]=i.checked});
  save();toast("تغییرات ذخیره شد");render();return}
 if(t.closest("#wipe")){dialog("حذف حساب",
  '<p class="t-small">همهٔ داده‌های این نسخهٔ نمایشی روی این مرورگر پاک می‌شود. این کار برگشت‌پذیر نیست.</p>',
  '<button class="btn btn-danger" id="wipeok">بله، پاک کن</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 if(t.closest("#wipeok")){try{localStorage.removeItem(KEY)}catch(e){}S=seed();save();closeOverlay();
  acc.tab="dash";go("home");toast("همهٔ داده‌ها پاک شد");return}
 if(hit("data-newticket")){dialog("تیکت تازه",'<div class="stack" style="gap:14px">'+
  '<div class="field"><label class="t-label" for="tsub">موضوع</label><input class="input" id="tsub" placeholder="خلاصهٔ مشکل"></div>'+
  '<div class="field"><label class="t-label" for="tcat">دسته</label><select class="select" id="tcat">'+
  ["سفارش","ارسال","مرجوعی","محصول","سایر"].map(function(x){return"<option>"+x+"</option>"}).join("")+'</select></div>'+
  '<div class="field"><label class="t-label" for="tpri">اولویت</label><select class="select" id="tpri"><option>عادی</option><option>بالا</option></select></div>'+
  '<div class="field"><label class="t-label" for="tmsg">توضیح</label><textarea class="textarea" id="tmsg"></textarea></div></div>',
  '<button class="btn btn-primary" id="savet">ارسال</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 if(t.closest("#savet")){var ts=val("tsub"),tm=val("tmsg");
  if(ts.length<3||tm.length<10){toast("موضوع و توضیح را کامل‌تر بنویسید","error");return}
  S.tickets.unshift({id:uid("tk"),subject:ts,cat:val("tcat")||"سایر",priority:val("tpri")||"عادی",
   status:"باز",at:now(),msgs:[{by:S.user?S.user.name:"مشتری",text:tm,at:now()}]});
  save();closeOverlay();render();toast("تیکت ثبت شد");return}
 el=hit("data-treply");if(el){dialog("پاسخ",'<textarea class="textarea" id="trtext" placeholder="پاسخ شما"></textarea>',
  '<button class="btn btn-primary" data-trsave="'+el.getAttribute("data-treply")+'">ارسال</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 el=hit("data-trsave");if(el){var tk=el.getAttribute("data-trsave"),tv=val("trtext");if(!tv)return;
  S.tickets.forEach(function(k){if(k.id===tk){k.msgs.push({by:S.user?S.user.name:"مشتری",text:tv,at:now()});k.status="باز"}});
  save();closeOverlay();render();return}
 el=hit("data-otrack");if(el){var oid=el.getAttribute("data-otrack"),oo=null;
  S.orders.forEach(function(x){if(x.id===oid)oo=x});
  var shipName=(SHIPPING.filter(function(s){return s.id===oo.ship})[0]||{}).name||"—";
  dialog("پیگیری سفارش "+oo.id,'<ul class="timeline">'+oo.history.map(function(hh){
   return'<li><i></i><div><b>'+esc(hh.to)+'</b><br><span class="t-tiny">'+esc(hh.by)+'</span></div><span class="t">'+esc(hh.at)+'</span></li>'}).join("")+'</ul>'+
   '<div class="divider"></div><div class="t-small">روش ارسال: '+esc(shipName)+'</div>'+
   (oo.txn?'<div class="t-tiny" style="margin-top:6px">کد پیگیری تراکنش: '+esc(oo.txn.ref)+'</div>':""));return}
 el=hit("data-ocancel");if(el){var oc=el.getAttribute("data-ocancel");
  S.orders.forEach(function(x){if(x.id===oc){
   x.items.forEach(function(i){var p=prod(i.pid);if(p){p.stock+=i.qty;move(p.id,i.qty,"لغو سفارش "+x.id)}});
   x.history.push({from:x.status,to:"لغو شده",by:"مشتری",at:now()});
   logAudit("لغو سفارش","سفارش "+x.id,x.status,"لغو شده");x.status="لغو شده"}});
  save();render();toast("سفارش لغو شد و موجودی بازگشت");return}
 el=hit("data-oreturn");if(el){var orr=el.getAttribute("data-oreturn");
  S.orders.forEach(function(x){if(x.id===orr){x.history.push({from:x.status,to:"درخواست مرجوعی",by:"مشتری",at:now()});
   x.status="درخواست مرجوعی"}});save();render();toast("درخواست مرجوعی ثبت شد");return}

 /* PLP */
 el=hit("data-rmf");if(el){var rf=el.getAttribute("data-rmf").split("|");
  plp.filters[rf[0]]=(plp.filters[rf[0]]||[]).filter(function(x){return x!==rf[1]});plp.page=1;render();return}
 if(hit("data-clearf")){plp.filters={};plp.page=1;closeOverlay();render();return}
 if(t.closest("#openfilters")){openFilterDrawer();return}
 el=hit("data-page");if(el){var pn=+el.getAttribute("data-page");
  if(R.view==="cat")plp.page=pn;else adm.page=pn;render();window.scrollTo({top:240});return}

 /* discovery */
 el=hit("data-disc");if(el){var dv=el.getAttribute("data-disc");
  if(disc.step===0)disc.cat=dv;else if(disc.step===1)disc.attr=dv;else disc.budget=dv;
  disc.step++;render();return}
 if(hit("data-discreset")){disc={step:0,cat:null,attr:null,budget:null};render();return}
 if(hit("data-discgo")){plp={filters:{},sort:"pop",page:1,loading:false};
  if(disc.attr){var da=disc.attr.split("|");plp.filters[da[0]]=[da[1]]}
  go("cat",{id:disc.cat});return}

 /* admin */
 el=hit("data-role");if(el){document.querySelectorAll(".radio-card").forEach(function(c){c.classList.remove("on")});
  el.closest(".radio-card").classList.add("on");return}
 if(t.closest("#adlogin")){var sr=document.querySelector("[data-role]:checked");
  if(!sr){toast("یک نقش انتخاب کنید","error");return}
  S.admin=sr.getAttribute("data-role");adm.tab="dash";save();
  logAudit("ورود به پنل","کاربر ادمین","—",ROLES[S.admin].name);render();
  toast("وارد پنل شدید: "+ROLES[S.admin].name);return}
 if(t.closest("#adlogout")){logAudit("خروج از پنل","کاربر ادمین",ROLES[S.admin].name,"—");
  S.admin=null;save();go("home");return}
 el=hit("data-adtab");if(el){adm.tab=el.getAttribute("data-adtab");adm.page=1;render();return}
 el=hit("data-pedit");if(el){var pe=el.getAttribute("data-pedit"),isNew=pe==="new";
  var p2=isNew?{name:"",variant:"",price:0,stock:0,cat:"skin",brand:"b1"}:prod(pe);
  dialog(isNew?"کالای تازه":"ویرایش کالا",'<div class="stack" style="gap:14px">'+
   '<div class="field"><label class="t-label" for="pn">نام</label><input class="input" id="pn" value="'+esc(p2.name)+'"></div>'+
   '<div class="field"><label class="t-label" for="pv">بسته‌بندی</label><input class="input" id="pv" value="'+esc(p2.variant)+'"></div>'+
   '<div class="row row-2col">'+
   '<div class="field" style="flex:1"><label class="t-label" for="pp">قیمت (تومان)</label><input class="input" id="pp" type="number" value="'+p2.price+'"></div>'+
   '<div class="field" style="flex:1"><label class="t-label" for="ps">موجودی</label><input class="input" id="ps" type="number" value="'+p2.stock+'"></div></div>'+
   '<div class="row row-2col">'+
   '<div class="field" style="flex:1"><label class="t-label" for="pc">دسته</label><select class="select" id="pc">'+
   CATS.map(function(c){return'<option value="'+c.id+'"'+(p2.cat===c.id?" selected":"")+'>'+c.name+'</option>'}).join("")+'</select></div>'+
   '<div class="field" style="flex:1"><label class="t-label" for="pb">برند</label><select class="select" id="pb">'+
   BRANDS.map(function(b){return'<option value="'+b.id+'"'+(p2.brand===b.id?" selected":"")+'>'+b.name+'</option>'}).join("")+'</select></div></div></div>',
   '<button class="btn btn-primary" data-psave="'+(isNew?"new":p2.id)+'">ذخیره</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 el=hit("data-psave");if(el){var target=el.getAttribute("data-psave");
  var nm=val("pn"),vr=val("pv"),pr2=+val("pp"),st2=+val("ps"),ct=val("pc"),br=val("pb");
  if(nm.length<2){toast("نام کالا را وارد کنید","error");return}
  if(!(pr2>0)){toast("قیمت باید بزرگ‌تر از صفر باشد","error");return}
  if(st2<0){toast("موجودی نمی‌تواند منفی باشد","error");return}
  if(target==="new"){
   var np=P({name:nm,variant:vr,price:pr2,stock:st2,cat:ct,brand:br,icon:catOf(ct).icon,attrs:{}});
   S.products.push(np);move(np.id,st2,"ثبت کالای تازه");logAudit("ایجاد کالا",nm,"—",toman(pr2));toast("کالا ساخته شد")}
  else{var pe2=prod(target);
   if(pe2.price!==pr2)logAudit("تغییر قیمت",pe2.name,toman(pe2.price),toman(pr2));
   if(pe2.stock!==st2){move(pe2.id,st2-pe2.stock,"اصلاح دستی انبار");logAudit("تغییر موجودی",pe2.name,fa(pe2.stock),fa(st2))}
   pe2.name=nm;pe2.variant=vr;pe2.price=pr2;pe2.stock=st2;pe2.cat=ct;pe2.brand=br;toast("تغییرات ذخیره شد")}
  save();closeOverlay();render();return}
 el=hit("data-ppub");if(el){var pu=prod(el.getAttribute("data-ppub"));pu.published=!pu.published;
  logAudit(pu.published?"انتشار کالا":"لغو انتشار",pu.name,!pu.published,pu.published);save();render();return}
 el=hit("data-pdel");if(el){var pd=prod(el.getAttribute("data-pdel"));
  dialog("حذف کالا",'<p class="t-small">«'+esc(pd.name)+'» حذف شود؟ سفارش‌های قبلی تغییر نمی‌کنند، چون اطلاعات کالا در خود سفارش ذخیره شده است.</p>',
   '<button class="btn btn-danger" data-pdelok="'+pd.id+'">حذف</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 el=hit("data-pdelok");if(el){var pk=prod(el.getAttribute("data-pdelok"));
  logAudit("حذف کالا",pk.name,"موجود","حذف‌شده");
  S.products=S.products.filter(function(x){return x.id!==pk.id});
  S.cart=S.cart.filter(function(c){return c.id!==pk.id});
  S.favs=S.favs.filter(function(f){return f!==pk.id});
  S.compare=S.compare.filter(function(f){return f!==pk.id});
  save();closeOverlay();render();toast("کالا حذف شد");return}
 el=hit("data-stk");if(el){var sk=el.getAttribute("data-stk").split("|"),sp=prod(sk[0]);
  var nn2=Math.max(0,sp.stock+ +sk[1]);if(nn2===sp.stock)return;
  move(sp.id,+sk[1],"اصلاح دستی انبار");logAudit("تغییر موجودی",sp.name,fa(sp.stock),fa(nn2));
  sp.stock=nn2;save();render();return}
 el=hit("data-ctoggle");if(el){var cc2=el.getAttribute("data-ctoggle");
  S.coupons.forEach(function(c){if(c.code===cc2){c.active=!c.active;logAudit("تغییر کد تخفیف",c.code,!c.active,c.active)}});
  save();render();return}
 if(t.closest("#newcoupon")){dialog("کد تخفیف تازه",'<div class="stack" style="gap:14px">'+
  '<div class="field"><label class="t-label" for="cco">کد</label><input class="input" id="cco" placeholder="SABZ20"></div>'+
  '<div class="row row-2col"><div class="field" style="flex:1"><label class="t-label" for="cty">نوع</label>'+
  '<select class="select" id="cty"><option value="percent">درصدی</option><option value="fixed">مبلغ ثابت</option></select></div>'+
  '<div class="field" style="flex:1"><label class="t-label" for="cva">مقدار</label><input class="input" id="cva" type="number" value="10"></div></div>'+
  '<div class="row row-2col"><div class="field" style="flex:1"><label class="t-label" for="cmi">حداقل خرید</label>'+
  '<input class="input" id="cmi" type="number" value="0"></div>'+
  '<div class="field" style="flex:1"><label class="t-label" for="cli">سقف استفاده</label><input class="input" id="cli" type="number" value="50"></div></div></div>',
  '<button class="btn btn-primary" id="csave">ساختن</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 if(t.closest("#csave")){var code=val("cco").toUpperCase();
  if(code.length<3){toast("کد را وارد کنید","error");return}
  if(S.coupons.some(function(c){return c.code===code})){toast("این کد قبلاً وجود دارد","error");return}
  S.coupons.push({code:code,type:val("cty"),value:+val("cva"),min:+val("cmi"),max:300000,uses:0,
   limit:+val("cli"),active:true,exp:"۱۴۰۵/۱۲/۲۹"});
  logAudit("ایجاد کد تخفیف",code,"—","فعال");save();closeOverlay();render();toast("کد ساخته شد");return}
 el=hit("data-rvdel");if(el){var rv=el.getAttribute("data-rvdel").split("|");
  S.reviews[rv[0]]=(S.reviews[rv[0]]||[]).filter(function(r){return r.id!==rv[1]});
  logAudit("حذف نظر","کالا "+rv[0],rv[1],"حذف‌شده");save();render();toast("نظر حذف شد");return}
 el=hit("data-tadmreply");if(el){dialog("پاسخ ادمین",
  '<textarea class="textarea" id="tatext" placeholder="پاسخ شما"></textarea>'+
  '<label class="check" style="margin-top:10px"><input type="checkbox" id="tanote"><span>یادداشت داخلی (برای مشتری نمایش داده نمی‌شود)</span></label>',
  '<button class="btn btn-primary" data-tasave="'+el.getAttribute("data-tadmreply")+'">ارسال</button><button class="btn btn-quiet" data-close="1">انصراف</button>');return}
 el=hit("data-tasave");if(el){var tid=el.getAttribute("data-tasave"),tv2=val("tatext");
  if(!tv2){toast("متن پاسخ خالی است","error");return}
  var internal=$("tanote").checked;
  S.tickets.forEach(function(k){if(k.id===tid){
   k.msgs.push({by:internal?"یادداشت داخلی":"پشتیبانی",text:tv2,at:now()});
   if(!internal){k.status="در انتظار مشتری";notify("پاسخ پشتیبانی","تیکت «"+k.subject+"» پاسخ داده شد.")}
   logAudit("پاسخ تیکت",k.subject,"—",internal?"یادداشت داخلی":"پاسخ به مشتری")}});
  save();closeOverlay();render();return}
});

document.addEventListener("change",function(ev){
 var t=ev.target;
 if(t.id==="sort"){plp.sort=t.value;plp.page=1;render();return}
 if(t.getAttribute("data-f")){var k=t.getAttribute("data-f"),v=t.value;
  plp.filters[k]=plp.filters[k]||[];
  plp.filters[k]=t.checked?plp.filters[k].concat([v]):plp.filters[k].filter(function(x){return x!==v});
  plp.page=1;
  var inDrawer=!!t.closest(".drawer");
  render();if(inDrawer)refreshFilterDrawer();return}
 if(t.getAttribute("data-ostatus")){var oid=t.getAttribute("data-ostatus");
  S.orders.forEach(function(o){if(o.id===oid){
   var from=o.status;o.status=t.value;
   o.history.push({from:from,to:t.value,by:ROLES[S.admin].name,at:now()});
   if(t.value==="لغو شده"||t.value==="مرجوع شده")o.items.forEach(function(i){
    var p=prod(i.pid);if(p){p.stock+=i.qty;move(p.id,i.qty,t.value+" · "+o.id)}});
   logAudit("تغییر وضعیت سفارش",o.id,from,t.value);
   notify("وضعیت سفارش "+o.id,"وضعیت به «"+t.value+"» تغییر کرد.")}});
  save();render();toast("وضعیت به‌روز شد");return}
 if(t.getAttribute("data-tstatus")){var tk2=t.getAttribute("data-tstatus");
  S.tickets.forEach(function(k){if(k.id===tk2){logAudit("تغییر وضعیت تیکت",k.subject,k.status,t.value);k.status=t.value}});
  save();render();return}
});

document.addEventListener("submit",function(ev){
 if(ev.target.id==="newsform"){ev.preventDefault();
  var v=val("newsmail"),err=$("newserr");
  if(!/^\S+@\S+\.\S+$/.test(v)){err.innerHTML=icon("i-alert")+"نشانی ایمیل معتبر نیست";err.classList.remove("hidden");return}
  err.classList.add("hidden");$("newsmail").value="";
  notify("اشتراک خبرنامه","اعلان موجودی برای "+v+" فعال شد.");toast("ثبت شد")}
});

/* search */
var qEl=$("q"),sEl=$("sugg");
qEl.addEventListener("input",function(){
 var v=qEl.value.trim();
 if(!v){sEl.innerHTML="";return}
 var r=searchAll(v);
 var hist=S.searchHistory.filter(function(h){return h.indexOf(v)>-1}).slice(0,2);
 var h='<div class="sugg">';
 if(!r.products.length&&!r.brands.length&&!r.cats.length&&!r.articles.length)
  h+='<div style="padding:18px;text-align:center" class="t-small">نتیجه‌ای پیدا نشد. املا را بررسی کنید.</div>';
 if(hist.length)h+='<h5>جست‌وجوهای اخیر</h5>'+hist.map(function(x){
  return'<a data-sq="'+esc(x)+'">'+icon("i-log")+esc(x)+'</a>'}).join("");
 if(r.cats.length)h+='<h5>دسته‌بندی</h5>'+r.cats.slice(0,3).map(function(c){
  return'<a data-go="cat" data-id="'+c.id+'">'+icon(c.icon)+esc(c.name)+'</a>'}).join("");
 if(r.brands.length)h+='<h5>برند</h5>'+r.brands.slice(0,3).map(function(b){
  return'<a data-go="brand" data-id="'+b.id+'">'+icon("i-tag")+esc(b.name)+'</a>'}).join("");
 if(r.products.length)h+='<h5>کالا</h5>'+r.products.slice(0,5).map(function(p){
  return'<a data-open="'+p.id+'">'+icon(p.icon)+esc(p.name)+'<small>'+money(eff(p))+'</small></a>'}).join("");
 if(r.articles.length)h+='<h5>مقاله</h5>'+r.articles.slice(0,2).map(function(a){
  return'<a data-article="'+a.id+'">'+icon("i-file")+esc(a.title)+'</a>'}).join("");
 sEl.innerHTML=h+'</div>'});
function runSearch(v){
 if(!v)return;
 if(S.searchHistory.indexOf(v)<0){S.searchHistory.unshift(v);S.searchHistory=S.searchHistory.slice(0,8);save()}
 sEl.innerHTML="";R.params.q=v;location.hash="#/search/"+encodeURIComponent(v)}
qEl.addEventListener("keydown",function(e){if(e.key==="Enter")runSearch(qEl.value.trim())});
document.addEventListener("click",function(e){
 if(!e.target.closest(".searchbox"))sEl.innerHTML="";
 var sq=e.target.closest("[data-sq]");
 if(sq){qEl.value=sq.getAttribute("data-sq");runSearch(sq.getAttribute("data-sq"))}});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){closeOverlay();sEl.innerHTML="";if(megaOpen){megaOpen=false;renderChrome()}}});
$("btn-theme").onclick=function(){
 var next=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
 document.documentElement.setAttribute("data-theme",next);
 try{localStorage.setItem("sd-theme",next)}catch(e){}
};
(function(){try{
 var saved=localStorage.getItem("sd-theme");
 if(saved==="dark")document.documentElement.setAttribute("data-theme","dark");
}catch(e){}})();
$("btn-cart").onclick=function(){go("cart")};
$("btn-fav").onclick=function(){R.params.tab="favs";acc.tab="favs";go("account")};
$("btn-cmp").onclick=function(){go("compare")};
$("btn-acc").onclick=function(){go("account")};

/* scroll-driven polish: header gains a shadow once the page scrolls under
   it, and a back-to-top button appears after scrolling a page or so down.
   rAF-throttled so this never runs more than once per frame. */
document.documentElement.classList.add("js-ready");
var headerEl=document.querySelector("header.site");
var toTopBtn=$("toTop");
var scrollTicking=false;
function onScrollPolish(){
 if(scrollTicking)return;scrollTicking=true;
 requestAnimationFrame(function(){
  var y=window.scrollY||document.documentElement.scrollTop||0;
  if(headerEl)headerEl.classList.toggle("scrolled",y>8);
  if(toTopBtn)toTopBtn.classList.toggle("show",y>480);
  scrollTicking=false;
 });
}
window.addEventListener("scroll",onScrollPolish,{passive:true});
if(toTopBtn)toTopBtn.onclick=function(){window.scrollTo({top:0,behavior:"smooth"})};

/* swipe the hero banner on touch screens (left = next, right = previous in RTL) */
var heroTouchX=null;
document.addEventListener("touchstart",function(e){
 var h=e.target.closest&&e.target.closest(".hero-panel");
 heroTouchX=h&&!e.target.closest("button")?e.touches[0].clientX:null;
},{passive:true});
document.addEventListener("touchend",function(e){
 if(heroTouchX==null)return;
 var dx=e.changedTouches[0].clientX-heroTouchX;heroTouchX=null;
 if(Math.abs(dx)>50){heroSlide=(heroSlide+HERO_SLIDES.length+(dx<0?1:-1))%HERO_SLIDES.length;render()}
},{passive:true});

bootApp();   /* live.js: detects a backend, then renders (live or demo mode) */
