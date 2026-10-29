/* ============================================================
   DATA LAYER — demo catalog. All brands, prices, reviews are
   INVENTED placeholder data (marked mock:true throughout).
   Real content should come from GET /api/products once the
   backend is deployed — see api.js.
   ============================================================ */

"use strict";
/* ═══ DATA LAYER — mirrors the relational schema in ARCHITECTURE.md.
   All brands, prices, reviews are INVENTED demo data. No real medical claims. ═══ */
var KEY="sabzdaru.v2";
var CATS=[
{id:"skin",name:"مراقبت پوست",icon:"i-drop",filters:["skinType","form","spf","size","brand","feature"]},
{id:"hair",name:"مراقبت مو",icon:"i-bottle",filters:["hairType","scalp","form","size","brand"]},
{id:"supp",name:"ویتامین و مکمل",icon:"i-pill",filters:["form","pack","brand","feature"]},
{id:"hygiene",name:"بهداشت شخصی",icon:"i-tooth",filters:["form","size","brand"]},
{id:"baby",name:"مادر و کودک",icon:"i-baby",filters:["age","form","size","brand"]},
{id:"device",name:"تجهیزات پزشکی",icon:"i-device",filters:["deviceType","warranty","brand"]},
{id:"daily",name:"سلامت روزمره",icon:"i-shield",filters:["form","brand"]},
{id:"sleep",name:"آرامش و خواب",icon:"i-moon",filters:["form","brand"]}];
var FD={
skinType:{label:"نوع پوست",opts:["خشک","چرب","مختلط","حساس","معمولی"]},
hairType:{label:"نوع مو",opts:["خشک","چرب","رنگ‌شده","آسیب‌دیده","معمولی"]},
scalp:{label:"پوست سر",opts:["حساس","شوره‌دار","معمولی"]},
form:{label:"فرم محصول",opts:["کرم","ژل","سرم","لوسیون","قرص","کپسول","اسپری","بسته"]},
spf:{label:"SPF",opts:["۳۰","۵۰","۵۰+"]},
size:{label:"حجم / اندازه",opts:["زیر ۵۰","۵۰ تا ۲۰۰","بالای ۲۰۰"]},
pack:{label:"تعداد بسته",opts:["۳۰ عددی","۶۰ عددی","۹۰ عددی"]},
age:{label:"ردهٔ سنی",opts:["نوزاد","۶ ماه به بالا","۲ سال به بالا","مادر"]},
deviceType:{label:"نوع دستگاه",opts:["فشارسنج","تب‌سنج","گلوکومتر"]},
warranty:{label:"گارانتی",opts:["۱ ساله","۲ ساله"]},
brand:{label:"برند",opts:[]},
feature:{label:"ویژگی درج‌شده",opts:["بدون عطر","بدون الکل","وگان","مناسب پوست حساس","غیرکومدون‌زا"]}};
var BRANDS=[
{id:"b1",name:"سِروالیا",desc:"برند نمونهٔ مراقبت پوست. تمام اطلاعات این برند ساختگی است."},
{id:"b2",name:"هلیودرم",desc:"برند نمونهٔ ضدآفتاب و مراقبت روزانه. اطلاعات ساختگی است."},
{id:"b3",name:"ویتالیف",desc:"برند نمونهٔ مکمل و ویتامین. اطلاعات ساختگی است."},
{id:"b4",name:"کراتیوا",desc:"برند نمونهٔ مراقبت مو. اطلاعات ساختگی است."},
{id:"b5",name:"مدیسن",desc:"برند نمونهٔ تجهیزات سلامت خانگی. اطلاعات ساختگی است."},
{id:"b6",name:"بِبه‌کر",desc:"برند نمونهٔ مادر و کودک. اطلاعات ساختگی است."},
{id:"b7",name:"دنتیس",desc:"برند نمونهٔ بهداشت دهان. اطلاعات ساختگی است."},
{id:"b8",name:"نوکتورن",desc:"برند نمونهٔ آرامش و خواب. اطلاعات ساختگی است."}];
var PID=0;
function P(o){PID++;var b={id:"p"+PID,mock:true,rating:(4.2+(PID%7)*0.1).toFixed(1),reviews:20+PID*13,
sold:10+PID*9,views:200+PID*137,published:true,expiry:"۱۴۰۶/۰۸",batch:"B-"+(1000+PID),
desc:"این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.",
usage:"طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.",
storage:"در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
warn:"در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.",
ingredients:"فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است."};
for(var k in o)b[k]=o[k];return b}
var SEEDP=[
P({cat:"skin",brand:"b1",name:"کرم آبرسان صورت",variant:"پوست خشک · ۵۰ میلی‌لیتر",price:380000,stock:24,icon:"i-drop",attrs:{skinType:"خشک",form:"کرم",size:"۵۰ تا ۲۰۰",feature:"بدون عطر"}}),
P({cat:"skin",brand:"b2",name:"ضدآفتاب بی‌رنگ SPF ۵۰",variant:"۴۰ میلی‌لیتر",price:520000,sale:442000,stock:12,icon:"i-sun",attrs:{skinType:"مختلط",form:"ژل",spf:"۵۰",size:"زیر ۵۰",feature:"غیرکومدون‌زا"}}),
P({cat:"skin",brand:"b1",name:"سرم ویتامین C",variant:"۳۰ میلی‌لیتر",price:640000,stock:8,icon:"i-drop",attrs:{skinType:"معمولی",form:"سرم",size:"زیر ۵۰",feature:"وگان"}}),
P({cat:"skin",brand:"b2",name:"ژل شست‌وشوی ملایم",variant:"۲۰۰ میلی‌لیتر",price:245000,stock:40,icon:"i-drop",attrs:{skinType:"حساس",form:"ژل",size:"۵۰ تا ۲۰۰",feature:"مناسب پوست حساس"}}),
P({cat:"skin",brand:"b1",name:"کرم مرطوب‌کنندهٔ شب",variant:"۵۰ میلی‌لیتر",price:495000,stock:2,icon:"i-drop",attrs:{skinType:"خشک",form:"کرم",size:"۵۰ تا ۲۰۰",feature:"بدون عطر"}}),
P({cat:"skin",brand:"b2",name:"ضدآفتاب فیزیکی SPF ۵۰+",variant:"۵۰ میلی‌لیتر",price:610000,stock:0,icon:"i-sun",attrs:{skinType:"حساس",form:"کرم",spf:"۵۰+",size:"۵۰ تا ۲۰۰",feature:"مناسب پوست حساس"}}),
P({cat:"hair",brand:"b4",name:"شامپو بدون سولفات",variant:"موی رنگ‌شده · ۴۰۰ میلی‌لیتر",price:310000,stock:33,icon:"i-bottle",attrs:{hairType:"رنگ‌شده",scalp:"معمولی",form:"ژل",size:"بالای ۲۰۰"}}),
P({cat:"hair",brand:"b4",name:"ماسک موی ترمیم‌کننده",variant:"۲۰۰ میلی‌لیتر",price:465000,stock:17,icon:"i-bottle",attrs:{hairType:"آسیب‌دیده",scalp:"معمولی",form:"کرم",size:"۵۰ تا ۲۰۰"}}),
P({cat:"hair",brand:"b4",name:"سرم محافظ حرارتی",variant:"۱۰۰ میلی‌لیتر",price:390000,stock:21,icon:"i-bottle",attrs:{hairType:"خشک",scalp:"معمولی",form:"سرم",size:"۵۰ تا ۲۰۰"}}),
P({cat:"hair",brand:"b4",name:"شامپو ضدشورهٔ روزانه",variant:"۳۰۰ میلی‌لیتر",price:285000,sale:242000,stock:26,icon:"i-bottle",attrs:{hairType:"چرب",scalp:"شوره‌دار",form:"ژل",size:"بالای ۲۰۰"}}),
P({cat:"supp",brand:"b3",name:"ویتامین D۳ ۱۰۰۰ واحد",variant:"۶۰ قرص",price:265000,stock:3,icon:"i-pill",attrs:{form:"قرص",pack:"۶۰ عددی",feature:"وگان"}}),
P({cat:"supp",brand:"b3",name:"مولتی‌ویتامین روزانه",variant:"۳۰ قرص",price:410000,stock:55,icon:"i-pill",attrs:{form:"قرص",pack:"۳۰ عددی"}}),
P({cat:"supp",brand:"b3",name:"امگا ۳",variant:"۹۰ کپسول",price:690000,sale:586000,stock:19,icon:"i-pill",attrs:{form:"کپسول",pack:"۹۰ عددی"}}),
P({cat:"supp",brand:"b3",name:"منیزیم و ب۶",variant:"۶۰ قرص",price:345000,stock:14,icon:"i-pill",attrs:{form:"قرص",pack:"۶۰ عددی"}}),
P({cat:"supp",brand:"b3",name:"ویتامین C جوشان",variant:"۲۰ قرص",price:135000,stock:48,icon:"i-pill",attrs:{form:"قرص",pack:"۳۰ عددی"}}),
P({cat:"hygiene",brand:"b7",name:"خمیردندان روزانه",variant:"۷۵ میلی‌لیتر",price:98000,stock:120,icon:"i-tooth",attrs:{form:"ژل",size:"۵۰ تا ۲۰۰"}}),
P({cat:"hygiene",brand:"b7",name:"دهان‌شویهٔ بدون الکل",variant:"۵۰۰ میلی‌لیتر",price:165000,stock:60,icon:"i-tooth",attrs:{form:"اسپری",size:"بالای ۲۰۰"}}),
P({cat:"hygiene",brand:"b1",name:"ژل ضدعفونی دست",variant:"۱۰۰ میلی‌لیتر",price:85000,stock:200,icon:"i-drop",attrs:{form:"ژل",size:"۵۰ تا ۲۰۰"}}),
P({cat:"baby",brand:"b6",name:"لوسیون بدن کودک",variant:"۲۰۰ میلی‌لیتر",price:220000,sale:195000,stock:35,icon:"i-baby",attrs:{age:"نوزاد",form:"لوسیون",size:"۵۰ تا ۲۰۰"}}),
P({cat:"baby",brand:"b6",name:"شامپو بدون اشک",variant:"۳۰۰ میلی‌لیتر",price:190000,stock:44,icon:"i-baby",attrs:{age:"۶ ماه به بالا",form:"ژل",size:"بالای ۲۰۰"}}),
P({cat:"baby",brand:"b6",name:"کرم مراقبت پوشک",variant:"۱۰۰ میلی‌لیتر",price:175000,stock:5,icon:"i-baby",attrs:{age:"نوزاد",form:"کرم",size:"۵۰ تا ۲۰۰"}}),
P({cat:"device",brand:"b5",name:"فشارسنج بازویی دیجیتال",variant:"حافظهٔ ۲ کاربر",price:2480000,stock:6,icon:"i-device",attrs:{deviceType:"فشارسنج",warranty:"۲ ساله"}}),
P({cat:"device",brand:"b5",name:"تب‌سنج غیرتماسی",variant:"مادون قرمز",price:890000,stock:11,icon:"i-device",attrs:{deviceType:"تب‌سنج",warranty:"۱ ساله"}}),
P({cat:"device",brand:"b5",name:"گلوکومتر خانگی",variant:"به‌همراه ۲۵ نوار",price:1650000,stock:4,icon:"i-device",attrs:{deviceType:"گلوکومتر",warranty:"۲ ساله"}}),
P({cat:"daily",brand:"b1",name:"بستهٔ کمک‌های اولیه",variant:"۲۴ قلم",price:290000,stock:18,icon:"i-shield",attrs:{form:"بسته"}}),
P({cat:"daily",brand:"b3",name:"محلول شست‌وشوی چشم",variant:"۱۰۰ میلی‌لیتر",price:140000,stock:27,icon:"i-drop",attrs:{form:"اسپری"}}),
P({cat:"sleep",brand:"b8",name:"مکمل منیزیم شب",variant:"۳۰ کپسول",price:345000,stock:0,icon:"i-moon",attrs:{form:"کپسول"}}),
P({cat:"sleep",brand:"b8",name:"اسپری بالش آرام‌بخش",variant:"۵۰ میلی‌لیتر",price:280000,stock:22,icon:"i-moon",attrs:{form:"اسپری"}})];
var ARTICLES=[
{id:"a1",title:"ضدآفتاب را چطور و چقدر استفاده کنیم",cat:"راهنمای محصول",read:6,tag:"skin",body:"مقدار کافی، زمان تمدید و تفاوت فرم‌های ژلی، کرمی و فیزیکی. این متن نمونه است و در نسخهٔ واقعی باید با ارجاع به منابع معتبر و بازبینی کارشناس منتشر شود."},
{id:"a2",title:"نگهداری مکمل‌ها در خانه",cat:"نگهداری",read:4,tag:"supp",body:"دما، رطوبت و تاریخ انقضا؛ چه چیزی را کجا نگه داریم. این متن نمونه است."},
{id:"a3",title:"فشارسنج خانگی را درست بخوانید",cat:"تجهیزات",read:7,tag:"device",body:"شرایط اندازه‌گیری، محل بستن بازوبند و ثبت نتیجه. این متن نمونه است."},
{id:"a4",title:"روتین ساده برای موی رنگ‌شده",cat:"مراقبت مو",read:5,tag:"hair",body:"شست‌وشوی ملایم و ترمیم رطوبت. این متن نمونه است."},
{id:"a5",title:"تفاوت فرم‌های مکمل: قرص، کپسول، جوشان",cat:"آموزش",read:5,tag:"supp",body:"این متن نمونه است و صرفاً جنبهٔ آموزشی دارد."},
{id:"a6",title:"پوست حساس و انتخاب پاک‌کننده",cat:"مراقبت پوست",read:6,tag:"skin",body:"این متن نمونه است و صرفاً جنبهٔ آموزشی دارد."}];
var SEEDC=[
{code:"SABZ10",type:"percent",value:10,min:0,max:200000,uses:0,limit:100,active:true,exp:"۱۴۰۵/۱۲/۲۹"},
{code:"WELCOME50",type:"fixed",value:50000,min:500000,uses:0,limit:50,active:true,exp:"۱۴۰۵/۱۲/۲۹"},
{code:"SPRING24",type:"percent",value:15,min:0,max:300000,uses:0,limit:0,active:false,exp:"۱۴۰۴/۰۳/۳۱"}];
var SHIPPING=[
{id:"std",name:"پست پیشتاز",days:"۳ تا ۵ روز کاری",fee:65000},
{id:"exp",name:"ارسال سریع",days:"۱ تا ۲ روز کاری",fee:145000},
{id:"pick",name:"دریافت حضوری",days:"همان روز، شعبهٔ مرکزی",fee:0}];
var ORDER_STATES=["در انتظار پرداخت","پرداخت شده","در حال پردازش","آماده‌سازی","ارسال شده","تحویل شده","پرداخت ناموفق","لغو شده","درخواست مرجوعی","مرجوع شده","ارسال ناموفق","بازپرداخت شده"];
var ROLES={
super:{name:"مدیر ارشد",perms:["*"]},
store:{name:"مدیر فروشگاه",perms:["dash","products","orders","customers","promos","content","reviews","analytics"]},
inv:{name:"مدیر انبار",perms:["dash","inventory","products"]},
support:{name:"پشتیبانی",perms:["dash","orders","customers","tickets","reviews"]},
content:{name:"مدیر محتوا",perms:["dash","content"]},
finance:{name:"مدیر مالی",perms:["dash","orders","analytics","promos"]}};
function seed(){return{products:JSON.parse(JSON.stringify(SEEDP)),coupons:JSON.parse(JSON.stringify(SEEDC)),
cart:[],favs:[],compare:[],lists:[{id:"l1",name:"ضروری‌های هفتگی",items:[]}],routines:[],recent:[],
orders:[],tickets:[],notifs:[],reviews:{p1:[{id:"seedr",by:"کاربر نمونه",stars:5,text:"این یک نظر نمونه برای نمایش ساختار صفحه است و از مشتری واقعی نیست.",helpful:3,verified:true}]},
moves:[],audit:[],user:null,admin:null,searchHistory:[],prefs:{promo:true,order:true,restock:true},addresses:[]}}
var S;try{S=JSON.parse(localStorage.getItem(KEY))||seed()}catch(e){S=seed()}
if(!S.products||!S.products.length)S=seed();

