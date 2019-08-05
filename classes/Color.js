// RGBA color parts holder and manipulator

//RGBA opacity extremes
const TRANSPARENT = 0;
const OPAQUE = 1;

//margin of error for float operations
const ERROR_MARGIN = 0.01;

class Color {
    constructor(colorSpec) {
        let regex = /[0-9.]+/g; //allow for missing leading zero, at least FF displays colors like that
        let parts = colorSpec.match(regex);

        if (parts.length >= 3) {
            let parsedParts = [];
            parts.forEach((part, idx) => {
                parsedParts[idx] = parseFloat(part);
            });
            if (parsedParts.length < 4) parsedParts[3] = OPAQUE;
            this.parts = parsedParts;
        } else {
            console.error('bad colorspec ' + colorSpec);
        }
    }
    opacity() {
        return Math.min(this.parts[3], OPAQUE);
    }
    isTransparent() {
        return this.isAlphaNear(TRANSPARENT);
    }
    isOpaque() {
        return this.isAlphaNear(OPAQUE);
    }
    isAlphaNear(num) {
        let diff = Math.abs(num - this.opacity());
        return diff < ERROR_MARGIN;
    }
    toString() {
        return 'rgba(' + this.parts.join(', ') + ')';
    }
    // Algorithm from https://www.w3.org/TR/AERT/#color-contrast
    //((Red value X 299) + (Green value X 587) + (Blue value X 114)) / 1000
    colorPartsBrightness() {
        return [299, 587, 114];
    }
    colorPartsBrightnessMax() {
        return 1000;
    }
    brightness() {
        if (!this.isOpaque()) {
            console.error('getting brightness of alpha color ' + this.parts);
            return -1;
        }
        let coefs = this.colorPartsBrightness();
        let sum = this.getRGBParts().map((x, i) => x * coefs[i]).reduce((a, b) => a + b, 0);
        return sum / this.colorPartsBrightnessMax();
    }
    changeContrast(contrastChange, brighten) {

        let fun = brighten ? Math.min : Math.max;
        let limit = brighten ? 255 : 0;
        let op = brighten ? (a, b) => a + b : (a, b) => a - b;

        //To preserve color each part must be incremented equally
        //Adding 1 to each part increases brightness by 1
        this.getRGBParts().forEach((part, idx) => {
            let newPart = op(part, contrastChange);
            this.parts[idx] = fun(limit, newPart);
        });
    }
    contrastTo(otherCol, desiredContrast) {
        //Trivialy redistributes brightness increments if one color part reaches min/max
        //todo do it properly in constant time
        for (let i = 0; i < 10; i++) {
            let contrast = Math.abs(this.brightness() - otherCol.brightness());
            if (contrast >= 255 * desiredContrast) return;

            //choose opposite brightness to the other color
            let contrastChange = 255 * desiredContrast - contrast;
            let brighten = otherCol.brightness() < 128;
            this.changeContrast(contrastChange, brighten);
        }
    }
    //Computes final color of alpha color on solid background
    asOpaque(bgColor) {
        if (this.isOpaque()) return this;
        if (!bgColor.isOpaque()) console.error('bgcolor is not opaque: ' + bgColor.toString());

        let color = new Color(this.toString());
        color.parts[3] = OPAQUE;

        let opacity = this.opacity();
        color.getRGBParts().forEach((part, idx) => {
            let col = part * opacity;
            let bgCol = bgColor.getRGBParts()[idx] * (OPAQUE - opacity);
            color.parts[idx] = col + bgCol;
        });

        return color;
    }
    getRGBParts() {
        return this.parts.slice(0, 3);
    }
    //todo combine THIS with colors, or make static
    //rely on this being opaque
    combine(...colors) {
        console.log('combine' + colors);
        colors = colors.filter(x => x != null);
        if (colors.length == 0) return null;
        let combo = colors.reduce((acc, col) => col.asOpaque(acc));
        console.log(combo);
        return combo;
    }
}
