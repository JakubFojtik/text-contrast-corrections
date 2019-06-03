// ==UserScript==
// @name          Text contrast corrections
// @namespace     https://github.com/JakubFojtik/text-contrast-corrections
// @description   Sets minimum font width to normal and increases contrast between text and background if necessary. Also colors scrollbar for better contrast. Configure at http://example.com/
// @author        Jakub Fojtík
// @include       *
// @version       1.35
// @run-at        document-idle
// @grant         GM.getValue
// @grant         GM.setValue
// @grant         GM.listValues
// @require       https://raw.githubusercontent.com/JakubFojtik/color-thief/master/src/color-thief.js
// @require       http://127.0.0.1:8080/classes/Configurator.js
// @require       http://127.0.0.1:8080/classes/Color.js
// @require       http://127.0.0.1:8080/classes/ElementColorFinder.js
// @require       http://127.0.0.1:8080/classes/Hacks.js
// @require       http://127.0.0.1:8080/classes/ImageColorFinder.js
// ==/UserScript==

//Todo:
//Rerun for lazy-loaded content universally e.g. comments on gog.com
//Ask for bg image only if nested element needs it. load it async, in callback just rerun for child elements of the image
//Detect readonly tags like <math> programaticaly

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

//Some tags' style cannot be modified, experimentaly gathered at a wikipedia page https://en.wikipedia.org/wiki/MathML
const readOnlyTags = ['mi', 'mo', 'mn', 'mtext', 'mo', 'annotation', 'math'];

try {
    (async () => {
        let config = new Configurator();

        //Hijack this page and show configuration box there
        if (window.location.href == 'http://example.com/') {
            config.displayForm();
        }

        //Hacks
        let hacks = new Hacks();
        hacks.doAllHacks();

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
            let imageColorFinder = new ImageColorFinder(forTextElementsUnder, correctThemAll);
            imageColorFinder.findElemBgcols();

            //Second pass - compare and correct colors
            async function correctThemAll(elemBgcols) {
                let elemCorrections = [];
                let elColFinder = new ElementColorFinder(elemBgcols);
                let desiredContrast = await config.getContrast();
              
                //let anch = document.getElementsByTagName("A").filter(x=>x.href='#dubbed')[0];

                forTextElementsUnder(document.body, (element) => {
                    //debug 
                    //console.log(element.tagName);
                    //if(element.getAttribute("ng-controller") != 'gogConnectCtrl as reclaim') return;
                    //if(element.id != 'i016772892474772105') return;
                    //if(!element.textContent.startsWith('You will ')) return;
                    //if(element.tagName!='h1') return;
                    //if(element != anch) return;
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
                        //console.log(corr.el.tagName+','+corr.prop+','+corr.col);
                        if (readOnlyTags.includes(corr.el.tagName)) {
                            return;
                        }
                        corr.el.style.setProperty(corr.prop, corr.col, "important");
                    });

                    //Set computed body background color, will only be used for scrollbar background, bgimages are not used in firefox.
                    let bodyBg = elemBgcols.get(document.body);
                    if (!bodyBg) {
                        bodyBg = new Color(window.getComputedStyle(document.body).getPropertyValue('background-color'));
                        if (!bodyBg || !bodyBg.isOpaque()) bodyBg = 'rgb(120 120 120)';
                        bodyBg = new Color(bodyBg);
                    }
                    document.documentElement.style.backgroundColor = bodyBg.toString();
                    document.body.style.backgroundColor = bodyBg.toString();
                    //Set scrollbar color
                    let scrCol = new Color('120 120 120');
                    scrCol.contrastTo(bodyBg, desiredContrast);
                    let htmlStyle = document.getElementsByTagName("HTML")[0].style;
                    htmlStyle.scrollbarColor = scrCol + ' rgba(0,0,0,0)';
                    htmlStyle.scrollbarWidth = await config.getScrollWidth();
                });

            }
        }
        restart();


    })();
} catch (e) {
    console.error(e);
}
