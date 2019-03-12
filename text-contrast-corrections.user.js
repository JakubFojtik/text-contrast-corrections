// ==UserScript==
// @name          Text contrast corrections
// @namespace     https://github.com/JakubFojtik/text-contrast-corrections
// @description   Sets minimum font width to normal and increases contrast between text and background if necessary. Also colors scrollbar for better contrast. Configure at http://example.com/
// @author        Jakub Fojtík
// @include       *
// @version       1.28
// @run-at        document-idle
// @grant         GM.getValue
// @grant         GM.setValue
// @grant         GM.listValues
// @require       https://raw.githubusercontent.com/JakubFojtik/color-thief/master/src/color-thief.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/Configurator.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/Color.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/ElementColorFinder.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/ImageColorFinder.js
// ==/UserScript==

//Todo:
//Rerun for lazy-loaded content e.g. comments on gog.com
//Detect background gradients.
//Ask for bg image only if nested element needs it. load it async, in callback just rerun for child elements of the image

//Assumptions / notes
// - bgcolor is not computed, has to be guessed from parent elements
// - bgcolor should not be adjusted, can be an average color of an image, so maybe by adjusting the image instead
// - bg image can be just a tiny bit of the element, e.g. list item point. try to skip these somehow
// - only run for text nodes to waste less time
// - colorthief needs to load its copy of the image, which is usualy from cache, but can fail completely, do not expect all images to load. possibly local network error on my side only
// - need to convert all bgimages to bgcolors, including textnode element parents, not just them
// - first pass: convert all relevant bgimages to colors
// - second pass: convert all alpha color to opaque and correct contrast
// - some sites are crazy, e.g. wikia sets background via sibling div with absolute position

try {
  (async() => {
    let config = new Configurator();

    //Hijack this page and show configuration box there
    if (window.location.href == 'http://example.com/') {
      config.displayForm();
      return;
    }

    //Hacks

    //Wikia - background via sibling div with absolute position and opacity
    let bgEl = document.getElementById('WikiaPageBackground');
    if (bgEl) {
      let newBg = window.getComputedStyle(bgEl).getPropertyValue('background-color');
      let opacity = window.getComputedStyle(bgEl).getPropertyValue('opacity');
      bgEl.style.background = 'none';
      bgEl.parentNode.style.background = newBg;
      bgEl.parentNode.style.opacity = opacity;
    }

    //Github - lazy loaded content
    //from https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
    var targetNode = document.getElementById('js-pjax-loader-bar');
    if (targetNode) {
      let callback = function (mutationsList) {
        for (let mutation of mutationsList) {
          if (mutation.attributeName == 'class' && targetNode.className == 'pjax-loader-bar') {
            restart();
          }
        }
      };
      let observer = new MutationObserver(callback);
      observer.observe(targetNode, {
        attributes: true
      });
    }

    function startAsEvent(action) {
      window.setTimeout(action, 0);
    }

    //for all text node parent elements under elemContainer starts the callback as an event
    function forTextElementsUnder(elemContainer, callback) {
      let node, elems = [],
        walk = document.createTreeWalker(elemContainer, NodeFilter.SHOW_TEXT, null, false);
      while (node = walk.nextNode()) {
        if (node.data.trim() == '') continue;
        let parent = node.parentNode;
        if (parent instanceof Element) elems.push(parent);
      }
      elems.forEach(el => {
        startAsEvent(() => {
          callback(el);
        });
      });
    }

    // The whole thing wrapped so it can be restarted on lazy-loaded content.
    //todo optimize -  reuse old elem->color maps
    function restart() {

      //First pass - convert bg images to colors, pass them to second pass
      let imageColorFinder = new ImageColorFinder(new ColorThief(), forTextElementsUnder, correctThemAll);
      imageColorFinder.findElemBgcols();

      //Second pass - compare and correct colors
      async function correctThemAll(elemBgcols) {
        let elemCorrections = [];
        let elColFinder = new ElementColorFinder(elemBgcols);
        let desiredContrast = await config.getContrast();

        forTextElementsUnder(document.body, (element) => {
          //debug 
          //console.log(element.tagName);
          //if(element.getAttribute("ng-controller") != 'gogConnectCtrl as reclaim') return;
          //if(element.id != 'i016772892474772105') return;
          //if(!element.textContent.startsWith('You will ')) return;
          let fw = window.getComputedStyle(element).getPropertyValue('font-weight');
          if (fw < 400) element.style.setProperty("font-weight", 400, "important");

          let cols = elColFinder.computeColors(element, 'color', 'background-color');
          let col = cols.fgCol;
          let bgcol = cols.bgCol;
          //console.log(element.tagName+element.className+element.name+col+bgcol);
          //console.log(col.brightness() + ' ' + bgcol.brightness());

          col.contrastTo(bgcol, desiredContrast);
          elemCorrections.push({
            el: element,
            prop: "color",
            col: col.toString()
          });
        });

        //depends on previous events being finished. Synchronicity should be ensured by JS being single-threaded and running events in received order
        startAsEvent(async () => {
          //Write the computed corrections last so they don't afect their computation
          elemCorrections.forEach((corr) => {
            corr.el.style.setProperty(corr.prop, corr.col, "important");
            //console.log(corr.el.tagName+','+corr.prop+','+corr.col);
          });
          
          //Set scrollbar color
          let scrCol = new Color('120 120 120');
          let bodyBg = elemBgcols.get(document.body);
          scrCol.contrastTo(bodyBg, desiredContrast);
          document.getElementsByTagName("HTML")[0].style.scrollbarColor = scrCol + ' rgba(0,0,0,0)';
          let scrollWidth = await config.getScrollWidth();
          document.getElementsByTagName("HTML")[0].style.scrollbarWidth = scrollWidth;
        });

      }
    }
    restart();
    

  })();
} catch (e) {
  console.error(e);
}