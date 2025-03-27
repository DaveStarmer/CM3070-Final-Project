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
  info.appendChild(actCam)

  return card
}

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


