/**
 * add menu, to page
 */
function decoratePage() {
  // Menu icon from https://fonts.google.com/icons?selected=Material+Icons:menu
  // Open menu icon https://fonts.google.com/icons?selected=Material+Icons:menu_open

  /** nav element on page (starts empty) */
  const navTag = document.querySelector("nav")
  navTag.innerHTML = ""
  /** create label element for menu open checkbox */
  const menuOpenLabel = document.createElement("label")
  menuOpenLabel.setAttribute("for", "menu-open")
  navTag.appendChild(menuOpenLabel)
  /** menu icon */
  const menuImg = document.createElement("img")
  menuOpenLabel.appendChild(menuImg)
  menuImg.id = "menu-icon"
  menuImg.src = "images/menu_24dp_000000.svg"
  navTag.appendChild(menuOpenLabel)
  /** hidden checkbox */
  const menuCheckbox = document.createElement("input")
  menuCheckbox.setAttribute("type", "checkbox")
  menuCheckbox.setAttribute("name", "menu-open")
  menuCheckbox.id = "menu-open"
  menuOpenLabel.appendChild(menuCheckbox)
  /** list element to append menu items to */
  const menuList = document.createElement("ul")
  menuList.id = "nav-menu"
  // append menu to the nav section
  menuOpenLabel.appendChild(menuList)

  /** URL of current page */
  const fullUrl = window.location.href
  // set home address to root of folder instead of 'index.html'
  menuInfo[0][1] = fullUrl.slice(0, fullUrl.lastIndexOf("/") + 1)

  // work out current page name
  let currPageFilename = (fullUrl.slice(-1) != "l")
    ? "index.html"
    : fullUrl.slice(fullUrl.lastIndexOf("/") + 1)

  // set this way so even if 'index.html' is explicitly set, the link will always go to the 
  // root of the folder
  if (currPageFilename = "index.html") currPageFilename = menuInfo[0][1]

  /** length of menu list array */
  const numMenuItems = menuInfo.length

  /** current page index in menuInfo */
  let currPageIndex = -1

  // iterate through menu items, adding them as necessary, find current page on way
  for (let i = 0; i < numMenuItems; ++i) {
    createMenuItem(menuList, currPageFilename, ...menuInfo[i])
    if (menuInfo[i][1] == currPageFilename) currPageIndex = i
  }

  // create outer label
  const sysActiveLabel = document.createElement("label")
  sysActiveLabel.innerText = "System Active"
  sysActiveLabel.setAttribute("for", "sys-active")
  navTag.appendChild(sysActiveLabel)

  // containing div
  const sysActiveDiv = document.createElement("div")
  sysActiveDiv.classList.add("toggle")
  sysActiveLabel.appendChild(sysActiveDiv)

  // hidden checkbox
  const sysActiveCheckbox = document.createElement("input")
  sysActiveCheckbox.setAttribute("type", "checkbox")
  sysActiveCheckbox.id = "sys-active"
  sysActiveCheckbox.setAttribute("name", "sys-active")
  sysActiveCheckbox.addEventListener("change", systemActivation)
  sysActiveDiv.appendChild(sysActiveCheckbox)

  // create span
  const toggleKnob = document.createElement("span")
  toggleKnob.classList.add("toggleknob")
  sysActiveDiv.appendChild(toggleKnob)
}

/**
 * Create individual Menu Item
 * @param {string | HTMLElement} parent parent item to append new item to
 * @param {string} currentPage current page name
 * @param {string} description text to display
 * @param {string} url url to link to
 */
function createMenuItem(parent, currentPage, description, url) {
  const link = document.createElement("a")
  link.href = url
  link.innerText = description
  if (url == currentPage) link.classList.add("current-page")
  const item = document.createElement("li")
  item.appendChild(link)
  parent.appendChild(item)
}

/**
 * Enable or disable system with UI toggle
 */
function systemActivation() {
  if (document.getElementById("sys-active").checked) {
    // system should now be enabled
    fetch(`${apiUrl}?systemActivation=ENABLED`)
  }
  else {
    // system should now be disabled
    fetch(`${apiUrl}?systemActivation=DISABLED`)
  }
}

function getSystemActivation() {
  fetch(`${apiUrl}?systemActivation`, {
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  }).then(response => response.json()).then(js => {
    console.log(js)
    document.getElementById("sys-active").checked = (js["systemActivation"] == "ENABLED")
  })
}

/** array of menu items. Items are of the form ["Description", "url"] */
const menuInfo = [
  ["Home", "index.html"],
  ["Deactivate", ""],
  ["Notifications", "notifications.html"],
  ["Logout", "/logout"],
]

fetch("config.json").then(res => res.json()).then(js => {
  window.apiUrl = (js["api-endpoint"].slice(-1) == "/")
    ? `${js["api-endpoint"]}activations`
    : `${js["api-endpoint"]}/activations`

  // update system activation
  getSystemActivation()
})

// call decorate page function
decoratePage()
