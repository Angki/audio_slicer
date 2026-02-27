const Store = require('electron-store');
const store = new Store();

function getStoreValue(key, defaultValue = null) {
    return store.get(key, defaultValue);
}

function setStoreValue(key, value) {
    store.set(key, value);
}

module.exports = {
    getStoreValue,
    setStoreValue
};
