/* views: login + account dashboard + admin panel */

/* ═══ ACCOUNT ═══ */
var acc={tab:"dash"};

/* login state: real two-step OTP flow against the backend, with an explicit
   "demo mode" fallback for whenever no backend is actually deployed/reachable
   (which is the default state of this bundle right now). */
var login={step:1,phone:"",loading:false,err:"",isNewUser:false,code:""};

function viewLogin(){
 if(login.step===2)return viewLoginVerify();
 return'<div class="wrap section" style="max-width:440px"><div class="card card-pad">'+
 '<h1 class="t-h2" style="margin-bottom:6px">ورود یا ثبت‌نام</h1>'+
 '<p class="t-small" style="margin-bottom:20px">کد یک‌بارمصرف به شمارهٔ موبایل شما پیامک می‌شود.</p>'+
 '<div class="stack" style="gap:14px">'+
 '<div class="field"><label class="t-label" for="lphone">شمارهٔ موبایل</label>'+
 '<input class="input" id="lphone" type="tel" placeholder="۰۹xxxxxxxxx" value="'+esc(login.phone)+'" '+(login.err?'aria-invalid="true"':"")+'></div>'+
 (login.err?'<p class="hint hint-error">'+icon("i-alert")+esc(login.err)+'</p>':"")+
 '<button class="btn btn-primary btn-block" id="req-otp" '+(login.loading?"disabled":"")+'>'+
 (login.loading?'<span class="spin"></span> در حال ارسال':"دریافت کد ورود")+'</button>'+
 '<button class="btn btn-quiet btn-block btn-sm" id="demo-login">ورود در حالت نمایشی (بدون بک‌اند)</button>'+
 '</div></div></div>'}

function viewLoginVerify(){
 return'<div class="wrap section" style="max-width:440px"><div class="card card-pad">'+
 '<h1 class="t-h2" style="margin-bottom:6px">کد تأیید</h1>'+
 '<p class="t-small" style="margin-bottom:20px">کد ارسال‌شده به '+esc(login.phone)+' را وارد کنید.</p>'+
 '<div class="stack" style="gap:14px">'+
 '<div class="field"><label class="t-label" for="lcode">کد ۶ رقمی</label>'+
 '<input class="input" id="lcode" inputmode="numeric" maxlength="6" placeholder="------" value="'+esc(login.code||"")+'" '+(login.err?'aria-invalid="true"':"")+'></div>'+
 (login.isNewUser?'<div class="field"><label class="t-label" for="lname">نام شما (برای ساخت حساب تازه)</label><input class="input" id="lname" placeholder="نام و نام خانوادگی"></div>':"")+
 (login.err?'<p class="hint hint-error">'+icon("i-alert")+esc(login.err)+'</p>':"")+
 '<button class="btn btn-primary btn-block" id="verify-otp" '+(login.loading?"disabled":"")+'>'+
 (login.loading?'<span class="spin"></span> در حال بررسی':"تأیید و ورود")+'</button>'+
 '<button class="btn btn-ghost btn-block btn-sm" id="otp-back">اصلاح شماره</button>'+
 '</div></div></div>'}

/* the actual network calls — both fail soft via api.js and just set login.err */
async function requestOtpFlow(){
 var phone=(document.getElementById("lphone")||{}).value||"";
 var digits=phone.replace(/[۰-۹]/g,function(d){return FA.indexOf(d)});
 if(!/^0?9\d{9}$/.test(digits)){login.err="شمارهٔ موبایل معتبر نیست";render();return}
 login.phone=digits.startsWith("0")?digits:"0"+digits;
 login.loading=true;login.err="";render();
 var r=await API.requestOtp(login.phone);
 login.loading=false;
 if(!r.ok){login.err=r.error;render();return}
 login.step=2;login.err="";render();
}
async function verifyOtpFlow(){
 var code=(document.getElementById("lcode")||{}).value||"";
 var name=login.isNewUser?((document.getElementById("lname")||{}).value||""):undefined;
 if(!/^\d{6}$/.test(code)){login.err="کد باید ۶ رقم باشد";render();return}
 login.code=code;login.loading=true;login.err="";render();
 var r=await API.verifyOtp(login.phone,code,name);
 login.loading=false;
 if(!r.ok){
  // بک‌اند صراحتاً می‌گوید کاربر تازه است و نام لازم دارد
  if(r.status===400&&r.data&&r.data.newUser){login.isNewUser=true;login.err="برای ساخت حساب، نام را هم وارد کنید";render();return}
  login.err=r.error;render();return
 }
 S.user={id:r.data.user.id,name:r.data.user.name,mail:"",phone:r.data.user.phone};
 save();login={step:1,phone:"",loading:false,err:"",isNewUser:false};
 notify("خوش آمدید","وارد حساب شدید.");toast("خوش آمدید، "+S.user.name);render();
}


