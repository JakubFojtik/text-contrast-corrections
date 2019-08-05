// Gathers foreground and background color of a DOM element

class Hacks {
    constructor(restart) {
        this.restart = restart;
    }

    doAllHacks() {
        this.wikia();
    }

    wikia() {
        //Wikia - background via sibling div with absolute position and opacity
        let bgEl = document.getElementById('WikiaPageBackground');
        if (bgEl) {
            let newBg = window.getComputedStyle(bgEl).getPropertyValue('background-color');
            //do not reapply deleted background
            if (newBg != 'rgba(0, 0, 0, 0)') { //todo compare using Color class
                let opacity = window.getComputedStyle(bgEl).getPropertyValue('opacity');
                bgEl.style.background = 'none';
                bgEl.parentNode.style.background = newBg;
                bgEl.parentNode.style.opacity = opacity;
            }
        }
    }
}
