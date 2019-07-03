// Computes the dominant image color

//How many pixels of 10 to consider when determining image color pallete. From 1 to 10.
const COLOR_THIEVING_QUALITY = 5;
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

    tryGetBgColor(element) {
        let bgColor = window.getComputedStyle(element).getPropertyValue('background-color');
        return new Color(bgColor);
    }

    async tryGetBgImgColor(element) {
        let url = this.tryGetBgImgUrl(element);
        if (url == null) return null;

        if (url) {
            if (!this.urlDownloads.has(url))
                this.getBgImageColor(element, url);
            return await this.urlDownloads.get(url);
        } else console.error('did not get image col for ' + url);
    }

    //todo searchUrl(forWhat), use in gradient too
    tryGetBgImgUrl(element) {
        let bgSpec = window.getComputedStyle(element).getPropertyValue('background-image');
        let regex = /url\("[^"]*"\)/g;  //todo handle all matches, e.g. transparent images over eachother
        let url = bgSpec.match(regex);
        if (url && url.length > 0 && url[0].startsWith('url("')) {
            return url[0].split('"')[1];
        } else {
            return null;
        }
    }

    tryGetGradientColor(element) {
        let bgSpec = window.getComputedStyle(element).getPropertyValue('background-image');

        if (bgSpec) {
            let matches = bgSpec.match(/^[a-z\-]+gradient\(.*/g); //needs cf parsing for nested parens, includes following gradients
            if (matches && matches.length > 0) {
                console.log('mam' + matches[0]);
                return this.tryGetGradientColorImpl(element, matches[0]);
            }
        }

        return null;
    }

    tryGetGradientColorImpl(element, url) {
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
            return new Color(colorParts.join(', '));
        }
        return null;
    }

    getBgImageColor(element, url) {
        this.imgCounter++;
        let sourceImage = document.createElement("img");
        let prom = new Promise((res, rej) => {
            sourceImage.addEventListener('load', () => {
                var image = new CanvasImage(sourceImage);
                try {
                    if (!this.doesImageCoverElem(element, image, url)) {
                        res(null);
                        return null;
                    }
                    let color = this.extractColor(image, COLOR_THIEVING_QUALITY);

                    this.elemBgcols.set(element, color);
                    this.imgCounter--;
                    res(color);
                } finally {
                    image.removeCanvas();
                }
                //console.log(color + url);
            });
            sourceImage.addEventListener('error', () => {
                console.error('error ' + url);
                this.imgCounter--;
                res(null);
            });
            sourceImage.addEventListener('abort', () => {
                console.error('abort ' + url);
                this.imgCounter--;
                res(null);
            });
        });
        this.elemBgcols.set(element, null);
        this.urlDownloads.set(url, prom);
        sourceImage.src = url;
    }

    doesImageCoverElem(element, image, url) {
        //todo multiple background images and their sizes https://developer.mozilla.org/en-US/docs/Web/CSS/background-size#Syntax
        //todo sprite image - different part used at different places, cannot compute color from whole
        console.log(image.width + " " + image.height + " " + url);

        //is repeat enough? ifnot is size enough?
        let bgSize = window.getComputedStyle(element).getPropertyValue('background-size');
        console.log('toz' + window.Length.toPx(element, '1em'));
        let bgRepeat = window.getComputedStyle(element).getPropertyValue('background-repeat');
        let bgRepeatX = bgRepeat,
            bgRepeatY = bgRepeat;
        let bgRepeatParts = bgRepeat.split(' ');
        if (bgRepeatParts.length > 1) {
            bgRepeatX = bgRepeatParts[0];
            bgRepeatY = bgRepeatParts[1];
        } else {
            if (bgRepeat == 'repeat-x') bgRepeatY = 'no-repeat';
            if (bgRepeat == 'repeat-y') bgRepeatX = 'no-repeat';
        }
        bgRepeatX = bgRepeatX != 'no-repeat';
        bgRepeatY = bgRepeatY != 'no-repeat';
        let elemWidth = element.clientWidth;
        let elemHeight = element.clientHeight;
        console.log(url + element.tagName + element.getBoundingClientRect().width);
        console.log(bgRepeatX, image.width, elemWidth);
        console.log(bgRepeatY, image.height, elemHeight);
        if (bgSize == 'cover') return true;

        //image size * bg size = covered size
        //todo include bg size
        if (!bgRepeatX && (image.width < elemWidth / 2)) return false;
        if (!bgRepeatY && (image.height < elemHeight / 2)) return false;

        return true;
    }

    extractColor(image, quality) {

        if (typeof quality === 'undefined' || quality < 1 || quality > MAX_COLOR_THIEVING_QUALITY) {
            quality = 5;
        }

        // Create custom CanvasImage object
        var imageData = image.getImageData();
        var pixels = imageData.data;
        var pixelCount = image.getPixelCount();

        // Store the RGB values in an array
        var pixelArray = [];
        for (var i = 0, offset, r, g, b, a; i < pixelCount; i += MAX_COLOR_THIEVING_QUALITY - quality + 1) {
            offset = i * 4;
            r = pixels[offset + 0];
            g = pixels[offset + 1];
            b = pixels[offset + 2];
            a = pixels[offset + 3]; //keep alpha 0-255 so all parts can be rounded to int
            let color = [r, g, b, a];

            pixelArray.push(color);
        }

        // Send array to quantize function which clusters values
        // using median cut algorithm
        //var cmap    = MMCQ.quantize(pixelArray, colorCount);
        //var palette = cmap? cmap.palette() : null;
        //console.log(pixelArray);

        // Average all collected pixel colors
        let color = pixelArray
            .reduce((acc, col) => acc.map((part, i) => part + col[i]));
        //console.log('inimg ' + color);
        color = color.map(x => Math.round(x / pixelArray.length));
        color[3] /= 255;
        //console.log('postimg ' + color);

        return new Color(color.join(','));
    };
}


/*
  CanvasImage Class from Color Thief
  Class that wraps the html image element and canvas.
  It also simplifies some of the canvas context manipulation
  with a set of helper functions.
*/
var CanvasImage = function (image) {
    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');

    document.body.appendChild(this.canvas);

    this.width = this.canvas.width = image.width;
    this.height = this.canvas.height = image.height;

    this.context.drawImage(image, 0, 0, this.width, this.height);
};

CanvasImage.prototype.clear = function () {
    this.context.clearRect(0, 0, this.width, this.height);
};

CanvasImage.prototype.update = function (imageData) {
    this.context.putImageData(imageData, 0, 0);
};

CanvasImage.prototype.getPixelCount = function () {
    return this.width * this.height;
};

CanvasImage.prototype.getImageData = function () {
    return this.context.getImageData(0, 0, this.width, this.height);
};

CanvasImage.prototype.removeCanvas = function () {
    this.canvas.parentNode.removeChild(this.canvas);
};