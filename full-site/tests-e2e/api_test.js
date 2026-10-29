// Contract test: drives the dev-server over real HTTP with a cookie jar.
process.env.PERSIST_FILE='none'; process.env.DEV_FIXED_OTP='123456'; process.env.PORT='4517';
const EXT = process.env.BASE; // BASE=http://localhost:4700 → test an already-running server (the REAL Next route code via testkit)
const server = EXT ? { listen: (p,cb)=>cb&&cb(), close(){} } : require(require('path').resolve(__dirname,'..','backend','dev-server','server.js')).server;
const BASE = EXT || 'http://localhost:4517';
let pass=0,fail=0; const t=(n,c,x)=>{ if(c){pass++;console.log('✓ '+n)}else{fail++;console.log('✗ '+n+(x?'  → '+x:''))} };
function client(){ let cookie=''; return async (m,p,b,opt={})=>{ const r=await fetch(BASE+p,{method:m,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},body:b?JSON.stringify(b):undefined,redirect:'manual'});
  const sc=r.headers.get('set-cookie'); if(sc) cookie=sc.split(';')[0].includes('=;')||sc.includes('Max-Age=0')?'':sc.split(';')[0];
  let j=null; try{ j=await r.json() }catch{} return {s:r.status,j,loc:r.headers.get('location')}; } }
