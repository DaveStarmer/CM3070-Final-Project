
fetch("config.json").then(res => res.json()).then(js => {
  window.apiUrl = (js["api-endpoint"].slice(-1) == "/")
    ? `${js["api-endpoint"]}activations`
    : `${js["api-endpoint"]}/activations`
  updateActivations()
})
