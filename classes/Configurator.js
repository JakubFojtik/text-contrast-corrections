// Configuration for user-changeable parameters

ConfigurableSettings = {
    DESIRED_CONTRAST: 0,
    SCROLL_WIDTH: 1,
    RESET_OPACITY: 2,
}

class Configurator {
    constructor() {
        this.settingsMap = new Map();

        this.setup(
            ConfigurableSettings.DESIRED_CONTRAST,
            'Desired contrast (0.0 to 1.0)',
            0.8,
            x => 0 <= x && x <= 1
        );
        this.setup(
            ConfigurableSettings.SCROLL_WIDTH,
            'Scrollbar width (normal or thin)',
            'thin',
            x => x == 'normal' || x == 'thin'
        );
        this.setup(
            ConfigurableSettings.RESET_OPACITY,
            'Make all elements opaque? (yes or no)',
            'yes',
            x => x == 'yes' || x == 'no'
        );

    }

    setup(setting, description, defaultVal, isValid) {
        this.settingsMap.set(setting, { description: description, defaultVal: defaultVal, isValid: isValid });
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
        this.settingsMap.forEach(async (data, setting) => {
            let label = addNewElem('dt', data.description, list);
            label.style.float = 'left';
            label.style.width = '50%';
            let item = addNewElem('dd', '', list);
            let input = addNewElem('input', '', item);
            input.name = this.getSettingName(setting);
            //replace GM.getValue with the value-correcting methods
            input.value = await this.getSetting(setting);
            inputs.set(input, input.value);
        });
        let button = addNewElem('input');
        button.type = 'submit';
        button.value = 'Save';
        button.addEventListener('click', async () => {
            inputs.forEach(async (originalValue, input) => {
                let setting = ConfigurableSettings[input.name];
                if (this.settingsMap.get(setting).isValid(input.value))
                    await GM.setValue(input.name, input.value);
                else
                    input.value = await this.getSetting(setting);
            });
        });
    }

    async getSetting(setting) {
        let settingData = this.settingsMap.get(setting);
        let settingName = this.getSettingName(setting);

        let value = await GM.getValue(settingName);
        if (!settingData.isValid(value)) {
            //replace invalid configured value with default
            value = settingData.defaultVal;
            await GM.setValue(settingName, value);
        }
        return value;
    }

    getSettingName(setting) {
        for (let property in ConfigurableSettings)
            if (ConfigurableSettings[property] == setting)
                return property;
    }
}
