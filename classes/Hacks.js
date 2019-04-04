// Gathers foreground and background color of a DOM element

class Hacks {

    doAllHacks() {
        this.github();
        this.wikia();
    }

    github() {
        //Github - lazy loaded content
        //from https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
        var targetNode = document.getElementById('js-pjax-loader-bar');
        if (targetNode) {
            let callback = function (mutationsList) {
                for (let mutation of mutationsList) {
                    if (mutation.attributeName == 'class' && targetNode.className == 'pjax-loader-bar') {
                        restart();
                    }
                }
            };
            let observer = new MutationObserver(callback);
            observer.observe(targetNode, {
                attributes: true
            });
        }
    }

    wikia() {
        //Wikia - background via sibling div with absolute position and opacity
        let bgEl = document.getElementById('WikiaPageBackground');
        if (bgEl) {
            let newBg = window.getComputedStyle(bgEl).getPropertyValue('background-color');
            //do not reapply deleted background
            if (newBg != 'rgba(0, 0, 0, 0)') {  //todo compare using Color class
                let opacity = window.getComputedStyle(bgEl).getPropertyValue('opacity');
                bgEl.style.background = 'none';
                bgEl.parentNode.style.background = newBg;
                bgEl.parentNode.style.opacity = opacity;
            }
        }
    }
}