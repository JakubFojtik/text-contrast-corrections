// Configuration for user-changeable parameters

//How contrasting must each text be to its background, from 0 to 1, where 0 is no change and 1 turns everything black & white
const DEFAULT_DESIRED_CONTRAST = 0.8;
const DESIRED_CONTRAST_KEY = 'desiredContrast';

class Configurator {
  constructor() {
    this.descriptions = new Map();
    this.descriptions.set(DESIRED_CONTRAST_KEY, 'Desired contrast (0.0 to 1.0)');
  }
  async getContrast() {
    let contrast = Number(await GM.getValue(DESIRED_CONTRAST_KEY));
    //do not simlpyfy range check, would not filter out uncomparable values
    if (contrast == NaN || !(0 <= contrast && contrast <= 1)) {
      //replace invalid configured value with default
      contrast = DEFAULT_DESIRED_CONTRAST;
      await GM.setValue(DESIRED_CONTRAST_KEY, contrast);
    }
    return contrast;
  }
  async displayForm() {
    let box = document.body;
    // This is one way to remove all children from a node
    // box is an object reference to an element
    //from https://developer.mozilla.org/en-US/docs/Web/API/Node/childNodes
    while (box.firstChild) {
      //The list is LIVE so it will re-index each call
      box.removeChild(box.firstChild);
    }

    let div = document.createElement('div');
    document.body.appendChild(div);
    let addNewElem = (tagName, content = '', parent = div) => {
      let elem = document.createElement(tagName);
      elem.appendChild(document.createTextNode(content));
      parent.appendChild(elem);
      return elem;
    };

    let inputs = new Map();
    addNewElem('h2', 'Text contrast corrections');
    addNewElem('u', 'Userscript configuration');
    let list = addNewElem('dl');
    (await GM.listValues()).forEach(async(name) => {
      let labelText = this.descriptions.has(name) ? this.descriptions.get(name) : name;
      let label = addNewElem('dt', labelText, list);
      label.style.float = 'left';
      label.style.width = '50%';
      let item = addNewElem('dd', '', list);
      let input = addNewElem('input', '', item);
      input.name = name;
      input.value = await GM.getValue(name);
      inputs.set(input, input.value);
    });
    let button = addNewElem('input');
    button.type = 'submit';
    button.value = 'Save';
    button.addEventListener('click', async() => {
      inputs.forEach(async(oldValue, input) => {
        await GM.setValue(input.name, input.value);
      });
    });
  }
}