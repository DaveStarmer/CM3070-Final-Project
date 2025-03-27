/**
 * Create activation card and append to main
 * @param {object} props props object
 * @param {string} props.videoStill uri of video still
 * @param {string} props.activationTimestamp timestamp of activation
 * @param {string} props.camera camera details
 */
function addNotificationToMain(props) {
  document.querySelector("main").appendChild(createNotification(props))
}

/**
 * Create activation card
 * @param {object} props props object
 * @param {string} props.videoStill uri of video still
 * @param {string} props.timestamp timestamp of activation
 * @param {string} props.camera camera details
 * @param {string} props.filename filename of video
 * @returns DOM object
 */
function createNotification(props) {
  /** outer card */
  const card = document.createElement("div")
  card.classList.add("activation-card")
  card.dataset.video = props.filename
  /** video still image */
  const videoStill = document.createElement("img")
  videoStill.src = props.videoStill
  card.appendChild(videoStill)
  /** information area */
  const info = document.createElement("div")
  info.classList.add("activation-info")
  card.appendChild(info)
  /** timestamp text */
  const actDT = document.createElement("p")
  actDT.classList.add("activation-date-time")
  actDT.innerText = props.timestamp
  info.appendChild(actDT)
  /** camera text */
  const actCam = document.createElement("p")
  actCam.innerText = props.camera
  actCam.classList.add("activation-camera")
  info.appendChild(actCam)

  // add onclick eventListener to allow opening the full video in a popup
  card.addEventListener("click", selectNotification)

  return card
}

/**
 * update activations section of page
 * @param {boolean} newActivations show only new activations (default)
 */
function updateActivations(newActivations = true) {
  // clear notifications
  fetch(apiUrl)
    .then(res => res.json())
    .then(js => {
      // clear main or existing cards

      // if no new activations, display message to that effect
      if (js.length == 0) {
        document.querySelector("main").innerHTML = "<div>No new notifications to show</div>"
      }
      // otherwise empty the activations display
      else document.querySelector("main").innerHTML = ""

      // iterate and put activation cards in place
      for (let i = 0; i < js.length; ++i) {
        addNotificationToMain({ videoStill: "https://placehold.co/150x75", ...js[i] })
      }
    }

    )

}

/**
 * Helper function to create new DOM Element, attach to parent, and set common attributes
 * 
 * @param {string|Element} parent parent element to attach new element to (id or JS DOM Element)
 * @param {string} elementType type of new element
 * @param {string} id id of new element (optional, required if props set)
 * @param {string[]} props.classes array of strings representing classes to be assigned to element
 * @param {string} props.src source for image
 * @param {string} props.alt alt text for image
 * @returns created element
 */
function createDocElement(parent, elementType, id, props) {
  // create element
  const element = document.createElement(elementType)
  // give element id if set
  if (id) element.id = id

  // deal with contents of props
  if (props) {
    // set classes if passed
    if (props.classes) {
      for (c of props.classes) {
        element.classList.add(c)
      }
    }
    // set img src
    if (elementType == "img" && props.src) {
      element.src = props.src
    }
    // set alt text
    if (elementType == "img" && props.alt) {
      element.alt = props.alt
    }
  }

  // attach element to parent
  if ((typeof parent).toLowerCase() == "string") {
    // if id has been passed in, find JS DOM Element
    parent = document.getElementById(parent)
  }
  parent.appendChild(element)
  return element
}

function createVideoPopup() {
  // create page overlay - the overlay to blank out the background if necessary
  if (!document.getElementById("page-overlay")) {
    createDocElement(document.body, "div", "page-overlay")
  }

  // create popup - the box if necessary
  if (!document.getElementById("popup")) {
    createDocElement("page-overlay", "div", "popup")
  }
  const popup = document.getElementById("popup")

  // create the close button for the popup
  const popupClose = createDocElement(popup, "img", "popup-close")
  popupClose.src = "images/close_24dp_000000.svg"
  popupClose.addEventListener("click", ev => {
    // remove visibility from popup elements
    // this could be worked out programatically, but this absolute version makes it clearer for maintenance
    document.getElementById("video-popup").classList.remove("popup-visible")
    document.getElementById("popup").classList.remove("popup-visible")
    document.getElementById("page-overlay").classList.remove("popup-visible")
  })

  // create the video div - in case other popups are wanted in future
  const videoPopup = createDocElement(popup, "div", "video-popup")

  // create header block
  const videoHeader = createDocElement(videoPopup, "div", "popup-video-head")
  createDocElement(videoHeader, "p", "popup-video-date-time")
  createDocElement(videoHeader, "p", "popup-video-camera")

  // create video element
  const videoPlayback = createDocElement(videoPopup, "video", "video-playback")
  videoPlayback.setAttribute("controls", "controls")

  // create video source element
  createDocElement(videoPlayback, "source", "video-source")

  // toolbar
  const videoToolbar = createDocElement(videoPopup, "div", "video-toolbar")
  // viewed status
  const viewedButton = createDocElement(videoToolbar, "img", "viewed-status", {
    src: "images/viewed.svg",
    alt: "video viewed, click to mark as new",
    classes: ["img-button"]
  })

  // share
  const shareButton = createDocElement(videoToolbar, "img", "share-video", {
    src: "images/share_24dp_000000.svg",
    alt: "get share link valid for 7 days",
    classes: ["img-button"]
  })
}

function selectNotification(ev) {
  // move up the tree to find the parent activation card
  let target = ev.target
  while (target != document.body && !target.classList.contains("activation-card")) {
    target = target.parentElement
  }

  // set titles
  const activationDateTime = target.querySelector(".activation-date-time").innerText
  document.getElementById("popup-video-date-time").innerText = activationDateTime
  const activationCam = target.querySelector(".activation-camera").innerText
  document.getElementById("popup-video-camera").innerText = activationCam


  // get video key to find
  const videoKey = target.dataset.video

  fetch(`${apiUrl}/?video=${videoKey}`).then(response => {
    // exit if invalid URL is sent
    console.log(response)
    return response.text()
  }).then(videoUrl => {
    console.log(videoUrl)
    // set video to be displayed
    document.getElementById("video-source").src = videoUrl

    // open popup
    document.getElementById("video-popup").classList.add("popup-visible")
    document.getElementById("popup").classList.add("popup-visible")
    document.getElementById("page-overlay").classList.add("popup-visible")
  })
}
