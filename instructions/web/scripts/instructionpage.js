
function decoratePage() {
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
  const menuList = document.createElement("ol")
  menuList.start = 0 // ensure home is number element 0
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
  if (currPageFilename == "index.html") currPageFilename = menuInfo[0][1]

  /** length of menu list array */
  const numMenuItems = menuInfo.length

  /** current page index in menuInfo */
  let currPageIndex = -1

  // iterate through menu items, adding them as necessary, find current page on way
  for (let i = 0; i < numMenuItems; ++i) {
    createMenuItem(menuList, currPageFilename, ...menuInfo[i])
    if (menuInfo[i][1] == currPageFilename) currPageIndex = i
  }

  if (currPageIndex >= 0) {
    const docBody = document.querySelector('body')
    const nextPrev = document.createElement('div')
    nextPrev.id = "next-prev-div"
    docBody.appendChild(nextPrev)

    // create previous link (if not home page)
    if (currPageIndex > 0) {
      // create element to link to previous page
      nextPrev.appendChild(previousNextElement("prev", ...menuInfo[currPageIndex - 1]))
    }
    // create next element (if not last page)
    if (currPageIndex < numMenuItems - 1) {
      // create element to link to previous page
      nextPrev.appendChild(previousNextElement("next", ...menuInfo[currPageIndex + 1]))
    }
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

function previousNextElement(prevNext, itemDesc, url) {
  /** link to the page */
  const outerLink = document.createElement('a')
  outerLink.id = `${prevNext}-page`
  outerLink.href = url
  outerLink.classList.add("prev-next-link")

  /** pointing element */
  const point = document.createElement('div')
  point.classList.add("big-point")
  point.innerText = (prevNext == "prev") ? "<" : ">"
  outerLink.appendChild(point)
  /** the 'Previous' or 'Next' text  */
  const directionText = document.createElement('div')
  directionText.innerText = (prevNext == "prev") ? "Previous" : "Next"
  directionText.classList.add("prev-next-text")
  outerLink.appendChild(directionText)
  /** description of previous/next page */
  const pageDesc = document.createElement('div')
  pageDesc.innerText = itemDesc
  pageDesc.classList.add("prev-next-desc")
  outerLink.appendChild(pageDesc)
  return outerLink
}

const menuInfo = [
  ["Home", "index.html"],
  ["Create Account", "01createacc.html"],
  ["Domain Name and Certificate", "02domaincert.html"],
  ["Deploy CloudFormation Stacks", "03stacks.html"],
  ["Update Route53", "04updater53.html"],
  ["Create Dashboard User", "05createuser.html"],
  ["Subscribe to alerts", "06subscribe.html"],
  ["Create IAM User", "07createiamuser.html"],
  ["Set up Raspberry Pi", "08rpi.html"],
]

// call decorate page function
decoratePage()