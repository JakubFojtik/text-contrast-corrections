// ==UserScript==
// @name          Text contrast corrections
// @namespace     https://github.com/JakubFojtik/text-contrast-corrections
// @description   Sets minimum font width to normal and increases contrast between text and background if necessary. Also colors scrollbar for better contrast. Configure at http://example.com/
// @author        Jakub Fojtík
// @include       *
// @version       2.5
// @run-at        document-idle
// @grant         GM.getValue
// @grant         GM.setValue
// @grant         GM.listValues
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/Configurator.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/Color.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/Hacks.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/ImageColorFinder.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/TextNodeWalker.js
// @require       https://raw.githubusercontent.com/JakubFojtik/text-contrast-corrections/master/classes/Length.js
// ==/UserScript==

//Todo:
//Detect readonly tags like <math> programaticaly
//sometimes does not work https://somee.com/FreeAspNetHosting.aspx
//Some tags' style cannot be modified, experimentaly gathered at a wikipedia page https://en.wikipedia.org/wiki/MathML
//proper credits for used programs with licenses
//Detect if element background is just an underline or a list item bullet e.g. linear-gradient(90deg,currentColor,currentColor)
//for images, decide if they are big enough for each element, not globaly for image, e.g. list item bullet in case first list is not displayed
//consider sprite map bg image, will be bigger than displayed portion, colors will be wrong
//match url like gradient, match exactly with braces in case of multiple bgimgs, compute gradient avg color properly

const readOnlyTags = ['mi', 'mo', 'mn', 'mtext', 'mo', 'annotation', 'math'];

