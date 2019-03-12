// Computes the dominant image color

class ImageColorFinder {
  constructor(colorThief, textElementsUnder, callback) {
    //Background colors of elements. Needs converted colors of background images, otherwise they will be ignored in computations
    this.elemBgcols = new Map();
    this.colorThief = colorThief;
    this.imgCounter = 0;
    this.textElementsUnder = textElementsUnder;
    this.callback = callback;
  }

  getBgImageUrl(element) {
    let url = window.getComputedStyle(element).getPropertyValue('background-image');
    if (url && url != 'none') {
      //skip nonrepeated bg in case of e.g. list item bullet images
      let repeat = window.getComputedStyle(element).getPropertyValue('background-repeat');
      return repeat != 'no-repeat' ? url.split('"')[1] : null;
    }
  }

  findElemBgcols() {
    this.imgCounter = 0;
    this.textElementsUnder(document, (element) => {
      let el = element;
      let url = '';

      //search for first ancestor that has a bgimage. Possibly stop on first with opaque bgcol, but still take its bgimage if any.
      while (el instanceof Element) {
        if (this.elemBgcols.has(el)) return;
        url = this.getBgImageUrl(el);
        if (url) break;
        else el = el.parentNode;
      }
      if (!(el instanceof Element)) return;
      element = el;

      url = this.getBgImageUrl(element);
      if (url) {
        this.imgCounter++;

        //copypaste of ColorThief.prototype.getColorFromUrl. Load events are sometimes not fired for image that already loaded e.g. <body> background image.
        //ColorThief seemingly ignores transparent pixels, but not white pixels anymore
        let sourceImage = document.createElement("img");
        sourceImage.addEventListener('load', () => {
          let bgColor = window.getComputedStyle(element).getPropertyValue('background-color');
          let palette = this.colorThief.getPalette(sourceImage, 10);
          //palette can be null for transparent images
          if (palette != null) {
            let dominantColor = palette[0];

            let avgColor = palette.reduce((a, b) => {
              return a.map((x, idx) => {
                return (x + b[idx]) / 2;
              });
            });
            //Add some weight to the dominant color. Maybe pallete returns colors in descending dominance?
            dominantColor = dominantColor.map((x, idx) => {
              return 0.8 * x + 0.2 * avgColor[idx];
            });
            bgColor = dominantColor.join(',');
          }

          this.elemBgcols.set(element, new Color(bgColor));
          //element.style.setProperty("background-color", new Color(dominantColor.join(',')).toString(), "important");
          this.imgCounter--;
        });
        sourceImage.addEventListener('error', () => {
          console.error('error');
          this.imgCounter--;
        });
        sourceImage.addEventListener('abort', () => {
          console.error('abort');
          this.imgCounter--;
        });
        this.elemBgcols.set(element, null);
        sourceImage.src = url
      }
    });

    //Wait for images to load
    let int = window.setInterval(() => {
      //console.log('imgCounterin '+this.imgCounter);
      if (this.imgCounter != 0) return;
      else window.clearInterval(int);
      this.finish();
    }, 200);

    //Stop witing after fixed time
    window.setTimeout(() => {
      if (this.imgCounter != 0) {
        console.error('some images didnt load');
        window.clearInterval(int);
        this.finish();
      }
    }, 5000);
  }

  finish() {
    this.elemBgcols.forEach((val, key, map) => {
      if (!val) {
        map.delete(key);
        let url = window.getComputedStyle(key).getPropertyValue('background-image');
        console.log('is null ' + url);
      }
    });
    this.callback(this.elemBgcols);
  }
}