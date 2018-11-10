

// ==UserScript==
// @name          Text contrast corrections
// @namespace     https://github.com/JakubFojtik/text-contrast-corrections
// @description   Sets minimum font width to normal and increases contrast between text and background if necessary.
// @author        Jakub Fojtík
// @include       *
// @version       1.2
// ==/UserScript==

//Todo:
//Rerun for lazy-loaded content e.g. comments on gog.com
//Save intermediate results for speed
//Detect background-image or skip color changes if detected. Same for background gradients.

(function () {

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
    isTransparent() {
      return this.parts[3] == 0;
    }
    isOpaque() {
      return this.parts[3] == 255;
    }
    alpha() {
      return this.parts[3];
    }
    toString() {
      return 'rgba(' + this.parts.join(', ') + ')';
    }
    brightness() {
      if (!this.isOpaque()) return 128; //return 255/2, so that contrast correction still works. Todo compute alpha brightness properly
      return this.parts.slice(0, 4).reduce((a, b) => a + b, 0) / 3;
    }
    /*
    asOpaque(brighten) {
      if(this.isOpaque()) return this.parts;
      
      let opParts = [];
      this.parts.slice(0,4).forEach(function (part, idx) {
        let finalCol = brighten ? 255-this.parts[3] : this.parts[3];
        opParts[idx] = part*finalCol/255;
      });
      opParts[3] = 255;
    }
    */
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

  }


  function elementsUnder(el) {
    var n, a = [],
      walk = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, null, false);
    while (n = walk.nextNode()) a.push(n);
    return a;
  }

  function computeColor(element, prop) {
    var col = new Color(window.getComputedStyle(element).getPropertyValue(prop));

    if (!col.isOpaque()) { //Background color can not be computed, if not directly set returns rgba(0,0,0,0)
      let colors = [col];
      let bgcolor = new Color('rgb(255, 255, 255)'); //default bg color if all elements report transparent
      let el = element;
      while (el.parentNode != null) {
        el = el.parentNode;
        col = new Color(window.getComputedStyle(el).getPropertyValue(prop)); //Is getComputedStyle inspecting also parent elements for non-computable bgcolor? If yes, optimize?
        if (!col.isTransparent()) colors.push(col);
        if (col.isOpaque()) { //Only accepts fully opaque color, partialy transparent colors are ignored. Todo compute them into the resulting color.
          bgcolor = col;
          break;
        }
      }
      if (element.parentNode == null) colors.push(bgcolor);
      col = bgcolor;

      //if(element.tagName.localeCompare('code', 'en', {sensitivity: 'accent'}) == 0) alert(colors.reverse().slice(1));

      //Compute all alpha colors with the final opaque color
      //So Blue->10%Red->15%Green should be 85%(90%Blue+10%Red)+15%Green
      //Todo proper alpha blending, this does not seem to give correct results with e.g (1,1,1,0.05)
      colors.reverse().slice(1).forEach(function (color, idx, arr) {
        let newColPerc = color.alpha() / 255;
        color.parts.slice(0, 4).forEach(function (part, idx) {
          let newPart = part * newColPerc;
          let oldPart = col.parts[idx] * (1 - newColPerc);
          col.parts[idx] = newPart + oldPart;
        });
      });
      col.parts[3] = 255;

      //Todo create global dictionary of elemt->bgcolor for later lookup. Also assign computed bgcolor to elements between the current and the colored.
      //So that  Blue->transp->transp->transp becomes not only Blue->transp->transp->Blue,
      //but also Blue->Blue->  Blue->  Blue

      /*
      //Stub for applying partial transparency to the color parts.
      //To make background "more transparent" means making it more of the opaque color it has - if it is bright then brighten, else darken.
      if(!isColOpaque(parts)) {
        parts.forEach(function(part, idx, arr) {
          arr[idx] = Math.round(Math.max(0,part*(255-arr[3])/255));	//todo alter for darkening, maybe compute intermediate colors
        });
      }
      */
    }

    //if(element.tagName.localeCompare('code', 'en', {sensitivity: 'accent'}) == 0) alert(prop + col + col.isOpaque());

    return col;
  }

  elementsUnder(document.body).forEach(function (element) {
    //if(element.className!='curated-tile__title-wrapper') return;
    let fw = window.getComputedStyle(element).getPropertyValue('font-weight');
    if (fw < 400) element.style.setProperty("font-weight", 400, "important");

    var col = computeColor(element, 'color');
    var bgcol = computeColor(element, 'background-color');
    //alert(col + ', ' + bgcol);
    let isColBrighter = col.brightness() > bgcol.brightness();
    //if(isColBrighter) alert('pre'+colParts + ', ' + bgcParts);
    //if(element.tagName.localeCompare('code', 'en', {sensitivity: 'accent'}) == 0)
    //  alert(col+bgcol);
    if (!col.correct(isColBrighter)) {
      element.style.setProperty("color", col.toString(), "important");
    }
    if (!bgcol.correct(!isColBrighter)) {
      element.style.setProperty("background-color", bgcol.toString(), "important");
    }
    //if(element.tagName.localeCompare('code', 'en', {sensitivity: 'accent'}) == 0)
    //  alert(col+bgcol);
    //alert(colParts + ', ' + bgcParts);


  });
})();