async function login(c,phone,name){ await c('POST','/api/auth/otp',{phone}); return c('POST','/api/auth/verify',{phone,code:'123456',name}); }
(async()=>{
  await new Promise(r=>server.listen(4517,r));
  const g=client(), a=client(), adm=client(), adm2=client();
  let r=await g('GET','/api/health'); t('health ok + service tag', r.s===200&&r.j.ok&&r.j.service==='sabzdaru');
  r=await g('GET','/api/storefront'); const sf=r.j;
  t('storefront: 8 categories, 8 brands, 28 products, shipping', sf.categories.length===8&&sf.brands.length===8&&sf.products.length===28&&sf.shipping.length===3);
  t('storefront product carries variantId, stock, price', sf.products[0].variantId&&typeof sf.products[0].stock==='number'&&sf.products[0].price>0);
  r=await g('GET','/api/me'); t('GET /api/me without login → 401', r.s===401);
  r=await g('GET','/api/admin/orders'); t('admin endpoint without login → 401', r.s===401);
  // --- auth
  r=await g('POST','/api/auth/otp',{phone:'123'}); t('bad phone rejected 400', r.s===400);
  r=await a.call?0:0;
  await a('POST','/api/auth/otp',{phone:'09121112233'});
  r=await a('POST','/api/auth/verify',{phone:'09121112233',code:'000000'}); t('wrong code → 400', r.s===400&&/نادرست/.test(r.j.error));
  r=await a('POST','/api/auth/verify',{phone:'09121112233',code:'123456'}); t('new user without name → 400 newUser', r.s===400&&r.j.newUser===true);
  r=await a('POST','/api/auth/verify',{phone:'09121112233',code:'123456',name:'مریم رضایی'}); t('the name prompt does NOT burn the code: retry with name succeeds', r.s===200&&r.j.user.name==='مریم رضایی');
  r=await a('POST','/api/auth/verify',{phone:'09121112233',code:'123456',name:'مریم'}); t('…but the code is single-use afterwards → 400', r.s===400);
  r=await a('GET','/api/me'); t('GET /api/me after login', r.s===200&&r.j.user.phone==='09121112233'&&r.j.orders.length===0&&r.j.user.role===null);
  r=await a('GET','/api/admin/products'); t('customer cannot reach admin API → 403', r.s===403);
  // --- quote
  const p1=sf.products.find(p=>p.slug==='skin-1'), p5=sf.products.find(p=>p.slug==='skin-5'), pOut=sf.products.find(p=>p.stock===0);
  const std=sf.shipping.find(s=>/پیشتاز/.test(s.name));
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:2}],shippingMethodId:std.id});
  t('quote: subtotal/shipping/total', r.s===200&&r.j.subtotal===p1.price*2&&r.j.shippingFee===65000&&r.j.total===p1.price*2+65000, JSON.stringify(r.j));
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:2}],couponCode:'SABZ10',shippingMethodId:std.id});
  t('quote: SABZ10 gives 10% (capped) off', r.j.discount===Math.min(Math.round(p1.price*2*0.1),200000), JSON.stringify(r.j));
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:1}],couponCode:'NOPE'}); t('quote: invalid coupon reported, not thrown', r.s===200&&r.j.couponError==='کد تخفیف نامعتبر است');
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:1}],couponCode:'SPRING24'}); t('quote: expired coupon says it is expired', r.j.couponError==='این کد منقضی شده', r.j.couponError);
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:pOut.variantId,quantity:1}]}); t('quote: out-of-stock flagged in issues', r.j.issues.length===1);
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:999}]}); t('quote: quantity 999 → 400 (max 20)', r.s===400);
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:1}],shippingMethodId:std.id,couponCode:'WELCOME50'}); t('quote: WELCOME50 needs min 500k', /حداقل خرید/.test(r.j.couponError||''));
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:sf.products.find(p=>p.slug==='device-1').variantId,quantity:1}],shippingMethodId:std.id}); t('quote: free shipping above 800k', r.j.shippingFee===0, JSON.stringify(r.j));
  // --- place (guest) with validation
  const addr={province:'تهران',city:'تهران',line:'خیابان ولیعصر پلاک ۱۰ واحد ۲',postalCode:'1234567890'}, cust={name:'علی احمدی',phone:'09123334455',email:''};
  r=await g('POST','/api/checkout/place',{cartId:'c1',lines:[{variantId:p1.variantId,quantity:1}],shippingMethodId:std.id,address:{...addr,postalCode:'12'},customer:cust}); t('place: bad postal code → 400', r.s===400);
  r=await g('POST','/api/checkout/place',{cartId:'c1',lines:[{variantId:p5.variantId,quantity:5}],shippingMethodId:std.id,address:addr,customer:cust}); t('place: over-stock → 409 with variantId', r.s===409&&r.j.variantId===p5.variantId&&/موجودی کافی نیست/.test(r.j.error));
  const stockBefore=(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock;
  r=await g('POST','/api/checkout/place',{cartId:'c2',lines:[{variantId:p1.variantId,quantity:2}],couponCode:'SABZ10',shippingMethodId:std.id,address:addr,customer:cust});
  t('place: creates order PENDING_PAYMENT', r.s===200&&/^SD-/.test(r.j.orderNumber), JSON.stringify(r.j)); const oid=r.j.orderId;
  const stockAfter=(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock;
  t('place: stock reserved immediately (-2)', stockAfter===stockBefore-2, stockBefore+'→'+stockAfter);
  r=await g('GET','/api/orders/'+oid); t('public order lookup: status + no PII', r.s===200&&r.j.status==='در انتظار پرداخت'&&!r.j.customer&&!r.j.address);
  // --- payment: failure path returns stock
  r=await g('POST','/api/payments/initiate',{orderId:oid,simulate:'fail'}); t('initiate returns gateway URL', r.s===200&&/gatewayRef=SAMPLE-/.test(r.j.redirectUrl)&&/simulate=failure/.test(r.j.redirectUrl));
  const cbPath=r.j.redirectUrl.replace(BASE,'');
  r=await g('GET',cbPath); t('callback redirects to SPA hash route', [302,307].includes(r.s)&&r.loc.endsWith('/#/order/'+oid), r.loc);
  r=await g('GET','/api/orders/'+oid); t('failed payment → PAYMENT_FAILED', r.j.status==='پرداخت ناموفق');
  const stockRestored=(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock;
  t('failed payment gives stock back', stockRestored===stockBefore, stockRestored+' vs '+stockBefore);
  r=await g('GET',cbPath); t('callback is idempotent on refresh (no double restock)', [302,307].includes(r.s)&&(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock===stockBefore);
  r=await g('POST','/api/payments/initiate',{orderId:oid}); t('cannot pay an order that already failed → 409', r.s===409);
  // --- payment: success path as logged-in user
  r=await a('POST','/api/checkout/place',{cartId:'c3',lines:[{variantId:p1.variantId,quantity:1}],shippingMethodId:std.id,address:addr,customer:cust}); const oid2=r.j.orderId, num2=r.j.orderNumber;
  r=await a('POST','/api/payments/initiate',{orderId:oid2}); r=await a('GET',r.j.redirectUrl.replace(BASE,'')); 
  r=await a('GET','/api/me'); t('paid order appears in my orders (owner link)', r.j.orders.length===1&&r.j.orders[0].id===num2&&r.j.orders[0].status==='پرداخت شده'&&r.j.orders[0].txn.ref.startsWith('SAMPLE-'));
  t('notifications created for order + payment', r.j.notifs.length>=2, JSON.stringify(r.j.notifs.map(n=>n.title)));
  // --- my orders: cancel restocks
  const sBefore=(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock;
  r=await a('POST','/api/me/orders/'+num2+'/cancel'); t('customer can cancel a PAID order', r.s===200&&r.j.orders[0].status==='لغو شده');
  t('cancel restocks', (await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock===sBefore+1);
  r=await a('POST','/api/me/orders/'+num2+'/cancel'); t('cannot cancel twice → 409', r.s===409);
  // --- account CRUD
  r=await a('POST','/api/me/addresses',{prov:'تهران',city:'کرج',line:'گلشهر بلوار اصلی پلاک ۳',zip:'3141234567'}); t('add address', r.s===200&&r.j.addresses.length===1&&r.j.addresses[0].city==='کرج');
  r=await a('POST','/api/me/addresses',{prov:'ت',city:'ک',line:'x',zip:'1'}); t('bad address → 400', r.s===400);
  const adId=(await a('GET','/api/me')).j.addresses[0].id; r=await a('DELETE','/api/me/addresses/'+adId); t('delete address', r.j.addresses.length===0);
  r=await a('POST','/api/me/lists',{name:'ضروری‌ها'}); const lid=r.j.lists[0].id; r=await a('PATCH','/api/me/lists/'+lid,{items:[p1.id,p5.id]}); t('list: create + add items', r.j.lists[0].items.length===2);
  r=await a('PATCH','/api/me/lists/'+lid,{name:'ماهانه'}); t('list: rename', r.j.lists[0].name==='ماهانه'); r=await a('DELETE','/api/me/lists/'+lid); t('list: delete', r.j.lists.length===0);
  r=await a('POST','/api/me/routines',{name:'صبح',steps:[p1.id,p5.id]}); t('routine: create', r.j.routines[0].steps.length===2);
  r=await a('PUT','/api/me/favorites/'+p1.id); t('favorite add', r.j.favs.includes(p1.id)); r=await a('PUT','/api/me/favorites/'+p1.id); t('favorite add idempotent', r.j.favs.length===1);
  r=await a('DELETE','/api/me/favorites/'+p1.id); t('favorite remove', r.j.favs.length===0);
  r=await a('PATCH','/api/me',{name:'مریم ر.',email:'m@example.com',prefs:{promo:false}}); t('profile + prefs update', r.j.user.name==='مریم ر.'&&r.j.prefs.promo===false&&r.j.prefs.order===true);
  r=await a('POST','/api/me/notifications/read'); t('notifications mark-read', r.j.notifs.every(n=>n.read));
  r=await a('POST','/api/me/tickets',{subject:'مشکل در سفارش',category:'سفارش',priority:'high',message:'سفارشم هنوز نرسیده است'}); const tid=r.j.tickets[0].id; t('ticket: create', r.j.tickets[0].status==='باز'&&r.j.tickets[0].priority==='بالا');
  r=await a('POST','/api/me/tickets/'+tid+'/reply',{message:'لطفاً پیگیری کنید'}); t('ticket: customer reply', r.j.tickets[0].msgs.length===2);
  // --- reviews: login required, pending, verified flag, admin approves
  r=await g('POST','/api/reviews',{productId:p1.id,rating:5,body:'عالی بود واقعا'}); t('review without login → 401', r.s===401);
  r=await a('POST','/api/reviews',{productId:p1.id,rating:5,body:'کیفیت عالی و ارسال سریع'}); t('review accepted as pending', r.s===200&&r.j.pending===true);
  r=await a('POST','/api/reviews',{productId:p1.id,rating:4,body:'نظر دوم من برای همین کالا'}); t('duplicate review → 409', r.s===409);
  t('pending review hidden from product page', !(await g('GET','/api/products/'+p1.slug)).j.reviews.some(x=>/کیفیت عالی/.test(x.body)));
  // --- admin RBAC
  await login(adm,'09120000000'); r=await adm('GET','/api/me'); t('admin account has role+permissions', r.j.user.role.key==='super'&&r.j.user.role.permissions[0]==='*');
  await login(adm2,'09120000004'); // content manager
  r=await adm2('GET','/api/admin/orders'); t('RBAC: content manager denied orders → 403', r.s===403);
  r=await adm2('GET','/api/admin/content/articles'); t('RBAC: content manager allowed articles', r.s===200&&r.j.length===6);
  r=await adm('GET','/api/admin/reviews'); const pend=r.j.find(x=>x.status==='pending'); t('admin sees pending review', !!pend&&pend.pname===p1.name);
  r=await adm('PATCH','/api/admin/reviews/'+pend.id,{status:'approved'}); t('admin approves review', r.j.status==='approved');
  const pd=(await g('GET','/api/products/'+p1.slug)).j; t('approved review now public; NOT marked verified (the buyer cancelled their only order)', pd.reviews.some(x=>/کیفیت عالی/.test(x.body)&&x.verified===false)&&pd.rating>0);
  r=await adm('GET','/api/admin/orders'); t('admin lists all orders (2)', r.j.length===2&&r.j[0].customer);
  r=await adm('PATCH','/api/admin/orders/'+oid,{status:'DELIVERED'}); t('admin illegal transition rejected 409', r.s===409);
  r=await adm('GET','/api/admin/customers'); t('admin customers list w/ spent', r.j.some(c=>c.phone==='09121112233'&&c.orders===1));
  r=await adm('GET','/api/admin/tickets'); t('admin sees ticket + customer', r.j.length===1&&r.j[0].customer==='مریم ر.');
  r=await adm('PATCH','/api/admin/tickets/'+tid,{reply:'یادداشت داخلی',internal:true}); t('internal note stays hidden from customer', (await a('GET','/api/me')).j.tickets[0].msgs.every(m=>m.by!=='یادداشت داخلی'));
  r=await adm('PATCH','/api/admin/tickets/'+tid,{reply:'پیگیری شد',status:'resolved'}); t('admin reply + status', (await a('GET','/api/me')).j.tickets[0].status==='حل شده');
  // admin product + inventory
  r=await adm('POST','/api/admin/products',{name:'کرم تست',variant:'۱۰۰ml',price:150000,stock:7,cat:'skin',brand:'b1'}); const np=r.j; t('admin creates product', r.s===200&&np.stock===7&&np.published);
  t('new product visible in storefront', (await g('GET','/api/storefront')).j.products.some(p=>p.id===np.id));
  r=await adm('PATCH','/api/admin/products/'+np.id,{price:160000,stock:12,name:'کرم تست ۲'}); t('admin edits price/stock (absolute)', r.j.price===160000&&r.j.stock===12);
  r=await adm('PATCH','/api/admin/inventory/'+np.variantId,{delta:-20}); t('inventory: cannot go negative → 409', r.s===409);
  r=await adm('PATCH','/api/admin/inventory/'+np.variantId,{delta:3,reason:'ورود'}); t('inventory adjust', r.j.stock===15);
  r=await adm('GET','/api/admin/inventory'); t('inventory moves recorded', r.j.moves.length>=3);
  r=await adm('DELETE','/api/admin/products/'+np.id); t('admin unpublishes → gone from storefront', !(await g('GET','/api/storefront')).j.products.some(p=>p.id===np.id));
  r=await adm('POST','/api/admin/promos',{code:'TEST20',type:'percent',value:20}); t('admin creates coupon', r.s===200&&r.j.active);
  r=await adm('POST','/api/admin/promos',{code:'TEST20',type:'percent',value:20}); t('duplicate coupon → 409', r.s===409);
  r=await g('POST','/api/checkout/quote',{lines:[{variantId:p1.variantId,quantity:1}],couponCode:'test20'}); t('new coupon usable immediately (case-insensitive)', r.j.discount>0&&!r.j.couponError);
  r=await adm('PATCH','/api/admin/promos/'+(await adm('GET','/api/admin/promos')).j.find(c=>c.code==='TEST20').id,{active:false}); t('admin deactivates coupon', r.j.active===false);
  r=await g('POST','/api/checkout/place',{cartId:'c7',lines:[{variantId:p1.variantId,quantity:1}],shippingMethodId:std.id,address:addr,customer:cust}); await g('GET',(await g('POST','/api/payments/initiate',{orderId:r.j.orderId})).j.redirectUrl.replace(BASE,''));
  r=await adm('GET','/api/admin/analytics'); t('analytics counts the paid order + best sellers', r.j.revenue>0&&r.j.orders===1&&r.j.bestSellers[0].name===p1.name, JSON.stringify(r.j));
  r=await adm('GET','/api/admin/audit'); t('audit log recorded admin actions', r.j.total>=8&&r.j.logs.some(l=>l.action==='product.create'));
  // cron expiry
  r=await g('POST','/api/checkout/place',{cartId:'c9',lines:[{variantId:p1.variantId,quantity:3}],shippingMethodId:std.id,address:addr,customer:cust}); const s0=(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock;
  r=await g('POST','/api/internal/cron/expire-orders',{olderThanMinutes:0}); t('cron without secret → 401', r.s===401);
  r=await fetch(BASE+'/api/internal/cron/expire-orders',{method:'POST',headers:{'x-cron-secret':'dev-cron','content-type':'application/json'},body:'{"olderThanMinutes":0}'}).then(x=>x.json()); t('cron expires unpaid orders + restocks', r.expired===1&&(await g('GET','/api/storefront')).j.products.find(p=>p.id===p1.id).stock===s0+3, JSON.stringify(r));
  // misc
  r=await g('POST','/api/newsletter',{email:'x@y.com'}); t('newsletter', r.s===200); r=await g('POST','/api/newsletter',{email:'bad'}); t('newsletter bad email → 400', r.s===400);
  r=await g('POST','/api/restock-alerts',{variantId:pOut.variantId,email:'a@b.com'}); t('restock alert', r.s===200);
  r=await a('DELETE','/api/me'); t('account deletion', r.s===200&&(await a('GET','/api/me')).s===401);
  r=await g('GET','/api/nope'); t('unknown route 404', r.s===404);
  console.log('\n'+pass+' passed, '+fail+' failed'); server.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('TEST CRASH',e);process.exit(2)});
