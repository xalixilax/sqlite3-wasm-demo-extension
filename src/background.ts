"use strict";

chrome.action.onClicked.addListener(function(): void {
    chrome.tabs.create({url: chrome.runtime.getURL("index.html")});
});

export {};
