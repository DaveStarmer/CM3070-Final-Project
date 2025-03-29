
// javascript for index.html
// requires notification-cards.js

// create popup section of page
createVideoPopup()


fetch("config.json").then(res => res.json()).then(js => {
  window.apiUrl = (js["api-endpoint"].slice(-1) == "/")
    ? `${js["api-endpoint"]}activations`
    : `${js["api-endpoint"]}/activations`
  updateActivations()
})