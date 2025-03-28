function decoratePage() {
  // Menu icon from https://fonts.google.com/icons?selected=Material+Icons:menu
  // Open menu icon https://fonts.google.com/icons?selected=Material+Icons:menu_open

  /** nav element on page (starts empty) */
  const navTag = document.querySelector("nav")
  /** list element to append menu items to */
  const menuList = document.createElement("ol")
  menuList.start = 0 // ensure home is number element 0
  // append menu to the nav section
  navTag.appendChild(menuList)

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
}

function createMenuItem(parent, currentPage, description, url) {
  const link = document.createElement("a")
  link.href = url
  link.innerText = description
  if (url == currentPage) link.classList.add("current-page")
  const item = document.createElement("li")
  item.appendChild(link)
  parent.appendChild(item)
}

const menuInfo = [
  ["Home", "index.html"],
  ["Deactivate", ""],
  ["Alerts", "/alerts"],
  ["Logout", "/logout"],
]

// call decorate page function
decoratePage()