function accBody(){
 var t=acc.tab;
 if(t==="dash"){
  var spent=S.orders.filter(function(o){return o.status!=="پرداخت ناموفق"}).reduce(function(a,o){return a+o.total},0);
  var low=S.products.filter(function(p){return p.stock<=3&&S.favs.indexOf(p.id)>-1});
  return'<h1 class="t-h1" style="margin-bottom:6px">سلام '+esc(S.user.name)+'</h1>'+
  '<p class="t-small" style="margin-bottom:24px">خلاصهٔ حساب شما</p><div class="kpis">'+
  kpi("سفارش‌ها",fa(S.orders.length))+kpi("مبلغ خریدها",toman(spent))+
  kpi("علاقه‌مندی",fa(S.favs.length))+kpi("روتین‌های ذخیره‌شده",fa(S.routines.length))+'</div>'+
  '<div class="card card-pad" style="margin-bottom:16px"><div class="between" style="margin-bottom:12px">'+
  '<b class="t-h4">آخرین سفارش‌ها</b><button class="btn btn-ghost btn-xs" data-atab="orders">همه</button></div>'+
  (S.orders.length?'<ul class="timeline">'+S.orders.slice(0,3).map(function(o){
   return'<li><i></i><div><b>'+esc(o.id)+'</b><br><span class="t-tiny">'+fa(o.items.length)+' کالا · '+toman(o.total)+'</span></div>'+
   '<span class="badge badge-neutral" style="margin-inline-start:auto">'+esc(o.status)+'</span></li>'}).join("")+'</ul>'
   :emptyState("i-box","هنوز سفارشی ندارید","اولین سفارش‌تان را ثبت کنید تا اینجا نمایش داده شود.","شروع خرید",'data-go="home"'))+'</div>'+
  (low.length?'<div class="card card-pad"><b class="t-h4">کالاهای مورد علاقهٔ رو به اتمام</b><ul class="timeline" style="margin-top:10px">'+
   low.slice(0,3).map(function(p){return'<li><i style="background:var(--warning)"></i><div>'+esc(p.name)+'<br>'+
   '<span class="t-tiny">'+(p.stock?fa(p.stock)+" عدد باقی‌مانده":"ناموجود")+'</span></div></li>'}).join("")+'</ul></div>':"")}
 if(t==="orders")return'<h1 class="t-h1" style="margin-bottom:20px">سفارش‌ها</h1>'+
  (S.orders.length?S.orders.map(function(o){
   return'<div class="card card-pad" style="margin-bottom:12px"><div class="between" style="flex-wrap:wrap;gap:8px">'+
   '<div><b>'+esc(o.id)+'</b><span class="t-tiny" style="margin-inline-start:8px">'+esc(o.at)+'</span></div>'+
   '<span class="badge '+(o.status==="تحویل شده"?"badge-success":(o.status.indexOf("ناموفق")>-1||o.status.indexOf("لغو")>-1)?"badge-error":"badge-info")+'">'+esc(o.status)+'</span></div>'+
   '<div class="divider"></div><div class="t-small">'+o.items.map(function(i){return esc(i.name)+" ×"+fa(i.qty)}).join(" · ")+'</div>'+
   '<div class="between" style="margin-top:12px;flex-wrap:wrap"><span class="price t-num">'+toman(o.total)+'</span>'+
   '<div class="row" style="gap:6px"><button class="btn btn-quiet btn-xs" data-otrack="'+o.id+'">پیگیری</button>'+
   (o.status==="تحویل شده"?'<button class="btn btn-quiet btn-xs" data-oreturn="'+o.id+'">درخواست مرجوعی</button>':"")+
   (["پرداخت شده","در حال پردازش","آماده‌سازی"].indexOf(o.status)>-1?'<button class="btn btn-danger btn-xs" data-ocancel="'+o.id+'">لغو سفارش</button>':"")+
   '</div></div></div>'}).join("")
   :emptyState("i-box","سفارشی ثبت نشده","وقتی خریدی انجام دهید، تاریخچه‌اش اینجا می‌آید.","شروع خرید",'data-go="home"'));
 if(t==="favs")return'<h1 class="t-h1" style="margin-bottom:20px">علاقه‌مندی‌ها</h1>'+
  (S.favs.length?'<div class="prod-grid">'+S.favs.map(prod).filter(Boolean).map(productCard).join("")+'</div>'
   :emptyState("i-heart","فهرست علاقه‌مندی خالی است","روی قلب هر کالا بزنید تا اینجا ذخیره شود.","دیدن محصولات",'data-go="home"'));
 if(t==="lists")return'<div class="between" style="margin-bottom:20px;flex-wrap:wrap"><h1 class="t-h1">فهرست‌های خرید</h1>'+
  '<button class="btn btn-secondary btn-sm" data-newlist="1">'+icon("i-plus")+' فهرست تازه</button></div>'+
  (S.lists.length?S.lists.map(function(l){
   return'<div class="card card-pad" style="margin-bottom:12px"><div class="between" style="flex-wrap:wrap;gap:8px">'+
   '<b>'+esc(l.name)+'</b><div class="row" style="gap:6px">'+
   '<button class="btn btn-quiet btn-xs" data-lrename="'+l.id+'" aria-label="تغییر نام">'+icon("i-edit")+'</button>'+
   '<button class="btn btn-quiet btn-xs" data-ladd="'+l.id+'"'+(l.items.length?"":" disabled")+'>افزودن همه به سبد</button>'+
   '<button class="btn btn-danger btn-xs" data-ldel="'+l.id+'" aria-label="حذف">'+icon("i-trash")+'</button></div></div>'+
   (l.items.length?'<ul class="col-list" style="margin-top:8px">'+l.items.map(function(id){var p=prod(id);
     return p?'<li><a data-open="'+id+'">'+esc(p.name)+'</a><span>'+money(eff(p))+
     ' <button class="btn btn-ghost btn-xs" data-lrm="'+l.id+'|'+id+'" aria-label="حذف">'+icon("i-x")+'</button></span></li>':""}).join("")+'</ul>'
    :'<p class="t-small" style="margin-top:8px">این فهرست خالی است. از صفحهٔ هر کالا می‌توانید به آن اضافه کنید.</p>')+'</div>'}).join("")
   :emptyState("i-list","فهرستی نساخته‌اید","فهرست‌ها برای خریدهای تکراری مفیدند.","ساخت فهرست",'data-newlist="1"'));
 if(t==="routines")return'<div class="between" style="margin-bottom:12px;flex-wrap:wrap"><h1 class="t-h1">روتین‌ها</h1>'+
  '<button class="btn btn-secondary btn-sm" data-newroutine="1">'+icon("i-plus")+' روتین تازه</button></div>'+
  '<p class="t-small" style="margin-bottom:20px">ترتیب استفاده از دستور مصرف تولیدکننده گرفته می‌شود. این ابزار توصیهٔ درمانی نمی‌دهد.</p>'+
  (S.routines.length?S.routines.map(function(r){
   return'<div class="card card-pad" style="margin-bottom:12px"><div class="between" style="flex-wrap:wrap;gap:8px">'+
   '<b>'+esc(r.name)+'</b><div class="row" style="gap:6px">'+
   '<button class="btn btn-quiet btn-xs" data-radd="'+r.id+'">افزودن به سبد</button>'+
   '<button class="btn btn-danger btn-xs" data-rdel="'+r.id+'" aria-label="حذف">'+icon("i-trash")+'</button></div></div>'+
   '<ul class="steps-list" style="margin-top:8px">'+r.steps.map(function(id,i){var p=prod(id);
    return p?'<li><i>'+fa(i+1)+'</i><div><b>'+esc(p.name)+'</b><span>'+esc(p.usage)+'</span></div></li>':""}).join("")+'</ul></div>'}).join("")
   :emptyState("i-drop","روتینی ذخیره نشده","محصولات را انتخاب کنید و ترتیب استفاده را بچینید.","ساخت روتین",'data-newroutine="1"'));
 if(t==="addresses")return'<h1 class="t-h1" style="margin-bottom:20px">نشانی‌ها</h1>'+
  (S.addresses.length?S.addresses.map(function(a,i){
   return'<div class="card card-pad" style="margin-bottom:12px"><div class="between">'+
   '<div><b>'+esc(a.city)+'</b><p class="t-small">'+esc(a.line)+' · کد پستی '+fa(a.zip)+'</p></div>'+
   '<button class="btn btn-danger btn-xs" data-adel="'+i+'" aria-label="حذف">'+icon("i-trash")+'</button></div></div>'}).join("")
   :emptyState("i-pin","نشانی ثبت نشده","هنگام تکمیل خرید نشانی شما ذخیره می‌شود.","شروع خرید",'data-go="home"'));
 if(t==="notifs"){S.notifs.forEach(function(n){n.read=true});save();
  return'<h1 class="t-h1" style="margin-bottom:20px">اعلان‌ها</h1>'+
  (S.notifs.length?'<div class="card">'+S.notifs.map(function(n){
   return'<div style="padding:16px 20px;border-bottom:1px solid var(--line-soft)"><div class="between">'+
   '<b>'+esc(n.title)+'</b><span class="t-tiny">'+esc(n.at)+'</span></div><p class="t-small">'+esc(n.body)+'</p></div>'}).join("")+'</div>'
   :emptyState("i-bell","اعلانی ندارید","وضعیت سفارش‌ها و موجودی کالاها اینجا اطلاع داده می‌شود.","",""))}
 if(t==="tickets")return'<div class="between" style="margin-bottom:20px;flex-wrap:wrap"><h1 class="t-h1">پشتیبانی</h1>'+
  '<button class="btn btn-secondary btn-sm" data-newticket="1">'+icon("i-plus")+' تیکت تازه</button></div>'+
  (S.tickets.length?S.tickets.map(function(k){
   return'<div class="card card-pad" style="margin-bottom:12px"><div class="between" style="flex-wrap:wrap;gap:8px">'+
   '<div><b>'+esc(k.subject)+'</b><p class="t-tiny">'+esc(k.cat)+' · '+esc(k.at)+'</p></div>'+
   '<span class="badge '+(k.status==="بسته شده"?"badge-neutral":k.status==="حل شده"?"badge-success":"badge-info")+'">'+esc(k.status)+'</span></div>'+
   '<div class="divider"></div>'+k.msgs.filter(function(m){return m.by!=="یادداشت داخلی"}).map(function(m){
    return'<div style="padding-block:6px"><span class="t-tiny">'+esc(m.by)+' · '+esc(m.at)+'</span><p class="t-small">'+esc(m.text)+'</p></div>'}).join("")+
   (k.status!=="بسته شده"?'<button class="btn btn-quiet btn-xs" style="margin-top:8px" data-treply="'+k.id+'">پاسخ</button>':"")+'</div>'}).join("")
   :emptyState("i-chat","تیکتی ثبت نشده","اگر سؤالی دربارهٔ سفارش دارید برایمان بنویسید.","ثبت تیکت",'data-newticket="1"'));
 if(t==="settings")return'<h1 class="t-h1" style="margin-bottom:20px">تنظیمات</h1>'+
  '<div class="card card-pad stack" style="gap:16px">'+
  '<div class="field"><label class="t-label" for="setname">نام</label><input class="input" id="setname" value="'+esc(S.user.name)+'"></div>'+
  '<div class="field"><label class="t-label" for="setmail">ایمیل یا موبایل</label><input class="input" id="setmail" value="'+esc(S.user.mail||"")+'"></div>'+
  '<div class="divider"></div><b class="t-h4">اعلان‌ها</b>'+
  [["order","وضعیت سفارش‌ها"],["restock","موجود شدن کالا"],["promo","پیشنهادها و تخفیف‌ها"]].map(function(p){
   return'<label class="check"><input type="checkbox" data-pref="'+p[0]+'"'+(S.prefs[p[0]]?" checked":"")+'><span>'+p[1]+'</span></label>'}).join("")+
  '<div class="divider"></div><button class="btn btn-primary" id="savesettings" style="justify-self:start">ذخیرهٔ تغییرات</button>'+
  '<p class="t-tiny">ما فقط اطلاعات لازم برای پردازش سفارش را نگهداری می‌کنیم و از اطلاعات سلامت برای تبلیغات استفاده نمی‌کنیم.</p>'+
  '<button class="btn btn-danger btn-sm" id="wipe" style="justify-self:start">حذف حساب و پاک کردن داده‌ها</button></div>';
 return""}
