// Configuration placeholder class that does not use GM methods

//How contrasting must each text be to its background, from 0 to 1, where 0 is no change and 1 turns everything black & white
const DEFAULT_DESIRED_CONTRAST = 0.8;
const DESIRED_CONTRAST_KEY = 'desiredContrast';

//Should scrollbar be thinner?
const DEFAULT_SCROLL_WIDTH = 'thin';
const SCROLL_WIDTH_KEY = 'scrollWidth';

class Configurator {
    constructor() {}

    async displayForm() {}

    async getContrast() {
        return DEFAULT_DESIRED_CONTRAST;
    }

    async getScrollWidth() {
        return DEFAULT_SCROLL_WIDTH;
    }
}