/* assigns a backend-matching slug to every local product: "<cat>-<n>" where n
   is this product's 1-based position within its category, in stored order.
   This exactly mirrors the rule prisma/seed.ts used when it generated slugs
   from this same data.js file — so API.fetchProduct(local product's slug)
   hits the right backend row. Recomputed on every load (cheap, 28 items) so
   it stays correct even as admin-created products get appended. */
(function assignSlugs(){
 var counters={};
 S.products.forEach(function(p){
  counters[p.cat]=(counters[p.cat]||0)+1;
  p.slug=p.cat+"-"+counters[p.cat];
 });
})();

function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function prod(id){for(var i=0;i<S.products.length;i++)if(S.products[i].id===id)return S.products[i];return null}
function brandName(id){for(var i=0;i<BRANDS.length;i++)if(BRANDS[i].id===id)return BRANDS[i].name;return"—"}
function catName(id){for(var i=0;i<CATS.length;i++)if(CATS[i].id===id)return CATS[i].name;return"—"}
function catOf(id){for(var i=0;i<CATS.length;i++)if(CATS[i].id===id)return CATS[i];return CATS[0]}
var FA="۰۱۲۳۴۵۶۷۸۹";
function fa(n){return String(n).replace(/\d/g,function(d){return FA[d]})}
function money(n){return fa(Math.round(n).toLocaleString("en-US"))}
function toman(n){return money(n)+" تومان"}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function now(){return new Date().toLocaleString("fa-IR",{dateStyle:"short",timeStyle:"short"})}
function uid(p){return p+Math.random().toString(36).slice(2,8)}
function eff(p){return p.sale||p.price}
function icon(n){return'<svg><use href="#'+n+'"/></svg>'}
function toast(msg,type){var el=document.createElement("div");el.className="toast toast-"+(type||"success");
el.innerHTML=icon("i-"+(type==="error"?"alert":type==="info"?"info":"check"))+" "+esc(msg);
document.getElementById("toasts").appendChild(el);setTimeout(function(){el.remove()},2600)}
function logAudit(action,entity,before,after){S.audit.unshift({id:uid("a"),who:S.admin?ROLES[S.admin].name:"سیستم",action:action,entity:entity,before:before,after:after,at:now()});S.audit=S.audit.slice(0,200);save()}
function move(pid,qty,reason){S.moves.unshift({id:uid("m"),pid:pid,qty:qty,reason:reason,at:now()});S.moves=S.moves.slice(0,200)}
function notify(title,body){S.notifs.unshift({id:uid("n"),title:title,body:body,at:now(),read:false});save()}
function can(p){if(!S.admin)return false;var pm=ROLES[S.admin].perms;return pm[0]==="*"||pm.indexOf(p)>-1}
function cartCount(){return S.cart.reduce(function(a,c){return a+c.qty},0)}