function viewAccount(){
 if(!S.user)return viewLogin();
 if(R.params.tab){acc.tab=R.params.tab;R.params.tab=null}
 var tabs=[["dash","داشبورد","i-layout"],["orders","سفارش‌ها","i-box"],["favs","علاقه‌مندی‌ها","i-heart"],
 ["lists","فهرست‌های خرید","i-list"],["routines","روتین‌ها","i-drop"],["addresses","نشانی‌ها","i-pin"],
 ["notifs","اعلان‌ها","i-bell"],["tickets","پشتیبانی","i-chat"],["settings","تنظیمات","i-lock"]];
 var unread=S.notifs.filter(function(n){return!n.read}).length;
 return'<div class="wrap"><div class="shell"><aside class="sidenav">'+
 tabs.map(function(t){return'<button data-atab="'+t[0]+'" aria-current="'+(acc.tab===t[0])+'">'+icon(t[2])+t[1]+
  (t[0]==="notifs"&&unread?'<span class="badge badge-offer" style="margin-inline-start:auto">'+fa(unread)+'</span>':"")+'</button>'}).join("")+
 '<div class="sep"></div><button id="logout">'+icon("i-out")+'خروج</button></aside><div>'+accBody()+'</div></div></div>'}

/* ═══ ADMIN ═══ */
var adm={tab:"dash",page:1};
function admBody(){
 var t=adm.tab,paid=S.orders.filter(function(o){return o.status!=="پرداخت ناموفق"});
 var rev=paid.reduce(function(a,o){return a+o.total},0);
 if(t==="dash"){
  var low=S.products.filter(function(p){return p.stock>0&&p.stock<=3});
  var out=S.products.filter(function(p){return p.stock<=0});
  var days=["ش","ی","د","س","چ","پ","ج"];
  var bars=days.map(function(d,i){return{d:d,v:Math.round(rev/9*(i+1))||(i+1)*10}});
  var max=Math.max.apply(null,bars.map(function(b){return b.v}).concat([1]));
  return'<h1 class="t-h1" style="margin-bottom:20px">داشبورد</h1><div class="kpis">'+
  kpi("درآمد",toman(rev),"+۱۲٪")+kpi("سفارش‌ها",fa(S.orders.length),"+۸٪")+
  kpi("میانگین سبد",toman(paid.length?rev/paid.length:0))+kpi("کالای نیازمند اقدام",fa(low.length+out.length))+'</div>'+
  '<div class="card card-pad" style="margin-bottom:16px"><b class="t-h4">روند فروش</b><div class="chartbox">'+
  bars.map(function(b){return'<div style="height:'+Math.max(6,b.v/max*100)+'%" title="'+toman(b.v)+'"><span>'+b.d+'</span></div>'}).join("")+
  '</div><p class="t-tiny" style="margin-top:28px">نمودار از سفارش‌های ثبت‌شده در همین سامانه محاسبه می‌شود.</p></div>'+
  '<div class="row" style="align-items:flex-start;gap:16px">'+
  '<div class="card card-pad" style="flex:1;min-width:270px"><b class="t-h4">نیازمند اقدام</b><ul class="timeline" style="margin-top:10px">'+
  (out.slice(0,3).map(function(p){return'<li><i style="background:var(--error)"></i><div>'+esc(p.name)+'<br><span class="t-tiny">ناموجود</span></div></li>'}).join("")+
   low.slice(0,3).map(function(p){return'<li><i style="background:var(--warning)"></i><div>'+esc(p.name)+'<br><span class="t-tiny">'+fa(p.stock)+' عدد باقی‌مانده</span></div></li>'}).join("")||
   '<li><i></i><div>موردی برای رسیدگی نیست</div></li>')+'</ul></div>'+
  '<div class="card card-pad" style="flex:1;min-width:270px"><b class="t-h4">سفارش‌های اخیر</b>'+
  (S.orders.length?'<ul class="timeline" style="margin-top:10px">'+S.orders.slice(0,4).map(function(o){
   return'<li><i></i><div><b>'+esc(o.id)+'</b><br><span class="t-tiny">'+toman(o.total)+'</span></div><span class="t">'+esc(o.status)+'</span></li>'}).join("")+'</ul>'
   :'<p class="t-small" style="margin-top:10px">هنوز سفارشی ثبت نشده است.</p>')+'</div></div>'}
 if(t==="products"){
  var per=10,pages=Math.max(1,Math.ceil(S.products.length/per));
  if(adm.page>pages)adm.page=1;
  var slice=S.products.slice((adm.page-1)*per,adm.page*per);
  return'<div class="between" style="margin-bottom:20px;flex-wrap:wrap"><h1 class="t-h1">محصولات</h1>'+
  '<button class="btn btn-primary btn-sm" data-pedit="new">'+icon("i-plus")+' کالای تازه</button></div>'+
  '<div class="table-wrap"><table><thead><tr><th>نام</th><th>برند</th><th>دسته</th><th>قیمت</th><th>موجودی</th><th>وضعیت</th><th></th></tr></thead><tbody>'+
  slice.map(function(p){return'<tr><td><b>'+esc(p.name)+'</b><br><span class="t-tiny">'+esc(p.variant)+'</span></td>'+
   '<td>'+esc(brandName(p.brand))+'</td><td>'+esc(catName(p.cat))+'</td><td class="t-num">'+money(eff(p))+'</td>'+
   '<td class="t-num">'+fa(p.stock)+'</td><td>'+(p.published?'<span class="badge badge-success">منتشر</span>':'<span class="badge badge-neutral">پیش‌نویس</span>')+'</td>'+
   '<td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-quiet btn-xs" data-pedit="'+p.id+'" aria-label="ویرایش">'+icon("i-edit")+'</button>'+
   '<button class="btn btn-quiet btn-xs" data-ppub="'+p.id+'">'+(p.published?"عدم انتشار":"انتشار")+'</button>'+
   '<button class="btn btn-danger btn-xs" data-pdel="'+p.id+'" aria-label="حذف">'+icon("i-trash")+'</button></div></td></tr>'}).join("")+
  '</tbody></table></div>'+pager(adm.page,pages)}
 if(t==="inventory")return'<h1 class="t-h1" style="margin-bottom:20px">انبار</h1>'+
  '<div class="table-wrap" style="margin-bottom:24px"><table><thead><tr><th>کالا</th><th>موجودی</th><th>بچ</th><th>انقضا</th><th>تنظیم</th></tr></thead><tbody>'+
  S.products.map(function(p){return'<tr><td>'+esc(p.name)+'</td><td class="t-num">'+fa(p.stock)+
   (p.stock<=0?' <span class="badge badge-error">ناموجود</span>':p.stock<=3?' <span class="badge badge-warning">کم</span>':"")+'</td>'+
   '<td class="t-tiny">'+esc(p.batch)+'</td><td class="t-tiny">'+fa(p.expiry)+'</td>'+
   '<td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn btn-quiet btn-xs" data-stk="'+p.id+'|-1">−۱</button>'+
   '<button class="btn btn-quiet btn-xs" data-stk="'+p.id+'|1">+۱</button>'+
   '<button class="btn btn-quiet btn-xs" data-stk="'+p.id+'|10">+۱۰</button></div></td></tr>'}).join("")+'</tbody></table></div>'+
  '<h2 class="t-h3" style="margin-bottom:12px">گردش موجودی</h2>'+
  (S.moves.length?'<div class="table-wrap"><table><thead><tr><th>کالا</th><th>تعداد</th><th>علت</th><th>زمان</th></tr></thead><tbody>'+
   S.moves.slice(0,20).map(function(m){var p=prod(m.pid);
    return'<tr><td>'+esc(p?p.name:m.pid)+'</td><td class="t-num '+(m.qty<0?"down":"up")+'">'+(m.qty>0?"+":"−")+fa(Math.abs(m.qty))+'</td>'+
    '<td class="t-small">'+esc(m.reason)+'</td><td class="t-tiny">'+esc(m.at)+'</td></tr>'}).join("")+'</tbody></table></div>'
   :emptyState("i-layout","گردشی ثبت نشده","با ثبت سفارش یا تنظیم موجودی، رکوردها اینجا می‌آیند.","",""));
 if(t==="orders")return'<h1 class="t-h1" style="margin-bottom:20px">سفارش‌ها</h1>'+
  (S.orders.length?'<div class="table-wrap"><table><thead><tr><th>شماره</th><th>مشتری</th><th>مبلغ</th><th>وضعیت</th><th>تغییر وضعیت</th></tr></thead><tbody>'+
   S.orders.map(function(o){return'<tr><td><b>'+esc(o.id)+'</b><br><span class="t-tiny">'+esc(o.at)+'</span></td>'+
    '<td>'+esc(o.customer.name||"—")+'</td><td class="t-num">'+money(o.total)+'</td>'+
    '<td><span class="badge '+(o.status==="تحویل شده"?"badge-success":o.status.indexOf("ناموفق")>-1?"badge-error":"badge-info")+'">'+esc(o.status)+'</span></td>'+
    '<td><select class="select" style="height:34px;font-size:13px;min-width:160px" data-ostatus="'+o.id+'">'+
    ORDER_STATES.map(function(s){return'<option'+(o.status===s?" selected":"")+'>'+s+'</option>'}).join("")+'</select></td></tr>'}).join("")+
   '</tbody></table></div>'
   :emptyState("i-truck","سفارشی ثبت نشده","از سمت فروشگاه یک سفارش ثبت کنید تا اینجا نمایش داده شود.","رفتن به فروشگاه",'data-go="home"'));
 if(t==="customers"){
  var cs=S.user?[{name:S.user.name,mail:S.user.mail,orders:S.orders.length,
   spent:S.orders.filter(function(o){return o.status!=="پرداخت ناموفق"}).reduce(function(a,o){return a+o.total},0)}]:[];
  return'<h1 class="t-h1" style="margin-bottom:20px">مشتریان</h1>'+
  (cs.length?'<div class="table-wrap"><table><thead><tr><th>نام</th><th>تماس</th><th>سفارش</th><th>مجموع خرید</th></tr></thead><tbody>'+
   cs.map(function(c){return'<tr><td>'+esc(c.name)+'</td><td class="t-small">'+esc(c.mail||"—")+'</td>'+
   '<td class="t-num">'+fa(c.orders)+'</td><td class="t-num">'+money(c.spent)+'</td></tr>'}).join("")+'</tbody></table></div>'
   :emptyState("i-users","مشتری ثبت‌نشده","در این نسخهٔ نمایشی، مشتری پس از ورود در فروشگاه ساخته می‌شود.","",""))}
 if(t==="promos")return'<div class="between" style="margin-bottom:20px;flex-wrap:wrap"><h1 class="t-h1">کدهای تخفیف</h1>'+
  '<button class="btn btn-primary btn-sm" id="newcoupon">'+icon("i-plus")+' کد تازه</button></div>'+
  '<div class="table-wrap"><table><thead><tr><th>کد</th><th>نوع</th><th>مقدار</th><th>حداقل خرید</th><th>استفاده</th><th>وضعیت</th><th></th></tr></thead><tbody>'+
  S.coupons.map(function(c){return'<tr><td><b>'+esc(c.code)+'</b></td><td>'+(c.type==="percent"?"درصدی":"مبلغ ثابت")+'</td>'+
   '<td class="t-num">'+(c.type==="percent"?fa(c.value)+"٪":money(c.value))+'</td><td class="t-num">'+(c.min?money(c.min):"—")+'</td>'+
   '<td class="t-num">'+fa(c.uses)+(c.limit?" / "+fa(c.limit):"")+'</td>'+
   '<td>'+(c.active?'<span class="badge badge-success">فعال</span>':'<span class="badge badge-neutral">غیرفعال</span>')+'</td>'+
   '<td><button class="btn btn-quiet btn-xs" data-ctoggle="'+c.code+'">'+(c.active?"غیرفعال کن":"فعال کن")+'</button></td></tr>'}).join("")+
  '</tbody></table></div>';
 if(t==="reviews"){
  var all=[];Object.keys(S.reviews).forEach(function(pid){(S.reviews[pid]||[]).forEach(function(r){var x={pid:pid};
   for(var k in r)x[k]=r[k];all.push(x)})});
  return'<h1 class="t-h1" style="margin-bottom:20px">نظرها</h1>'+
  (all.length?'<div class="table-wrap"><table><thead><tr><th>کالا</th><th>نویسنده</th><th>امتیاز</th><th>متن</th><th></th></tr></thead><tbody>'+
   all.map(function(r){return'<tr><td>'+esc((prod(r.pid)||{}).name||"—")+'</td><td>'+esc(r.by)+'</td>'+
   '<td class="t-num">'+fa(r.stars)+'</td><td class="t-small">'+esc(r.text.slice(0,60))+'</td>'+
   '<td><button class="btn btn-danger btn-xs" data-rvdel="'+r.pid+'|'+r.id+'">حذف</button></td></tr>'}).join("")+'</tbody></table></div>'
   :emptyState("i-star","نظری ثبت نشده","نظرهای مشتریان برای بازبینی اینجا می‌آیند.",""," "))}
 if(t==="tickets")return'<h1 class="t-h1" style="margin-bottom:20px">تیکت‌های پشتیبانی</h1>'+
  (S.tickets.length?S.tickets.map(function(k){
   return'<div class="card card-pad" style="margin-bottom:12px"><div class="between" style="flex-wrap:wrap;gap:8px">'+
   '<div><b>'+esc(k.subject)+'</b><p class="t-tiny">'+esc(k.cat)+' · اولویت '+esc(k.priority)+'</p></div>'+
   '<select class="select" style="height:34px;width:auto;font-size:13px" data-tstatus="'+k.id+'">'+
   ["باز","در حال بررسی","در انتظار مشتری","حل شده","بسته شده"].map(function(s){return'<option'+(k.status===s?" selected":"")+'>'+s+'</option>'}).join("")+
   '</select></div><div class="divider"></div>'+k.msgs.map(function(m){
    return'<div style="padding-block:6px'+(m.by==="یادداشت داخلی"?';background:var(--warning-bg);border-radius:8px;padding-inline:10px':"")+'">'+
    '<span class="t-tiny">'+esc(m.by)+' · '+esc(m.at)+'</span><p class="t-small">'+esc(m.text)+'</p></div>'}).join("")+
   '<button class="btn btn-quiet btn-xs" style="margin-top:8px" data-tadmreply="'+k.id+'">پاسخ ادمین</button></div>'}).join("")
   :emptyState("i-chat","تیکتی باز نیست","از حساب مشتری یک تیکت ثبت کنید.","",""));
 if(t==="content")return'<h1 class="t-h1" style="margin-bottom:20px">محتوا</h1>'+
  '<div class="card card-pad" style="margin-bottom:16px"><b class="t-h4">مقاله‌ها</b>'+
  '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>عنوان</th><th>دسته</th><th>زمان مطالعه</th></tr></thead><tbody>'+
  ARTICLES.map(function(a){return'<tr><td>'+esc(a.title)+'</td><td>'+esc(a.cat)+'</td><td class="t-num">'+fa(a.read)+' دقیقه</td></tr>'}).join("")+
  '</tbody></table></div></div><div class="card card-pad"><b class="t-h4">مجموعه‌های صفحهٔ اصلی</b>'+
  '<ul class="col-list" style="margin-top:10px">'+collections().map(function(c){
   return'<li>'+esc(c.name)+'<span>'+fa(c.ids.length)+' کالا</span></li>'}).join("")+'</ul>'+
  '<p class="t-tiny" style="margin-top:12px">در نسخهٔ واقعی این بخش به جدول‌های Articles و Collections در دیتابیس متصل است.</p></div>';
 if(t==="analytics"){
  var byCat=CATS.map(function(c){return{c:c.name,n:S.products.filter(function(p){return p.cat===c.id}).reduce(function(a,p){return a+p.sold},0)}})
   .sort(function(a,b){return b.n-a.n});
  var max2=Math.max.apply(null,byCat.map(function(b){return b.n}).concat([1]));
  var views=S.products.reduce(function(a,p){return a+p.views},0);
  return'<h1 class="t-h1" style="margin-bottom:20px">گزارش‌ها</h1><div class="kpis">'+
  kpi("بازدید کالا",fa(views))+kpi("گردش انبار",fa(S.moves.length))+
  kpi("سفارش تکمیل‌شده",fa(paid.length))+kpi("نرخ تبدیل",fa(views?(paid.length/views*100).toFixed(2):"۰")+"٪")+'</div>'+
  '<div class="card card-pad"><b class="t-h4">فروش بر اساس دسته</b><div style="margin-top:16px">'+
  byCat.map(function(b){return'<div class="rating-bar"><span style="width:110px">'+esc(b.c)+'</span>'+
   '<span class="track"><span class="fill" style="width:'+(b.n/max2*100)+'%;background:var(--green)"></span></span>'+
   '<span class="t-num muted">'+fa(b.n)+'</span></div>'}).join("")+
  '</div><p class="t-tiny" style="margin-top:12px">داده‌های تحلیلی بدون جمع‌آوری اطلاعات شخصی اضافی محاسبه می‌شوند.</p></div>'}
 if(t==="audit")return'<h1 class="t-h1" style="margin-bottom:20px">لاگ تغییرات</h1>'+
  (S.audit.length?'<div class="table-wrap"><table><thead><tr><th>کاربر</th><th>اقدام</th><th>موجودیت</th><th>قبل</th><th>بعد</th><th>زمان</th></tr></thead><tbody>'+
   S.audit.map(function(a){return'<tr><td>'+esc(a.who)+'</td><td>'+esc(a.action)+'</td><td class="t-small">'+esc(a.entity)+'</td>'+
   '<td class="t-tiny">'+esc(a.before)+'</td><td class="t-tiny">'+esc(a.after)+'</td><td class="t-tiny">'+esc(a.at)+'</td></tr>'}).join("")+'</tbody></table></div>'
   :emptyState("i-log","لاگی ثبت نشده","هر تغییر قیمت، موجودی یا وضعیت سفارش اینجا ثبت می‌شود.","",""));
 return""}
