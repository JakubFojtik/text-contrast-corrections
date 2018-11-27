

// ==UserScript==
// @name          Text contrast corrections
// @namespace     https://github.com/JakubFojtik/text-contrast-corrections
// @description   Sets minimum font width to normal and increases contrast between text and background if necessary.
// @author        Jakub Fojtík
// @include       *
// @version       1.6
// ==/UserScript==

//Todo:
//Rerun for lazy-loaded content e.g. comments on gog.com
//Detect background-image or skip color changes if detected. Same for background gradients.

(function () {

  let elemBgcol = new Map();
  
  class Color {
    constructor(colorSpec) {
      let regex = /[0-9.]+/g; //allow for missing leading zero, at least FF displays colors like that
      let parts = colorSpec.match(regex);

      if (parts.length >= 3) {
        let parsedParts = [];
        parts.forEach(function (part, idx) {
          parsedParts[idx] = parseFloat(part);
        });
        if (parsedParts.length < 4) parsedParts[3] = 255;
        this.parts = parsedParts;
      } else {
        console.log('bad colorspec ' + colorSpec);
      }
    }
    alpha() {
      return this.parts[3];
    }
    isTransparent() {
      return this.alpha() == 0;
    }
    isOpaque() {
      //margin of error for float operations
      let e = 1;
      let diff = Math.abs(this.alpha() - 255);
      return diff < e;
    }
    toString() {
      return 'rgba(' + this.parts.join(', ') + ')';
    }
    brightness() {
      if (!this.isOpaque()) {
        console.log('error getting brightness of alpha color');
        return 128; //return 255/2, so that lighter/darker color detection still works somewhat. Should not be called on non-opaque colors anyway.
      }
      return this.parts.slice(0, 4).reduce((a, b) => a + b, 0) / 3;
    }
    changeLum(brighten) {
      let fun = brighten ? Math.min : Math.max;
      let limit = brighten ? 255 : 0;
      let op = brighten ? (a, b) => a + b : (a, b) => a - b;
      for (let i = 0; i < 4; i++) {
        this.parts[i] = fun(limit, op(this.parts[i], 80));
      }
    }
    //Both corrects the color and reports if it was correct
    correct(brighten) {
      //If color is extreme enough it is ok, otherwise make it more extreme (whiter or blacker).
      let isSaturatedEnough = brighten ? (a, b) => a > b : (a, b) => a < b;
      let saturationLimit = brighten ? 192 : 64;
      //If at least one color part is dark then the color is dark - #f0f is purple.
      //But #ff0 is yellow, todo improve algorithm
      for (let i = 0; i < 4; i++) {
        if (isSaturatedEnough(this.parts[i], saturationLimit)) return true;
      }
      this.changeLum(brighten);
      return false;
    }
    //Computes final color of alpha color on solid background
    asOpaque(bgColor) {
      if (this.isOpaque()) return this;
      if (!bgColor.isOpaque()) console.log('error bgcolor is not opaque: ' + bgColor.toString());

      let color = new Color(this.toString());
      color.parts[3] = 255;

      let alpha = this.alpha();
      color.parts.slice(0, 4).forEach(function (part, idx) {
        let col = part * alpha;
        let bgCol = bgColor.parts[idx] * (1 - alpha);
        color.parts[idx] = col + bgCol;
      });

      return color;
    }
  }


  function elementsUnder(el) {
    let n, a = [],
      walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, null, false);
    while (n = walk.nextNode()) a.push(n);
    return a;
  }
  
  function getBgColor(el, bgProp) {
    return elemBgcol.has(el) ? elemBgcol.get(el) : new Color(window.getComputedStyle(el).getPropertyValue(bgProp));
  }

  function findAndMergeBgCol(element, bgProp) {
    let col = getBgColor(element, bgProp);

    if (!col.isOpaque()) { //Background color can not be computed, if not directly set, it returns rgba(0,0,0,0)
      let colors = [{
        col: col,
        el: element
      }]; //tuple of element aand its bgcolor, so computed color can later be assigned back
      let bgcolor = new Color('rgb(255, 255, 255)'); //default bg color if all elements report transparent
      let el = element;
      while (el.parentNode instanceof Element) {
        el = el.parentNode;
        col = getBgColor(el, bgProp); //Is getComputedStyle inspecting also parent elements for non-computable bgcolor? If yes, optimize?
        if (!col.isTransparent()) colors.push({
          col: col,
          el: el
        }); //save transparent colors for later blending
        if (col.isOpaque()) { //need to reach an opaque color to blend the transparents into
          bgcolor = col;
          break;
        }
      }
      if (el.parentNode == null) colors.push({
        col: bgcolor,
        el: el
      }); //ensure final color is in the array
      col = bgcolor;

      //Compute all alpha colors with the final opaque color
      //So Blue->10%Red->15%Green should be 85%(90%Blue+10%Red)+15%Green
      //Todo gradients and bgimages
      colors.reverse().slice(1).forEach(function (colEl) {
        col = colEl.col.asOpaque(col);
        elemBgcol.set(colEl.el, col);
      });
    }

    return col;
  }

  function computeColors(element, fgProp, bgProp) {
    let bgColor = findAndMergeBgCol(element, bgProp);

    //Now we can compute fg color even if it has alpha
    let col = new Color(window.getComputedStyle(element).getPropertyValue(fgProp));
    let fgColor = col.asOpaque(bgColor);

    return {
      fgCol: fgColor,
      bgCol: bgColor
    };
  }

  elementsUnder(document.body).forEach(function (element) {
    //if(element.className!='Counter') return;
    let fw = window.getComputedStyle(element).getPropertyValue('font-weight');
    if (fw < 400) element.style.setProperty("font-weight", 400, "important");

    let cols = computeColors(element, 'color', 'background-color');
    let col = cols.fgCol;
    let bgcol = cols.bgCol;

    let isColBrighter = col.brightness() > bgcol.brightness();
    if (!col.correct(isColBrighter)) {
      element.style.setProperty("color", col.toString(), "important");
    }
    if (!bgcol.correct(!isColBrighter)) {
      element.style.setProperty("background-color", bgcol.toString(), "important");
    }
    //if(element.tagName.localeCompare('code', 'en', {sensitivity: 'accent'}) == 0)

  });
})();

