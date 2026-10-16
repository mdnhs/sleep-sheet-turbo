// The built-in product page ad ("Insert sample" in Promotions → Product page
// ad). Plain HTML/CSS/JS for the sandboxed ad frame.
//
// It reads the live promotions (/api/promotions/live) and builds its copy
// from them — payment method, minimum order, zones, end date — so it never
// promises an offer that isn't running. With no live offer it falls back to
// cash on delivery. Two layouts, picked by html[data-slot] (set by the page):
// "compact" fills the phone strip (~110–160px wide, ~160px tall: tag,
// headline and the button) and "full" sizes itself in the tablet/desktop
// strip (~130–260px wide, up to ~480px tall: a delivery truck, a countdown
// and rotating reassurances).
// It reads the list as this visitor sees it (html[data-visitor]): an offer with
// a personal time limit then ends at this visitor's own end, which checkout
// enforces, so its short countdown is real.
// The offer's minimum order is only stated when this product's price
// (html[data-price]) is below it, so the "free delivery" line stays true.
// "অর্ডার করুন" is drawn here, but the page makes the whole ad its Order Now
// button (product-ad-slot.tsx), so this code needs no click handling.
// Respects reduced motion. No backticks or "${" below: this is a raw string.
export const SAMPLE_AD = String.raw`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@500;700&display=swap">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  [hidden] { display: none !important; }
  body { font-family: "Hind Siliguri", "Noto Sans Bengali", system-ui, sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }
  /* Phone strip: sleek floating badge, centered vertically. */
  html[data-slot="compact"], html[data-slot="compact"] body { height: auto; min-height: 0; }
  html[data-slot="compact"] .ad { display: flex; flex-direction: column; align-items: center; justify-content: center;
                                   border-radius: 16px; padding: 8px 6px 10px; max-width: 130px; margin: 0 auto; }
  .ad { position: relative; display: block; overflow: hidden; border-radius: 16px; padding: 10px 8px 11px;
        text-align: center; color: #fff; text-decoration: none;
        border: 1px solid rgba(255, 255, 255, 0.35);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(184, 36, 90, 0.4);
        background: linear-gradient(145deg, rgba(255, 111, 165, 0.95) 0%, rgba(184, 36, 90, 0.98) 100%);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .ad::after { content: ""; position: absolute; top: -30%; bottom: -30%; left: -70%; width: 45%; transform: rotate(18deg);
               background: linear-gradient(90deg, transparent, rgba(255,255,255,.38), transparent);
               animation: shine 3.4s ease-in-out infinite; pointer-events: none; }
  @keyframes shine { 0%, 60% { left: -70%; } 100% { left: 150%; } }

  .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: 999px;
         background: rgba(0,0,0,.3); font-size: clamp(8px, 6.8vw, 11px); font-weight: 700; white-space: nowrap; }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: #3ef59a; flex: none; animation: ping 1.6s infinite; }
  @keyframes ping { 0% { box-shadow: 0 0 0 0 rgba(62,245,154,.85); } 70%, 100% { box-shadow: 0 0 0 6px rgba(62,245,154,0); } }

  .head { margin-top: 4px; font-weight: 700; font-size: clamp(12px, 9.5vw, 18px); line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,.25); }
  .free { display: inline-block; margin-top: 2px; padding: 0 5px; border-radius: 5px; color: #12301f; background: #3ef59a;
          transform: rotate(-3deg); animation: wiggle 2.4s ease-in-out infinite; }
  @keyframes wiggle { 0%, 78%, 100% { transform: rotate(-3deg) scale(1); } 86% { transform: rotate(4deg) scale(1.14); } 93% { transform: rotate(-5deg) scale(1.06); } }
  .sub { margin-top: 3px; font-size: clamp(8.5px, 6.8vw, 11.5px); font-weight: 600; opacity: .95; white-space: nowrap; }

  .cta { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 3px; margin-top: 6px; padding: 3px 9px;
         border-radius: 999px; background: #fff; color: #b8245a; font-size: clamp(9px, 7.2vw, 12px);
         font-weight: 700; line-height: 1.3; box-shadow: 0 2px 8px rgba(0,0,0,.25);
         animation: beat 1.8s ease-in-out infinite; }
  .cta i { font-style: normal; display: inline-block; animation: nudge 1.2s ease-in-out infinite; }
  .cta i.n { animation-name: point; }
  .cta i.w { display: none; }
  html[data-slot="full"] .cta i.w { display: inline-block; }
  @keyframes nudge { 50% { transform: translateX(3px); } }
  @keyframes point { 50% { transform: translateY(3px); } }
  @keyframes beat { 0%, 70%, 100% { transform: scale(1); } 80% { transform: scale(1.08); } 90% { transform: scale(.98); } }

  /* Full layout only (frame 170px and wider). */
  .w { display: none; }
  .road { position: relative; height: 34px; margin: 10px auto 0; }
  .road::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; opacity: .7;
                 background: repeating-linear-gradient(90deg, #fff 0 9px, transparent 9px 16px); animation: road .5s linear infinite; }
  @keyframes road { to { background-position: -16px 0; } }
  .truck { position: absolute; left: 50%; bottom: 3px; width: 62px; margin-left: -31px; animation: bob .45s ease-in-out infinite alternate; }
  @keyframes bob { to { transform: translateY(-1.5px); } }
  .speed { position: absolute; left: 50%; bottom: 10px; margin-left: -60px; width: 24px; }
  .speed b { display: block; height: 2px; margin: 4px 0; border-radius: 2px; background: rgba(255,255,255,.85); animation: speed .6s linear infinite; }
  .speed b:nth-child(2) { width: 70%; margin-left: 30%; animation-delay: .2s; }
  .speed b:nth-child(3) { width: 85%; margin-left: 15%; animation-delay: .4s; }
  @keyframes speed { from { transform: translateX(8px); opacity: 1; } to { transform: translateX(-10px); opacity: 0; } }
  .cdl { margin-top: 10px; font-size: 11px; opacity: .9; }
  /* Compact: three units with their names (দিন ঘণ্টা মিনিট, or ঘণ্টা মিনিট সেকেন্ড). */
  .cd { display: grid; grid-template-columns: repeat(3, minmax(0, 34px)); justify-content: center; gap: 3px; margin-top: 5px; }
  .cd div { padding: 3px 0 2px; border-radius: 7px; background: rgba(0,0,0,.24); }
  .cd b { display: block; font-size: clamp(11px, 10vw, 15px); line-height: 1.1; }
  .cd small { display: block; font-size: 7.5px; opacity: .85; white-space: nowrap; }
  html[data-slot="full"] .cd { grid-template-columns: repeat(4, minmax(0, 46px)); gap: 4px; margin-top: 4px; }
  html[data-slot="full"] .cd div { padding: 4px 0 3px; border-radius: 9px; }
  html[data-slot="full"] .cd b { font-size: clamp(13px, 11vw, 17px); }
  html[data-slot="full"] .cd small { font-size: 8px; }
  .tick { animation: tick .35s ease-out; }
  @keyframes tick { from { transform: scale(1.18); } to { transform: scale(1); } }
  .rot { position: relative; height: 32px; margin-top: 10px; font-size: clamp(10.5px, 8.6vw, 12px); font-weight: 500; line-height: 1.3; }
  .rot span { position: absolute; left: 0; right: 0; top: 50%; opacity: 0; transform: translateY(calc(-50% + 7px)); transition: opacity .25s, transform .4s; }
  .rot span.on { opacity: 1; transform: translateY(-50%); transition-delay: .2s; }
  .rot span.out { opacity: 0; transform: translateY(calc(-50% - 7px)); }

  /* Tablet / desktop strip. vw = the frame's width (~130–260px). */
  html[data-slot="full"] .w { display: revert; }
  html[data-slot="full"] .n { display: none; }
  html[data-slot="full"] .ad { padding: 16px 10px; border-radius: 18px; }
  html[data-slot="full"] .tag { font-size: clamp(10px, 7.6vw, 12px); }
  html[data-slot="full"] .head { margin-top: 8px; font-size: clamp(15px, 12.4vw, 24px); }
  html[data-slot="full"] .sub { margin-top: 6px; font-size: clamp(11px, 8.6vw, 13px); font-weight: 500; white-space: normal; }
  html[data-slot="full"] .cta { margin-top: 12px; padding: 6px 11px; font-size: clamp(11.5px, 9vw, 13.5px); }
  @media (prefers-reduced-motion: reduce) {
    *, *::after { animation: none !important; transition: none !important; }
  }
</style>

<div class="ad" id="ad" hidden>
  <span class="tag"><i class="dot"></i><span id="tagN" class="n"></span><span id="tagW" class="w"></span></span>
  <div class="road w" aria-hidden="true">
    <span class="speed"><b></b><b></b><b></b></span>
    <svg class="truck" viewBox="0 0 64 32">
      <rect x="2" y="7" width="35" height="17" rx="3" fill="#fff"/>
      <path d="M37 12h10l8 7v5H37z" fill="#ffe1ec"/>
      <rect x="41" y="14" width="7" height="5" rx="1" fill="#b8245a"/>
      <text id="truckLabel" x="19.5" y="19.5" font-size="8" font-weight="700" fill="#b8245a" text-anchor="middle">ফ্রি</text>
      <circle cx="13" cy="25" r="4.2" fill="#3b0a1e" stroke="#fff" stroke-width="1.6"/>
      <circle cx="46" cy="25" r="4.2" fill="#3b0a1e" stroke="#fff" stroke-width="1.6"/>
    </svg>
  </div>
  <p class="head"><span id="how"></span><br><span id="what"></span></p>
  <p class="sub" id="cond" hidden></p>
  <div id="cdBox">
    <p class="cdl w" id="cdl">অফার শেষ হতে বাকি</p>
    <div class="cd">
      <div id="cdDc"><b id="cdD">০০</b><small>দিন</small></div>
      <div><b id="cdH">০০</b><small>ঘণ্টা</small></div>
      <div><b id="cdM">০০</b><small>মিনিট</small></div>
      <div id="cdSc"><b id="cdS">০০</b><small>সেকেন্ড</small></div>
    </div>
  </div>
  <div class="rot w" id="rot">
    <span class="on">✓ ক্যাশ অন ডেলিভারিও আছে</span>
    <span>✓ পণ্য খুলে দেখে নিন</span>
    <span>✓ ৭ দিনে সহজ রিপ্লেসমেন্ট</span>
  </div>
  <span class="cta">অর্ডার করুন <i class="n">👇</i><i class="w">➜</i></span>
</div>

<script>
(function () {
  var DIGITS = "০১২৩৪৫৬৭৮৯";
  function bn(value) { return String(value).replace(/[0-9]/g, function (d) { return DIGITS[d]; }); }
  function two(n) { return bn(n < 10 ? "0" + n : String(n)); }
  function taka(n) { return "৳" + bn(Math.round(n).toLocaleString("en-IN")); }
  function $(id) { return document.getElementById(id); }

  var METHOD = { bkash: "বিকাশ", cod: "ক্যাশ অন ডেলিভারি", card: "কার্ড" };
  var ad = $("ad");
  var timer = null;

  function fallback() {
    if (timer) clearInterval(timer);
    $("tagN").textContent = "নিশ্চিন্তে কিনুন";
    $("tagW").textContent = "নিশ্চিন্তে কিনুন";
    $("truckLabel").textContent = "COD";
    $("how").textContent = "ক্যাশ অন";
    $("what").textContent = "ডেলিভারি";
    $("cond").textContent = "পণ্য হাতে পেয়ে টাকা দিন";
    $("cond").hidden = false;
    $("cdBox").hidden = true;
    ad.hidden = false;
  }

  function show(promo) {
    var methods = (promo.paymentMethods || []).filter(function (m) { return METHOD[m]; });
    var how = methods.length === 1 && methods[0] === "bkash" ? "বিকাশে পেমেন্ট"
      : methods.length === 1 && methods[0] === "cod" ? "ক্যাশ অন ডেলিভারিতে"
      : methods.map(function (m) { return METHOD[m]; }).join(" বা ") + "-এ";
    // The product's price, from the page: the minimum is only worth stating
    // when this product alone doesn't reach it.
    var price = Number(document.documentElement.getAttribute("data-price")) || 0;

    $("how").textContent = how;
    $("what").innerHTML = 'ডেলিভারি <span class="free">ফ্রি!</span>';
    var short = promo.minOrderAmount && price < promo.minOrderAmount;
    $("cond").textContent = short ? taka(promo.minOrderAmount) + "+ অর্ডারে" : "";
    $("cond").hidden = !short;
    var personal = !!promo.personalWindowMinutes;
    $("tagW").textContent = personal ? "শুধু আপনার জন্য" : promo.endsAt ? "সীমিত সময়ের অফার" : "চলমান অফার";
    $("tagN").textContent = personal ? "শুধু আপনার জন্য" : promo.endsAt ? "সীমিত সময়" : "চলমান অফার";
    if (personal) $("cdl").textContent = "আপনার অফার শেষ হতে বাকি";

    var end = promo.endsAt ? new Date(promo.endsAt).getTime() : null;
    // Compact shows three units: দিন ঘণ্টা মিনিট while a day or more is left,
    // ঘণ্টা মিনিট সেকেন্ড after that. Full shows all four.
    var compact = document.documentElement.getAttribute("data-slot") !== "full";
    if (!end) {
      $("cdBox").hidden = true;
    } else {
      var last = -1;
      var tick = function () {
        var left = Math.floor((end - Date.now()) / 1000);
        if (left <= 0) return fallback();
        var d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
        if (compact) {
          $("cdDc").hidden = d < 1;
          $("cdSc").hidden = d >= 1;
        }
        $("cdD").textContent = two(d);
        $("cdH").textContent = two(h);
        $("cdM").textContent = two(m);
        var sec = $("cdS");
        sec.textContent = two(s);
        if (s !== last) { sec.classList.remove("tick"); void sec.offsetWidth; sec.classList.add("tick"); last = s; }
      };
      tick();
      timer = setInterval(tick, 1000);
    }
    ad.hidden = false;
  }

  // Reassurances take turns.
  var lines = $("rot").children, current = 0;
  setInterval(function () {
    var leaving = lines[current];
    leaving.classList.remove("on");
    leaving.classList.add("out");
    setTimeout(function () { leaving.classList.remove("out"); }, 450);
    current = (current + 1) % lines.length;
    lines[current].classList.add("on");
  }, 2600);

  var visitor = document.documentElement.getAttribute("data-visitor");
  fetch("/api/promotions/live" + (visitor ? "?visitor=" + encodeURIComponent(visitor) : ""))
    .then(function (r) { return r.ok ? r.json() : { promotions: [] }; })
    .then(function (data) {
      var list = (data && data.promotions) || [];
      var promo = list.filter(function (p) { return (p.paymentMethods || []).indexOf("bkash") !== -1; })[0] || list[0];
      if (promo) show(promo); else fallback();
    })
    .catch(fallback);
})();
</script>`;
