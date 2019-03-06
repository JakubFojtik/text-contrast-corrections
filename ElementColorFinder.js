// Gathers foreground and background color of a DOM element

class ElementColorFinder {
  constructor(elemBgcols) {
    //Background colors of elements. Needs converted colors of background images, otherwise they will be ignored in computations
    this.elemBgcol = elemBgcols;
    console.log(elemBgcols.size);
  }

  getBgColor(el, bgProp) {
    return this.elemBgcol.has(el) ? this.elemBgcol.get(el) : new Color(window.getComputedStyle(el).getPropertyValue(bgProp));
  }

  findAndMergeBgCol(element, bgProp) {
    let colors = []; //tuples of element and its bgcolor, so computed bgcolor can later be remembered

    let bgcolor = new Color('rgb(255, 255, 255)'); //default bg color if all elements report transparent
    let el = element;
    let col;

    while (el instanceof Element) {
      col = this.getBgColor(el, bgProp); //Is getComputedStyle inspecting also parent elements for non-computable bgcolor? If yes, optimize?
      if (!(col instanceof Color)) alert('not a Color:' + el.tagName + col);
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
    if (!(el instanceof Element)) colors.push({
      col: bgcolor,
      el: el
    }); //ensure final color is in the array
    col = bgcolor;

    //console.log(col + ' pak ' + colors.map(x=>x.col).join(', '));

    //Compute all alpha colors with the final opaque color
    //So Blue->10%Red->15%Green should be 85%(90%Blue+10%Red)+15%Green
    //Todo gradients
    //element.style.backgroundColor=col.toString();
    //this.elemBgcol.set(element, col);
    colors.reverse().slice(1).forEach((colEl) => {
      col = colEl.col.asOpaque(col);
      this.elemBgcol.set(colEl.el, col);

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