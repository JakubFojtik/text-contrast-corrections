// Gathers foreground and background color of a DOM element

class ElementColorFinder {
    constructor(elemBgcols) {
        //Background colors of elements. Needs converted colors of background images, otherwise they will be ignored in computations
        this.elemBgcol = elemBgcols;
        this.nullElement = document.createElement("div");
    }

    getBgColor(el, bgProp) {
        return this.elemBgcol.has(el) ? this.elemBgcol.get(el) : new Color(window.getComputedStyle(el).getPropertyValue(bgProp));
    }

    findAndMergeBgCol(element, bgProp) {
        let colors = []; //tuples of element and its bgcolor, so computed bgcolor can later be remembered
        let el = element;

        while (el instanceof Element) {
            let col = this.getBgColor(el, bgProp); //Is getComputedStyle inspecting also parent elements for non-computable bgcolor? If yes, optimize?
            if (!(col instanceof Color)) alert('not a Color:' + el.tagName + col);
            //save non-opaque colors for later blending
            colors.push({
                col: col,
                el: el
            });
            if (col.isOpaque()) { //need to reach an opaque color to blend the transparents into
                break;
            }
            el = el.parentNode;
        }

        //ensure default bgcolor is in the array for textnodes in body without bgcol set
        let bgcolor = new Color('rgb(255, 255, 255)'); //default bg color if all elements report non-opaque
        if (!(el.parentNode instanceof Element)) {
            colors.push({
                col: bgcolor,
                el: this.nullElement
            });
        }
        let col = colors[0].col;

        //Compute all alpha colors with the final opaque color
        //So Blue->10%Red->15%Green should be 85%(90%Blue+10%Red)+15%Green
        //Todo gradients
        colors.reverse().forEach((colEl) => {
            col = colEl.col.asOpaque(col);
            this.elemBgcol.set(colEl.el, col);

            //force assign computed bgcolor to element for debug
            //colEl.el.style.backgroundColor=col.toString();
        });

        return col;
    }

    computeColors(element, fgProp, bgProp) {
        let bgColor = this.findAndMergeBgCol(element, bgProp);

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
}