/* CloutRadar — sparse falling autumn leaves (decorative, never blocks clicks). */
(function () {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var mobile = matchMedia("(max-width: 767px)").matches;
  var MAX = mobile ? 15 : 20;
  var COLORS = ["#c2410c", "#d97706", "#9f1239", "#ca8a04"];
  var SHAPES = [
    // maple
    '<path d="M16 1l2.4 5.6 4.2-2.2-1 5.4 5.6-1.4-2.6 4.4 4.4 1.8-5 2.4 1.2 3.4-4.8-1.2.6 5.8h-2l.6-5.8-4.8 1.2 1.2-3.4-5-2.4 4.4-1.8L3.8 8.4l5.6 1.4-1-5.4 4.2 2.2z"/>' +
      '<path class="v" d="M16 6v24M16 14l-6-4M16 14l6-4M16 19l-7 1M16 19l7 1"/>',
    // oak
    '<path d="M16 1c2 1.5 1 3.5 2.6 4.2 1.8.8 3.4-.6 4 1.2.6 1.8-1.8 2.6-1 4.2.8 1.6 3.2 1 3.2 3s-2.6 1.8-2.8 3.6c-.2 1.8 2 2.6 1 4.2-1 1.6-3-.2-4.2 1.2-1 1.2.2 3.4-1.4 4.4L16 31l-1.4-4c-1.6-1-.4-3.2-1.4-4.4-1.2-1.4-3.2.4-4.2-1.2-1-1.6 1.2-2.4 1-4.2-.2-1.8-2.8-1.6-2.8-3.6s2.4-1.4 3.2-3c.8-1.6-1.6-2.4-1-4.2.6-1.8 2.2-.4 4-1.2C14.6 4.5 13.6 2.5 16 1z"/>' +
      '<path class="v" d="M16 4v26M16 11l-4-2M16 11l4-2M16 17l-5-1M16 17l5-1M16 23l-4 0M16 23l4 0"/>',
    // simple leaf
    '<path d="M16 2C25 8 27 18 16 30 5 18 7 8 16 2z"/>' +
      '<path class="v" d="M16 5v24M16 12l-4-3M16 12l4-3M16 18l-5-3M16 18l5-3M16 24l-4-3M16 24l4-3"/>',
  ];

  var layer = document.createElement("div");
  layer.className = "leaves";
  layer.setAttribute("aria-hidden", "true");
  var anchor = document.querySelector(".page");
  (anchor && anchor.parentNode ? anchor.parentNode.insertBefore(layer, anchor) : document.body.appendChild(layer));

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function spawn(initialDelay) {
    var size = rnd(14, 34);
    var dur = rnd(12, 22);
    var el = document.createElement("div");
    el.className = "leaf";
    el.style.left = rnd(2, 98) + "vw";
    el.style.width = el.style.height = size + "px";
    el.style.opacity = rnd(0.6, 0.85).toFixed(2);
    el.style.setProperty("--dur", dur + "s");
    el.style.setProperty("--sway", rnd(18, 60).toFixed(0) + "px");
    el.style.setProperty("--swayDur", rnd(3.5, 6.5).toFixed(2) + "s");
    el.style.setProperty("--spin", (Math.random() < 0.5 ? -1 : 1) * rnd(180, 540) + "deg");
    el.style.setProperty("--flipDur", rnd(4, 9).toFixed(2) + "s");
    el.style.animationDelay = initialDelay + "s";
    var color = COLORS[(Math.random() * COLORS.length) | 0];
    el.innerHTML =
      '<div class="leaf-sway" style="animation-delay:' + initialDelay + 's"><svg class="leaf-svg" viewBox="0 0 32 32" style="color:' + color + '">' +
      SHAPES[(Math.random() * SHAPES.length) | 0] + "</svg></div>";
    el.addEventListener("animationend", function (e) {
      if (e.target !== el) return;
      el.remove();
      spawn(rnd(0, 4));
    });
    layer.appendChild(el);
  }

  for (var i = 0; i < MAX; i++) spawn(i * rnd(1.4, 2.4));

  document.addEventListener("visibilitychange", function () {
    layer.style.animationPlayState = document.hidden ? "paused" : "running";
  });
})();
