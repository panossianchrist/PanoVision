import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||"C:/Users/Owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
await fs.mkdir("test-results",{recursive:true});
const root=await fs.mkdtemp(path.resolve("test-results/browser-private-"));
const base="http://127.0.0.1:4176";
Object.assign(process.env,{PANO_PRIVATE_DIR:root,PANO_APP_ORIGIN:base,PANO_UPLOADS_ENABLED:"true",MODERATION_PROVIDER:"disabled",MODERATION_API_KEY:"",CLAMSCAN_PATH:""});
const {PanoStore}=await import("../lib/server/store.ts");
const {processJob}=await import("../lib/moderation/service.ts");
const {passwordHash}=await import("../lib/server/http.ts");
const store=new PanoStore(root);
const password=randomBytes(24).toString("base64url");
store.addAdmin("browser-test",passwordHash(password));
const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","4176"],{env:process.env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let serverErrors="";server.stderr.on("data",chunk=>{serverErrors+=chunk.toString();});server.stdout.resume();
let browser;
const errors=[],results=[],httpErrors=[];
const safe=()=>({findings:[],uncertain:false,textComplete:true,requestIds:["browser-synthetic"]});
const mock=(reject=false)=>({name:"test-only-mock",moderateImage:async()=>reject?{...safe(),findings:[{category:"EXPLICIT_NUDITY",confidence:.99,source:"visual"}]}:safe(),moderateVideoFrame:async()=>safe(),moderateText:async()=>safe(),transcribeAudio:async()=>""});
try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(`Test server failed: ${serverErrors}`);try{const response=await fetch(base);if(response.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,300));}assert.ok(ready,"Test server ready");
  browser=await chromium.launch({channel:"msedge",headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
  const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));page.on("console",message=>{if(message.type()==="error")errors.push(`${message.text()} at ${message.location().url}`);});
  page.on("response",response=>{if(response.status()>=400)httpErrors.push({status:response.status(),url:response.url()});});
  for(const width of [1440,1200,1024,768,430,390,320]){
    await page.setViewportSize({width,height:width<720?844:1000});
    for(const route of ["/","/network","/how-it-works","/start-campaign","/contact","/privacy","/terms","/login","/login?mode=signup","/admin/login"]){
      const response=await page.goto(base+route,{waitUntil:"networkidle"});assert.equal(response.status(),200);
      const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,missingAlt:[...document.images].filter(img=>!img.alt).length,brokenImages:[...document.images].filter(img=>img.complete&&!img.naturalWidth).length,h1:document.querySelectorAll("h1").length}));
      assert.equal(metrics.overflow,0,`${width} ${route} overflow`);assert.equal(metrics.missingAlt,0);assert.equal(metrics.brokenImages,0);assert.equal(metrics.h1,1);
      if(route==="/"){assert.equal(await page.locator('[data-map="lebanon"]').count(),1);assert.equal(await page.locator(".hero .geographic-map").count(),0);assert.equal(await page.locator(".screen-pin").count(),0);await page.screenshot({path:`test-results/home-${width}.png`});if(width===1440||width===390)await page.screenshot({path:`test-results/home-full-${width}.png`,fullPage:true});}
      if(route==="/network"&&(width===1440||width===390))await page.screenshot({path:`test-results/network-${width}.png`,fullPage:true});
      results.push({width,route,...metrics});
    }console.log(`Responsive checks passed at ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base);
  await page.getByRole("button",{name:"Open menu",exact:true}).click();await page.keyboard.press("Escape");assert.equal(await page.getByRole("button",{name:"Open menu",exact:true}).getAttribute("aria-expanded"),"false");
  await page.getByRole("button",{name:"Open menu",exact:true}).click();await page.locator("#primary-nav").getByRole("link",{name:"Network",exact:true}).click();await page.waitForURL("**/network");assert.equal(await page.evaluate(()=>document.body.style.overflow),"");
  for(const city of ["Beirut","Jounieh","Tripoli"])await page.locator(".city-options").getByRole("button",{name:city,exact:true}).click();
  assert.equal(await page.locator(".city-marker.is-selected").count(),3);
  await page.locator('.selectable-city[aria-label="Beirut"]').click();assert.equal(await page.locator(".city-marker.is-selected").count(),2);await page.locator('.selectable-city[aria-label="Beirut"]').focus();await page.keyboard.press("Space");assert.equal(await page.locator(".city-marker.is-selected").count(),3);
  await page.getByRole("button",{name:"Zoom in",exact:true}).click();await page.getByRole("button",{name:"Zoom in",exact:true}).click();await page.waitForFunction(()=>Number(document.querySelector(".map-scene").dataset.scale)>=1.7);
  // Panning is drag-when-zoomed (no mode toggle); the keyboard can pan a focused, zoomed map.
  const viewport=page.locator(".map-viewport");await viewport.focus();await page.keyboard.press("ArrowRight");
  await page.getByRole("button",{name:"Reset view",exact:true}).click();await page.waitForFunction(()=>document.querySelector(".map-scene").dataset.scale==="1.00");assert.equal(await page.locator(".city-marker.is-selected").count(),3);
  await page.getByRole("button",{name:"Remove Jounieh",exact:true}).click();assert.equal(await page.locator(".city-marker.is-selected").count(),2);await page.locator(".city-options").getByRole("button",{name:"Jounieh",exact:true}).click();
  await page.getByRole("link",{name:"Plan this campaign",exact:true}).click();await page.waitForURL("**/start-campaign?*");assert.deepEqual(new Set(new URL(page.url()).searchParams.getAll("city")),new Set(["Beirut","Jounieh","Tripoli"]));await page.reload();
  await page.goto(base+"/start-campaign?region=Beirut");const next=()=>page.getByRole("button",{name:"Continue",exact:true}).click();
  await next();assert.equal(await page.locator(".field-error").count(),3);
  await page.goto(base+"/dashboard");await page.waitForURL("**/login?*");
  await page.getByRole("button",{name:"Create account",exact:true}).click();await page.getByLabel("Full name",{exact:true}).fill("Test User");await page.getByLabel("Company",{exact:true}).fill("Synthetic browser company");await page.getByLabel("Email",{exact:true}).fill("test@example.com");await page.locator("#account-password").fill(password);await page.getByRole("button",{name:"Create account",exact:true}).click();await page.waitForURL("**/dashboard");assert.equal(await page.locator(".dashboard-empty").count(),1);assert.equal(await page.locator(".dashboard-metrics dd").allTextContents().then(values=>values.every(value=>value==="0")),true);
  await page.goto(base+"/start-campaign?region=Beirut&city=Beirut&city=Jounieh&city=Tripoli");assert.equal(await page.getByLabel("Company name",{exact:false}).inputValue(),"Synthetic browser company");await next();
  await page.getByLabel("Campaign name",{exact:false}).fill("Synthetic roadside launch");await page.getByRole("radio",{name:"Special occasion",exact:true}).check();await next();assert.equal(await page.getByLabel("Preferred region",{exact:true}).inputValue(),"Beirut");assert.equal(await page.locator('.city-options button[aria-pressed="true"]').count(),3);await next();
  await page.getByLabel("Preferred start date").fill("2027-02-10");await page.getByLabel("Preferred end date").fill("2027-02-09");await page.getByRole("radio",{name:"Custom",exact:true}).check();await next();assert.equal(await page.locator(".field-error").count(),3);await page.getByLabel("Preferred end date").fill("2027-02-11");await page.getByLabel("Preferred time (Beirut)",{exact:false}).fill("18:30");await page.getByLabel("Custom duration in minutes",{exact:false}).fill("15");await next();
  await page.getByLabel("Choose creative file").setInputFiles({name:"invalid.txt",mimeType:"text/plain",buffer:Buffer.from("safe invalid fixture")});assert.match(await page.locator(".field-error").textContent(),/supported/);
  const bytes=await fs.readFile("public/brand/PanoVision_Logo.png");
  async function uploadVersion(name){await page.getByLabel("Choose creative file").setInputFiles({name,mimeType:"image/png",buffer:bytes});await page.locator(".selected-file").waitFor();await page.locator(".preview-display img").waitFor();assert.equal(await page.locator(".preview-display img").evaluate(async img=>{await img.decode();return img.naturalWidth>0;}),true);await page.getByRole("button",{name:"Upload & check creative",exact:true}).click();await page.getByRole("heading",{name:"Checking your creative",exact:true}).waitFor();const job=store.claimJob();assert.ok(job);return job;}
  const first=await uploadVersion("synthetic-v1.png");await processJob(store,first);await page.getByRole("heading",{name:"Under review",exact:true}).waitFor();await next();assert.match(await page.locator(".form-alert").last().textContent(),/must pass/);await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:"test-results/campaign-manual-mobile.png",fullPage:true});
  const second=await uploadVersion("synthetic-v2.png");await processJob(store,second,{scan:async()=>"clean",provider:mock(true)});await page.getByRole("heading",{name:"Creative not approved",exact:true}).waitFor();await next();assert.equal(await page.locator(".request-summary").count(),0);
  const third=await uploadVersion("synthetic-v3.png");await processJob(store,third,{scan:async()=>"clean",provider:mock()});await page.getByRole("heading",{name:"Initial creative check passed",exact:true}).waitFor();
  await page.reload();await page.getByRole("heading",{name:"Initial creative check passed",exact:true}).waitFor();await next();assert.match(await page.locator(".request-summary").textContent(),/15/);assert.match(await page.locator(".request-summary").textContent(),/Jounieh/);await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0);});await page.screenshot({path:"test-results/campaign-review-mobile.png",fullPage:true});
  await page.getByRole("button",{name:"Submit campaign request",exact:true}).click();await page.getByRole("heading",{name:"Campaign request received",exact:true}).waitFor();const asset=store.asset(third.asset_id);assert.equal(store.campaign(asset.campaign_id).business_status,"requested");
  const downloaded=page.waitForEvent("download");await page.getByRole("button",{name:"Download request",exact:true}).click();const download=await downloaded;await download.saveAs("test-results/request.json");assert.equal(JSON.parse(await fs.readFile("test-results/request.json","utf8")).status,"received");
  await page.goto(base+"/admin/moderation");await page.waitForURL("**/admin/login");await page.getByLabel("Username").fill("browser-test");await page.getByLabel("Password").fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL("**/admin/moderation");await page.getByLabel("Queue",{exact:true}).selectOption("all");await page.locator(".review-row").filter({hasText:"synthetic-v3.png"}).click();
  await page.getByRole("button",{name:"Open private preview",exact:true}).click();await page.locator(".private-preview img").waitFor();assert.equal(await page.locator(".private-preview img").evaluate(async img=>{await img.decode();return img.complete&&img.naturalWidth>0;}),true);
  for(const width of [1440,1200,1024,768,430,390,320]){await page.setViewportSize({width,height:width<720?844:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`Admin ${width}px overflow`);await page.evaluate(()=>scrollTo(0,0));if(width===1440||width===390)await page.screenshot({path:`test-results/admin-${width}.png`,fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});
  for(const [button,checks] of [["Approve business review",["Location and date availability confirmed","Screen specifications confirmed","Final quote accepted"]],["Confirm payment",["Payment verified in the business ledger"]],["Confirm schedule",["Display schedule confirmed"]],["Mark live",[]]]){
    await page.locator(".business-review summary").click();for(const check of checks)await page.getByLabel(check,{exact:true}).check();await page.getByLabel("Business audit note").fill("Synthetic business review, no real booking or payment.");await page.getByRole("button",{name:button,exact:true}).click();await page.waitForFunction(()=>!document.querySelector(".business-review[open]"));
  }
  assert.equal(store.campaign(asset.campaign_id).business_status,"live");
  await page.getByRole("button",{name:"Sign out",exact:true}).click();await page.waitForURL("**/admin/login");
  await page.goto(base+"/contact");await page.getByRole("button",{name:"Prepare message",exact:true}).click();assert.equal(await page.locator(".field-error").count(),3);await page.getByLabel("Full name",{exact:false}).fill("Test User");await page.getByLabel("Email",{exact:false}).fill("test@example.com");await page.getByLabel("Message",{exact:false}).fill("Synthetic local test message");await page.getByRole("button",{name:"Prepare message",exact:true}).click();await page.getByRole("heading",{name:"Your message is prepared, not sent.",exact:true}).waitFor();assert.match(await page.getByRole("link",{name:"Open email app"}).getAttribute("href"),/^mailto:panovision@gmail.com/);
  await page.goto(base+`/dashboard/${asset.campaign_id}`);await page.locator(".customer-creative img").waitFor();assert.equal(await page.locator(".proof-empty").count(),1);await page.screenshot({path:"test-results/customer-campaign-desktop.png",fullPage:true});
  await page.goto(base+"/start-campaign?type=special&occasion=Birthday&minutes=10");await next();await page.getByLabel("Campaign name",{exact:false}).fill("Synthetic video preview only");await page.getByRole("radio",{name:"8-second video",exact:true}).check();await next();await next();await page.getByLabel("Preferred start date").fill("2027-02-10");await page.getByLabel("Preferred time (Beirut)",{exact:false}).fill("18:30");await next();
  const fixture=path.resolve("test-results/synthetic-preview.webm");execFileSync(path.resolve("node_modules/@ffmpeg-installer/win32-x64/ffmpeg.exe"),["-y","-f","lavfi","-i","testsrc2=size=320x180:rate=12","-t","8","-c:v","libvpx","-an",fixture],{windowsHide:true,stdio:"ignore"});
  await page.getByLabel("Choose creative file").setInputFiles(fixture);await page.locator(".preview-display video").waitFor();await page.waitForFunction(()=>document.querySelector(".preview-display video")?.videoWidth===320);await page.getByRole("button",{name:"Play",exact:true}).click();await page.waitForFunction(()=>document.querySelector(".preview-display video").currentTime>0.2);await page.getByRole("button",{name:"Pause",exact:true}).click();assert.equal(await page.locator(".preview-warning").count(),1);await page.getByRole("button",{name:"Fill",exact:true}).click();assert.equal(await page.locator(".preview-display video").evaluate(video=>getComputedStyle(video).objectFit),"cover");await page.getByRole("button",{name:"Unmute",exact:true}).click();assert.equal(await page.locator(".preview-display video").evaluate(video=>video.muted),false);await page.getByRole("button",{name:"Restart",exact:true}).click();await page.screenshot({path:"test-results/video-preview-desktop.png",fullPage:true});
  for(const locale of ["en","fr","ar"]){
    await context.addCookies([{name:"pano_language",value:locale,url:base}]);
    for(const width of [1440,1200,1024,768,430,390,320]){
      await page.setViewportSize({width,height:width<720?844:1000});
      for(const route of ["/","/network","/how-it-works","/start-campaign?type=special","/contact","/privacy","/terms","/dashboard","/dashboard/profile",`/dashboard/${asset.campaign_id}`]){
        const response=await page.goto(base+route,{waitUntil:"networkidle"});assert.equal(response.status(),200);assert.equal(await page.locator("html").getAttribute("lang"),locale);assert.equal(await page.locator("html").getAttribute("dir"),locale==="ar"?"rtl":"ltr");assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,`${locale} ${width} ${route} overflow`);
        if(width===390&&(route==="/"||route==="/dashboard"||route==="/dashboard/profile"))await page.screenshot({path:`test-results/${locale}-${route==="/"?"home":route.slice(1).replaceAll("/","-")}-mobile.png`,fullPage:true});
        if(route==="/"||route==="/how-it-works"){assert.equal(await page.locator(".workflow-step, .pv-steps li").evaluateAll(items=>items.every(item=>item.getBoundingClientRect().width>=100)),true,`${locale} ${width} workflow columns`);if(width===390)await page.locator(route==="/"?".pv-steps":".workflow").screenshot({path:`test-results/${locale}-${route==="/"?"home":"how"}-workflow.png`});}
        results.push({locale,width,route,overflow:0});
      }
    }
    console.log(`Localized customer flows passed for ${locale}`);
    await page.setViewportSize({width:390,height:844});await page.goto(base+"/start-campaign?type=special&city=Beirut&minutes=5");
    const advance=()=>page.locator('.wizard-actions button[type="submit"]').click();await advance();await page.locator("#campaign").fill(`Synthetic ${locale} local preview`);await advance();assert.equal(await page.locator('.city-options button[aria-pressed="true"]').count(),1);await advance();await page.locator("#startDate").fill("2027-02-10");await page.locator("#preferredTime").fill("18:30");await advance();await page.locator("#creative-file").setInputFiles({name:`synthetic-${locale}.png`,mimeType:"image/png",buffer:bytes});await page.locator(".preview-display img").waitFor();await page.locator(".creative-preview").screenshot({path:`test-results/${locale}-creative-preview.png`});await advance();assert.equal(await page.locator(".request-summary").count(),0);assert.equal(await page.locator(".form-alert").count(),1);
  }
  await page.goto(base+"/dashboard/profile");await page.locator("#profile-name").fill("Updated Test User");await page.locator(".profile-layout form").first().getByRole("button").click();await page.locator(".profile-status").waitFor();await page.goto(base+"/dashboard");await page.getByRole("button",{name:"Log out",exact:true}).click();await page.waitForURL("**/login");await page.locator("#account-email").fill("test@example.com");await page.locator("#account-password").fill(password);await page.locator('.account-form button[type="submit"]').click();await page.waitForURL("**/dashboard");assert.equal(await page.locator(".campaign-list-row").count(),1);
  const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:"no-preference"});const touchPage=await touchContext.newPage();await touchPage.goto(base+"/network",{waitUntil:"networkidle"});
  const cdp=await touchContext.newCDPSession(touchPage);await touchPage.locator(".map-viewport").scrollIntoViewIfNeeded();const bounds=await touchPage.locator(".map-viewport").boundingBox();const beforeScroll=await touchPage.evaluate(()=>scrollY);const x=bounds.x+bounds.width*.6,y=Math.min(bounds.y+bounds.height-30,700);
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});for(let step=1;step<=6;step++){await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y-step*25,id:1}]});await touchPage.waitForTimeout(30);}await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await touchPage.waitForFunction(start=>scrollY>start+20,beforeScroll);
  await touchPage.locator(".map-viewport").scrollIntoViewIfNeeded();const pinch=await touchPage.locator(".map-viewport").boundingBox(),cx=pinch.x+pinch.width/2,cy=Math.max(180,Math.min(650,pinch.y+pinch.height/2));
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});for(let step=1;step<=5;step++){await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:cx-30-step*9,y:cy,id:1},{x:cx+30+step*9,y:cy,id:2}]});await touchPage.waitForTimeout(35);}await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await touchPage.waitForFunction(()=>Number(document.querySelector(".map-scene").dataset.scale)>1.2);await touchPage.getByRole("button",{name:"Reset view",exact:true}).tap();
  await touchPage.goto(base,{waitUntil:"networkidle"});const scan=touchPage.locator(".pv-screen-timer").first(),firstTransform=await scan.evaluate(element=>getComputedStyle(element).transform);await touchPage.waitForTimeout(200);assert.notEqual(await scan.evaluate(element=>getComputedStyle(element).transform),firstTransform);await touchPage.getByRole("button",{name:"Pause display animation",exact:true}).tap();await touchPage.waitForTimeout(100);const pausedTransform=await scan.evaluate(element=>getComputedStyle(element).transform);await touchPage.waitForTimeout(200);assert.equal(await scan.evaluate(element=>getComputedStyle(element).transform),pausedTransform);await touchContext.close();console.log("Touch scrolling, pinch zoom and hero animation controls passed");
  assert.deepEqual(errors,[]);await fs.writeFile("test-results/browser-report.json",JSON.stringify({checks:results,consoleErrors:errors,workflow:"passed with real storage and test-only injected classifier",admin:"passed",menu:"passed",map:"passed",contact:"passed local draft",privateData:"isolated and removed after test"},null,2));console.log("Browser suite passed: responsive website, three creative versions, server gates, admin review and business transitions.");
}catch(error){
  const active=browser?.contexts()[0]?.pages()[0];
  if(active){await active.screenshot({path:"test-results/browser-failure.png",fullPage:true});await fs.writeFile("test-results/browser-failure.txt",await active.locator("body").innerText());}
  throw error;
}finally{
  if(errors.length||httpErrors.length)console.error(JSON.stringify({errors,httpErrors}));
  await browser?.close();store.close();const exited=new Promise(resolve=>server.once("exit",resolve));if(server.exitCode===null){server.kill();await exited;}
  assert.equal(path.dirname(root),path.resolve("test-results"));assert.ok(path.basename(root).startsWith("browser-private-"));await fs.rm(root,{recursive:true,force:true});
}
