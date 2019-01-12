// ==UserScript==
// @name          Text contrast corrections
// @namespace     https://github.com/JakubFojtik/text-contrast-corrections
// @description   Sets minimum font width to normal and increases contrast between text and background if necessary. Also colors scrollbar for better contrast.
// @author        Jakub Fojtík
// @include       *
// @version       1.15
// @run-at        document-idle
// @require       https://raw.githubusercontent.com/JakubFojtik/color-thief/master/src/color-thief.js
// ==/UserScript==

//Todo:
//Rerun for lazy-loaded content e.g. comments on gog.com
//Detect background gradients.
//Ask for bg image only if nested element needs it. load it async, in callback just rerun for child elements of the image
//Choose scrollbar foreground color to contrast page background.

try
{
  (function () {

    let elemBgcol = new Map();
    let colorThief = new ColorThief();
    let imgCounter=0;

    function getBgImageUrl(element) {
      let url = window.getComputedStyle(element).getPropertyValue('background-image');
      if(url && url != 'none') {
        //skip nonrepeated bg in case of e.g. list item bullet images
        let repeat = window.getComputedStyle(element).getPropertyValue('background-repeat');
	      return repeat != 'no-repeat' ? url.split('"')[1] : null;
      }
    }

    class Color {
      constructor(colorSpec) {
        let regex = /[0-9.]+/g; //allow for missing leading zero, at least FF displays colors like that
        let parts = colorSpec.match(regex);

        if (parts.length >= 3) {
          let parsedParts = [];
          parts.forEach((part, idx) => {
            parsedParts[idx] = parseFloat(part);
          });
          if (parsedParts.length < 4) parsedParts[3] = 1;
          this.parts = parsedParts;
        } else {
          console.log('bad colorspec ' + colorSpec);
        }
      }
      alpha() {
        return Math.min(this.parts[3], 1);
      }
      isTransparent() {
        return this.isAlphaNear(0);
      }
      isOpaque() {
        return this.isAlphaNear(1);
      }
      isAlphaNear(num) {
        //margin of error for float operations
        let e = 0.01;
        let diff = Math.abs(num - this.alpha());
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
        return this.getRGBParts().reduce((a, b) => a + b, 0) / 3;
      }
      changeLum(brighten) {
        let fun = brighten ? Math.min : Math.max;
        let limit = brighten ? 255 : 0;
        let op = brighten ? (a, b) => a + b : (a, b) => a - b;
        for (let i = 0; i < this.getRGBParts().length; i++) {
//console.log(this.parts[i] + ' to ' + fun(limit, op(this.parts[i], 80)));
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
        for (let i = 0; i < this.getRGBParts().length; i++) {
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
        color.parts[3] = 1;

        let alpha = this.alpha();
        color.getRGBParts().forEach((part, idx) => {
          let col = part * alpha;
          let bgCol = bgColor.parts[idx] * (1 - alpha);
          color.parts[idx] = col + bgCol;
        });

        return color;
      }
      getRGBParts() {
        return this.parts.slice(0, 3);
      }
    }

    function getBgColor(el, bgProp) {
      return elemBgcol.has(el) ? elemBgcol.get(el) : new Color(window.getComputedStyle(el).getPropertyValue(bgProp));
    }

    function findAndMergeBgCol(element, bgProp) {
      let colors = []; //tuples of element and its bgcolor, so computed bgcolor can later be remembered

      let bgcolor = new Color('rgb(255, 255, 255)'); //default bg color if all elements report transparent
      let el = element;
      let col;

      while (el instanceof Element) {
        col = getBgColor(el, bgProp); //Is getComputedStyle inspecting also parent elements for non-computable bgcolor? If yes, optimize?
        if(!(col instanceof Color )) alert(el.tagName + col);
        if (!col.isTransparent()) {
          colors.push({
            col: col,
            el: el
          }); //save transparent colors for later blending
        }
        if (col.isOpaque()) { //need to reach an opaque color to blend the transparents into
          bgcolor = col;
          break;
        }
        el = el.parentNode;
      }
      if (el == null) colors.push({
        col: bgcolor,
        el: el
      }); //ensure final color is in the array
      col = bgcolor;
      
      //console.log(col + ' pak ' + colors.map(x=>x.col).join(', '));

      //Compute all alpha colors with the final opaque color
      //So Blue->10%Red->15%Green should be 85%(90%Blue+10%Red)+15%Green
      //Todo gradients
      colors.reverse().slice(1).forEach((colEl) => {
        col = colEl.col.asOpaque(col);
        elemBgcol.set(colEl.el, col);
        
        colEl.el.style.backgroundColor=col.toString();
      });

      return col;
    }

    function computeColors(element, fgProp, bgProp) {
      let bgColor = findAndMergeBgCol(element, bgProp);

      //Now we can compute fg color even if it has alpha
      let col = new Color(window.getComputedStyle(element).getPropertyValue(fgProp));
//console.log(element.tagName+element.className+element.name+col+bgColor);
      
      let fgColor = col.asOpaque(bgColor);
//console.log(element.tagName+element.className+element.name+fgColor+bgColor);

      return {
        fgCol: fgColor,
        bgCol: bgColor
      };
    }

    
    //Set scrollbar color
    let part = 120;
    let parts = Array.apply(', ', Array(3)).map(x => part).join(',');
    let scrCol = new Color(parts);
    document.getElementsByTagName("HTML")[0].style.scrollbarColor=scrCol + ' rgba(0,0,0,0)';

    //First pass - convert bg images to colors
    imgCounter = 0;
    elementsUnder(document).forEach((element) => {
      let url = getBgImageUrl(element);
      if(url) {
        imgCounter++;

        //copypaste of ColorThief.prototype.getColorFromUrl. Load events are sometimes not fired for image that already loaded e.g. <body> background image.
        //ColorThief seemingly ignores transparent pixels.
        let sourceImage = document.createElement("img");
        var thief = colorThief;
        sourceImage.addEventListener('load' , function(){
          var palette = thief.getPalette(sourceImage, 5);
          var dominantColor = palette[0];
          //console.log(palette);
          
          var avgColor = palette.reduce((a,b) => {
            return a.map((x, idx)=>{
              return (x + b[idx]) / 2;
            });
          });
          //Add some weight to the dominant color. Maybe pallete returns colors in descending dominance?
          dominantColor = dominantColor.map((x, idx)=>{
            return 0.8 * x + 0.2 * avgColor[idx];
          });
          

          element.style.setProperty("background-color", new Color(dominantColor.join(',')).toString(), "important");
          imgCounter--;
          //console.log('done'+url);
        });
        sourceImage.src = url
        //console.log(sourceImage.complete+url);
      }
    });

    //Wait for images to load
    let int = window.setInterval(() => {
      //console.log(imgCounter);
      if(imgCounter != 0) return;
      else window.clearInterval(int);
      correctThemAll();
    }, 200);

    //Stop witing after fixed time
    window.setTimeout(() => {
      if(imgCounter != 0) {
        window.clearInterval(int);
        correctThemAll();
      }
    }, 3000);

    function elementsUnder(el) {
      let n, a = [],
          walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      while (n = walk.nextNode()) {
        if(n.data.trim()=='') continue;
        let parent = n.parentNode;
        if(parent instanceof Element) a.push(parent);
      }
      return a;
    }

    //Second pass - compare and correct colors
    function correctThemAll() {
    	let elemCorrections = [];
      
      elementsUnder(document.body).forEach((element) => {
        //console.log(element.tagName);
        //if(element.getAttribute("ng-controller") != 'gogConnectCtrl as reclaim') return;
        //if(element.id != 'i016772892474772105') return;
        let fw = window.getComputedStyle(element).getPropertyValue('font-weight');
        if (fw < 400) element.style.setProperty("font-weight", 400, "important");

        let cols = computeColors(element, 'color', 'background-color');
        let col = cols.fgCol;
        let bgcol = cols.bgCol;
//console.log(element.tagName+element.className+element.name+col+bgcol);
//console.log(col.brightness() + ' ' + bgcol.brightness());
        
        let isColBrighter = col.brightness() > bgcol.brightness();
        col.correct(isColBrighter);
        elemCorrections.push({
          el: element,
          prop: "color",
          col: col.toString()
        });
/*
        if (!bgcol.correct(!isColBrighter)) {
          elemCorrections.push({
            el: element,
            prop: "background-color",
            col: bgcol.toString()
          });
        }
        */
//console.log(col.brightness() + ' ' + bgcol.brightness());
        //if(element.tagName.localeCompare('code', 'en', {sensitivity: 'accent'}) == 0)
      });

      //Write the computed corrections last so they don't afect their computation
      elemCorrections.forEach((corr) => {
        corr.el.style.setProperty(corr.prop, corr.col, "important");
        //console.log(corr.el.tagName+','+corr.prop+','+corr.col);
      });
      
    }
  })();
}
catch(e)
{
  console.log(e);
}
