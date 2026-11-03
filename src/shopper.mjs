import {stockOutcome} from './stock-outcome.mjs';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
// Fixed-task browser probe, isolated from Admin credentials and merchant facts.
export async function shop(config,dir){await mkdir(dir,{recursive:true});const browser=await chromium.launch();const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(30000);let blocked=false;page.on('response',r=>{if(r.status()===429)blocked=true;});
 try{await page.goto(`https://${config.domain}/products/${config.handle}`,{waitUntil:'domcontentloaded'});
 if(page.url().includes('/password')){await page.locator('input[name="password"]').fill(config.password);await page.locator('form[action*="password"]').getByRole('button').click();await page.waitForLoadState('domcontentloaded');await page.goto(`https://${config.domain}/products/${config.handle}`,{waitUntil:'domcontentloaded'});}
 if(blocked)throw Error('BLOCKED: HTTP 429');if(/verify you are human|verification challenge|too many requests/i.test(await page.locator('body').innerText()))throw Error('BLOCKED: verification challenge');
 const variant=page.locator(`form[action*="/cart/add"] input[name="id"][value="${config.variant.split('/').at(-1)}"]`).first();
 if(!await variant.count()){await writeFile(dir+'/form-debug.json',JSON.stringify(await page.locator('form,input,select,button').evaluateAll(els=>els.map(el=>({tag:el.tagName,name:el.getAttribute('name'),value:el.getAttribute('value'),action:el.getAttribute('action'),text:el.tagName==='BUTTON'?el.textContent.trim():''}))),null,2));throw Error('Fixture variant not found in purchase form');}
 const form=variant.locator('xpath=ancestor::form');const button=form.getByRole('button',{name:/sold out|add to cart/i}).first();
 const unavailable=await button.isDisabled();
 if(!unavailable){await button.click();await page.waitForTimeout(1500);}
 if(blocked)throw Error('BLOCKED: HTTP 429');if(/verify you are human|verification challenge|too many requests/i.test(await page.locator('body').innerText()))throw Error('BLOCKED: verification challenge');
 const response=await context.request.get(`https://${config.domain}/cart.js`);if(response.status()===429)throw Error('BLOCKED: HTTP 429');if(!response.ok())throw Error(`Cart HTTP ${response.status()}`);
 const cart=await response.json();const items=cart.items.map(i=>({variant_id:String(i.variant_id),sku:i.sku,quantity:i.quantity,price:i.price,title:i.title}));
 const body=await form.innerText();const result={kind:'fixed-task-browser-probe',button_disabled:unavailable,items,observed_form_text:body,...stockOutcome(unavailable,body,items,config.variant.split('/').at(-1))};
 await page.screenshot({path:dir+'/page.png',fullPage:false});await writeFile(dir+'/result.json',JSON.stringify(result,null,2));return result;
 }finally{await context.close();await browser.close();}}
