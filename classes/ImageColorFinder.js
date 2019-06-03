// Computes the dominant image color

//How many pixels of 10 to consider when determining image color pallete. From 1 to 10.
const COLOR_THIEVING_QUALITY = 10;
const MAX_COLOR_THIEVING_QUALITY = 10;

class ImageColorFinder {
    constructor(textElementsUnder, callback) {
        //Background colors of elements. Needs converted colors of background images, otherwise they will be ignored in computations
        this.elemBgcols = new Map();
        this.urlDownloads = new Map();
        this.imgCounter = 0;
        this.textElementsUnder = textElementsUnder;
        this.callback = callback;
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
                if (url && !this.urlDownloads.has(url)) this.getBgImageColor(el, url);
                el = el.parentNode;
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

    getBgImageColor(element, url) {
        this.imgCounter++;

        //copypaste of ColorThief.prototype.getColorFromUrl. Load events are sometimes not fired for image that already loaded e.g. <body> background image.
        let sourceImage = document.createElement("img");
        let prom = new Promise((res, rej) => {
            sourceImage.addEventListener('load', () => {
                let bgColor = window.getComputedStyle(element).getPropertyValue('background-color');
                let bgColorParts = new Color(bgColor).getRGBParts();
                let color = this.extractColor(sourceImage, COLOR_THIEVING_QUALITY, false, bgColorParts);
                bgColor = color.join(',');

                this.elemBgcols.set(element, new Color(bgColor));
                this.imgCounter--;
                res();
                //console.log(bgColor+url);
            });
            sourceImage.addEventListener('error', () => {
                console.error('error');
                this.imgCounter--;
                rej();
            });
            sourceImage.addEventListener('abort', () => {
                console.error('abort');
                this.imgCounter--;
                rej();
            });
        });
        this.elemBgcols.set(element, null);
        this.urlDownloads.set(url, prom);
        sourceImage.src = url;
    }

    getBgImageUrl(element) {
        let url = window.getComputedStyle(element).getPropertyValue('background-image');
        if (url && url != 'none') {
            if (url.startsWith('url("')) {
                //skip nonrepeated bg in case of e.g. list item bullet images
                //todo after downloading check image dimensions against element size
                let repeat = window.getComputedStyle(element).getPropertyValue('background-repeat');
                let size = window.getComputedStyle(element).getPropertyValue('background-size');
                return (repeat != 'no-repeat' || size == 'cover') ? url.split('"')[1] : null;
            } else if (url.match('^[a-z\-]+gradient\\(')) {
                return this.getGradientColor(element, url);
            }
        }
    }

    getGradientColor(element, url) {
        //do NOT skip nonrepeated bg for gradients, at least stackoverflow has it nonrepeated
        let colReg = RegExp('rgba?\\(([0-9]{1,3},? ?){3,4}\\)', 'g');
        let colors = url.match(colReg);
        //console.log(colors.length +' '+colors);
        if (colors.length > 0) {
            let colorParts = [0, 0, 0];
            //Compute average color by just averaging all used opaque colors, todo better computation than that
            let opaqueColors = colors.map(x => new Color(x)).filter(x => x.isOpaque());
            if (opaqueColors.length == 0) return null;
            opaqueColors.map(x => x.getRGBParts())
                .forEach(parts => {
                    parts.forEach((val, idx) => {
                        colorParts[idx] += val;
                    });
                });
            colorParts.forEach((val, idx) => {
                colorParts[idx] = Math.round(val / colors.length);
            });
            this.elemBgcols.set(element, new Color(colorParts.join(', ')));
            //console.log(colorParts+url);
        }
        return null;
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
  
    extractColor(sourceImage, quality, ignoreBgcolor, bgColor) {

      if (typeof quality === 'undefined' || quality < 1 || quality > MAX_COLOR_THIEVING_QUALITY) {
        quality = 5;
      }
      if (typeof ignoreBgcolor === 'undefined') {
        ignoreBgcolor = true;
      }
      if (typeof bgColor === 'undefined' || bgColor.length < 3) {
        bgColor = [255, 255, 255];
      }

      // Create custom CanvasImage object
      var image      = new CanvasImage(sourceImage);
      var imageData  = image.getImageData();
      var pixels     = imageData.data;
      var pixelCount = image.getPixelCount();

      // Store the RGB values in an array
      var pixelArray = [];
      for (var i = 0, offset, r, g, b, a; i < pixelCount; i += MAX_COLOR_THIEVING_QUALITY - quality + 1) {
        offset = i * 4;
        r = pixels[offset + 0];
        g = pixels[offset + 1];
        b = pixels[offset + 2];
        a = pixels[offset + 3] / 255;
        let color = [r, g, b];
        if(a < 0.99) {
          // Blend bgColor with transparent pixels
          color = color.map((x, idx) => {
            return a*x + (1-a)*bgColor[idx];
          });
        }

        // If pixel is not of bgColor or we don't care
        if (!ignoreBgcolor || color.filter((x, idx) => Math.abs(x - bgColor[idx]) < 5).length < 3) {
          pixelArray.push(color);
        }
      }

      // Send array to quantize function which clusters values
      // using median cut algorithm
      //var cmap    = MMCQ.quantize(pixelArray, colorCount);
      //var palette = cmap? cmap.palette() : null;

      // Average all collected pixel colors
      let color = pixelArray
        .reduce((acc, col)=>acc.map((part, i)=>part+col[i]))
        .map(x=>Math.round(x/pixelArray.length));

      // Clean up
      image.removeCanvas();

      return color;
    };
}