try {
    (async () => {
        let config = new Configurator();

        //Hijack this page and show configuration box there
        if (window.location.href == 'http://example.com/') {
            config.displayForm();
        }

        //Hacks
        let hacks = new Hacks(restart);
        hacks.doAllHacks();

        function startAsEvent(action) {
            window.setTimeout(action, 0);
        }

        let globalData = new Map(); //computed elem=>bgColors
        //holds currently downloading urls
        let imageColorFinder = new ImageColorFinder(null, null);
        let desiredContrast = await config.getContrast();
        let walker = new TextNodeWalker();

        // The whole thing wrapped so it can be restarted on lazy-loaded content.
        //todo optimize -  reuse old elem->color maps
        async function restart() {
            //console.log('restarting');
            //computed bg cols of elements
            let elemCorrections = [];
            let walkMethod = async textElem => {
                //if(textElem.tagName!='BODY') return;
                //if(textElem.innerHTML!='text') return;
                //console.log('textElem' + textElem.innerHTML);
                //set font weight
                let fw = window.getComputedStyle(textElem).getPropertyValue('font-weight');
                if (fw < 400) textElem.style.setProperty("font-weight", 400, "important");

                //possibly transparent bgcols of elements to be computed with final opaque bgcol
                let localData = new Map(); //elem=>transBgColors
                let col = null;
                await walker.walkElemParentsUntil(textElem, async elem => {
                    //console.log('elem' + elem.tagName);
                    //get colors in localData
                    if (globalData.has(elem)) {
                        col = globalData.get(elem);
                        localData.set(elem, [col]);
                        //console.log('hascol' + localData.get(elem));
                        return true;
                    }
                    let color = imageColorFinder.tryGetBgColor(elem);
                    //console.log('col' + color);
                    let image = await imageColorFinder.tryGetBgImgColor(elem).catch((error) => {
                        console.error('imageColorFinder.tryGetBgImgColor error ' + error)
                    });
                    //console.log('img' + image);
                    let gradient = imageColorFinder.tryGetGradientColor(elem);
                    //console.log('grad' + gradient);

                    //console.log(color + ' ' + image + ' ' + gradient);
                    //let elemCol = color.combine(color, image, gradient);
                    localData.set(elem, [color, image, gradient].filter(x => x));
                    col = localData.get(elem).find(x => x && x.isOpaque());
                    if (col) col = new Color(col.getRGBParts().map(x => Math.round(x)).join(', '));
                    return col;
                }).catch((error) => {
                    console.error('walker.walkElemParentsUntil error ' + error)
                });
                //console.log('col ' + col);
                if (!col) {
                    col = new Color('255,255,255');
                }
                //recwalk array assign colors to globalData
                //either do opaque.asOpaque or duplicate globalData.set for the opaque elem
                [...localData].reverse().forEach((colEl) => {
                    //console.log('rec ' + colEl[0].id + colEl[1] + col);
                    let allCols = [col, ...colEl[1]];
                    col = allCols.reduce((acc, c) => c.asOpaque(acc));
                    //console.log('glo ' + colEl[0].tagName + colEl[0].id + col);
                    globalData.set(colEl[0], col);
                });

                //get fg col and contrast to bg col
                let fgColText = window.getComputedStyle(textElem).getPropertyValue('color');
                if (!fgColText) fgColText = '0,0,0';
                let fgCol = new Color(fgColText);
                //console.log('pre ' + fgCol + ' ' + col + textElem.id + desiredContrast);
                //fgcol can be transparent too
                fgCol = fgCol.asOpaque(col);
                //console.log('pri ' + fgCol);
                fgCol.contrastTo(col, desiredContrast);
                //console.log('post ' + fgCol + ' ' + col + textElem.id);
                elemCorrections.push({
                    el: textElem,
                    prop: "color",
                    col: fgCol.toString()
                });
                //console.log(elemCorrections);
            };

            //depends on previous events being finished.
            async function finalize() {
                //console.log('finalizing');
                //Write the computed corrections last so they don't afect their computation
                elemCorrections.forEach((corr) => {
                    //console.log(corr.el.tagName+','+corr.prop+','+corr.col);
                    if (readOnlyTags.includes(corr.el.tagName)) {
                        return;
                    }
                    corr.el.style.setProperty(corr.prop, corr.col, "important");
                    //corr.el.style.setProperty('mix-blend-mode', 'luminosity', "important");
                });

                //Set computed body background color, will only be used for scrollbar background, bgimages are not used in firefox.
                await walkMethod(document.body).catch((error) => {
                    console.error('walkMethod(document.body) error ' + error)
                });
                //console.log('walked');
                let bodyBg = globalData.get(document.body);
                if (!bodyBg) {
                    console.error('should not happen, body col should be known');
                    bodyBg = new Color(window.getComputedStyle(document.body).getPropertyValue('background-color'));
                    if (!bodyBg || !bodyBg.isOpaque()) bodyBg = new Color('rgb(255,255,255)');
                }
                document.documentElement.style.backgroundColor = bodyBg.toString();
                document.body.style.backgroundColor = bodyBg.toString();
                //Set scrollbar color
                let scrCol = new Color('120 120 120');
                scrCol.contrastTo(bodyBg, desiredContrast);
                let htmlStyle = document.getElementsByTagName("HTML")[0].style;
                htmlStyle.scrollbarColor = scrCol + ' rgba(0,0,0,0)';
                htmlStyle.scrollbarWidth = await config.getScrollWidth();
                //console.log('finalized');
            };

            await walker.forTextElementsUnder(document.body, walkMethod)
                .catch((error) => {
                    console.error('walker.forTextElementsUnder(document.body) error ' + error)
                })
                .then(finalize);
            console.log('all done');
            //console.log(globalData);

        }
        restart();

        function restartOnDOMMutation(restart) {
            //https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
            // Select the node that will be observed for mutations
            const targetNode = document.body;

            // Options for the observer (which mutations to observe)
            const config = {
                attributes: true,
                childList: true,
                subtree: true
            };

            let elemTimers = new Map();

            // Callback function to execute when mutations are observed
            const callback = function(mutationsList, observer) {
                //console.log('mutant');
                for (let mutation of mutationsList) {
                    //Attribute can also change text colors
                    if (mutation.type == 'attributes') {
                      globalData.delete(mutation.target);
                      mutation.target.removeProperty('color');
                      //walk up the DOM tree, delete saved colors up to mutation target
                    }
                    //console.log(mutation.addedNodes);

                    //todo after restart only processes new nodes implement here
                    let elem = document.body; //mutation.addedNodes[0];
                    if (!elemTimers.has(elem)) {
                        elemTimers.set(elem, window.setTimeout(() => {
                            elemTimers.delete(elem);
                            startAsEvent(restart);
                        }, 500));
                    };
                    //break;
                }
            };

            // Create an observer instance linked to the callback function
            const observer = new window.MutationObserver(callback);

            // Start observing the target node for configured mutations
            observer.observe(targetNode, config);

        }
        restartOnDOMMutation(restart);

    })();
} catch (e) {
    console.error(e);
}
