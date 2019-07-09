// Traverse parent elements of a text node

const TIMEOUT_MS = 1000;

class TextNodeWalker {
    constructor() { }

    forTextElementsUnder(elemContainer, callback) {
        let promises = [];
        this.getTextNodesUnder(elemContainer)
            .forEach(el => {
                //console.log('hovno' + el.innerHTML);
                //if (el.id != 'ee') return;  //todo remove
                promises.push(new Promise(res => {
                    this.startAsEvent(() => {
                        res(callback(el));
                    });
                }));
            });

        return this.wrapInTimeout(Promise.all(promises), TIMEOUT_MS);
    }

    wrapInTimeout(promise, ms) {
        let timeout;
        let prom = new Promise((resolve, reject) =>
            timeout = setTimeout(() => {
                console.error('timed out');
                reject();
            }, ms));
        let finish = x => {
            console.log('walker done');
            clearTimeout(timeout);
        };
        promise = promise.then(finish, finish);
        return Promise.race([prom, promise]);
    }

    async walkElemParentsUntil(textElem, stopCallback) {
        let el = textElem;

        while (el instanceof Element) {
            //console.log('hovno' + el.tagName);
            let sc = await stopCallback(el);
            //console.log('sc' + sc);
            if (sc) break;
            el = el.parentNode;
        }
        return true;
    }

    getTextNodesUnder(elemContainer) {
        let node, elems = [],
            walk = document.createTreeWalker(elemContainer, NodeFilter.SHOW_TEXT, null, false);
        while (node = walk.nextNode()) {
            if (node.data.trim() == '') continue;
            let parent = node.parentNode;
            if (parent instanceof Element) elems.push(parent);
        }
        return elems;
    }
    startAsEvent(action) {
        window.setTimeout(action, 0);
    }
}