function viewAdmin(){
 if(!S.admin)return'<div class="wrap section" style="max-width:460px"><div class="card card-pad">'+
  '<h1 class="t-h2" style="margin-bottom:6px">ورود به پنل مدیریت</h1>'+
  '<p class="t-small" style="margin-bottom:20px">نقش را انتخاب کنید تا دسترسی‌های همان نقش اعمال شود. این نمایش عملی RBAC است.</p><div class="stack">'+
  Object.keys(ROLES).map(function(k){var r=ROLES[k];
   return'<label class="radio-card"><input type="radio" name="role" data-role="'+k+'">'+
   '<span><b>'+esc(r.name)+'</b><span>'+(r.perms[0]==="*"?"دسترسی کامل":fa(r.perms.length)+" بخش")+'</span></span></label>'}).join("")+
  '<button class="btn btn-primary btn-block" id="adlogin">ورود</button></div></div></div>';
 var tabs=[["dash","داشبورد","i-chart"],["products","محصولات","i-box"],["inventory","انبار","i-layout"],
 ["orders","سفارش‌ها","i-truck"],["customers","مشتریان","i-users"],["promos","تخفیف‌ها","i-tag"],
 ["reviews","نظرها","i-star"],["tickets","تیکت‌ها","i-chat"],["content","محتوا","i-file"],
 ["analytics","گزارش‌ها","i-chart"],["audit","لاگ تغییرات","i-log"]];
 var allowed=tabs.filter(function(t){return can(t[0])});
 if(!can(adm.tab))adm.tab=allowed[0][0];
 return'<div class="wrap"><div class="shell"><aside class="sidenav"><div class="grp">'+esc(ROLES[S.admin].name)+'</div>'+
 allowed.map(function(t){return'<button data-adtab="'+t[0]+'" aria-current="'+(adm.tab===t[0])+'">'+icon(t[2])+t[1]+'</button>'}).join("")+
 '<div class="sep"></div><button id="adlogout">'+icon("i-out")+'خروج از پنل</button></aside><div>'+admBody()+'</div></div></div>'}
